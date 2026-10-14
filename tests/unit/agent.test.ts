import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyProfile, understanding, findConflicts, autoApproval, stopsQuestions, profileSchema } from "../../src/lib/profile-rules";
import { agentToolSchemas } from "../../src/lib/agent-tool-schemas";
import { KieLLMProvider } from "../../src/lib/kie-llm-provider";
import { readKieStream } from "../../src/lib/kie-http";
import { parseDocument } from "../../src/lib/document-parser";
import ExcelJS from "exceljs";
import { buildZip } from "../../src/lib/zip";
test("理解度只统计必填已确认字段，推测、缺失与冲突明确分列", () => {
  const p = emptyProfile(); p.category = { value: "边柜", status: "confirmed", sources: [{ kind: "product", id: "p", quote: "边柜" }], conflicts: [] };
  p.dimensions = { value: "80 cm", status: "inferred", sources: [{ kind: "document", id: "d", quote: "80" }], conflicts: [{ value: "90 cm", source: { kind: "document", id: "other", quote: "90" } }] };
  assert.equal(understanding(p).percent, 14); assert.ok(understanding(p).conflicts.includes("dimensions")); assert.equal(understanding(p).ready, false);
  const invalid = structuredClone(p); invalid.dimensions.status = "confirmed"; assert.equal(profileSchema.safeParse(invalid).success, false);
});
test("不同资料尺寸冲突保留两个来源，一致值不产生冲突", () => {
  const evidence = [{ field: "dimensions" as const, value: "80cm", source: { kind: "document" as const, id: "manual", quote: "80cm" } }, { field: "dimensions" as const, value: "90cm", source: { kind: "document" as const, id: "sheet", quote: "90cm" } }];
  assert.equal(findConflicts(evidence).length, 1); assert.equal(findConflicts(evidence)[0].evidence.length, 2); evidence[1].value = " 80 cm "; assert.equal(findConflicts(evidence).length, 0);
});
test("自动确认默认关、首次必须人工、最多1美元、风险和非法费用禁止自动", () => {
  const base = { enabled: true, firstConfirmed: true, costUsd: 1, risk: false };
  assert.equal(autoApproval(base), true);
  for (const change of [{ enabled: false }, { firstConfirmed: false }, { costUsd: 1.000001 }, { risk: true }, { costUsd: NaN }, { costUsd: -1 }]) assert.equal(autoApproval({ ...base, ...change }), false);
});
test("问卡最多3个问题，用户停止后停止提问", () => {
  const q = { question: "尺寸哪份为准？", options: ["说明书", "参数表"], allowFreeText: true };
  assert.equal(agentToolSchemas.ask_user.safeParse({ questions: [q,q,q] }).success, true);
  assert.equal(agentToolSchemas.ask_user.safeParse({ questions: [q,q,q,q] }).success, false);
  assert.equal(stopsQuestions("够了，开始吧"), true);
});
test("KIE Responses保留call_id续传，助手正文转output_text", async () => {
  const old = process.env.KIE_API_KEY; process.env.KIE_API_KEY = "unit-not-real";
  try {
    const provider = new KieLLMProvider({ model: "gpt-6-1-sol", endpoint: "https://fixture.invalid/responses", protocol: "responses", supportsTools: true }, async (_, init) => {
      const body = JSON.parse(String(init.body));
      assert.ok(body.input.some((i: Record<string, unknown>) => i.type === "function_call_output" && i.call_id === "call-one"));
      assert.ok(body.input.some((i: { role?: string; content?: { type: string }[] }) => i.role === "assistant" && i.content?.[0].type === "output_text"));
      return { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "收到" }] }], usage: { input_tokens: 20, output_tokens: 2, total_tokens: 22 }, credits_consumed: 0.01 };
    });
    const result = await provider.chat({ messages: [{ role: "assistant", content: "正在读取", tool_calls: [{ id: "call-one", type: "function", function: { name: "read_product_materials", arguments: "{}" } }] }, { role: "tool", tool_call_id: "call-one", content: "{}" }, { role: "user", content: "继续" }] }); assert.equal(result.text, "收到");
  } finally { if (old === undefined) delete process.env.KIE_API_KEY; else process.env.KIE_API_KEY = old; }
});
test("真实SSE增量解析并保存完整工具和费用，流中断不执行工具", async () => {
  const deltas: string[] = [], complete = { status: "completed", output: [{ type: "function_call", call_id: "1", name: "ask_user", arguments: "{}" }], credits_consumed: 0.2 };
  const source = [{ type: "response.output_text.delta", delta: "你好" }, { type: "response.completed", response: complete }].map(v => `data: ${JSON.stringify(v)}\n\n`).join("");
  assert.deepEqual(await readKieStream(new Response(source), text => deltas.push(text)), complete); assert.deepEqual(deltas, ["你好"]);
  await assert.rejects(readKieStream(new Response('data: {"type":"response.output_text.delta","delta":"一半"}\n\n')), /未完成/);
});
test("CSV带引号字段、Excel所有工作表、DOCX文字提取；损坏文档明确失败", async () => {
  assert.match(await parseDocument(Buffer.from('参数,值\n材质,"橡木,金属"'), "csv"), /橡木,金属/);
  const wb = new ExcelJS.Workbook(); wb.addWorksheet("规格").addRows([["宽度", "80cm"]]); wb.addWorksheet("材料").addRows([["木材", "橡木"]]); assert.match(await parseDocument(Buffer.from(await wb.xlsx.writeBuffer()), "xlsx"), /工作表：材料[\s\S]*橡木/);
  const zip = buildZip([{ name: "[Content_Types].xml", bytes: Buffer.from('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>') }, { name: "word/document.xml", bytes: Buffer.from('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>实木边柜说明</w:t></w:r></w:p></w:body></w:document>') }]);
  assert.match(await parseDocument(zip, "docx"), /实木边柜说明/);
  await assert.rejects(parseDocument(Buffer.from("invalid"), "pdf"), /PDF/);
});

test("有效PDF正文可提取，扫描或空PDF不伪造信息", async () => {
  const stream="BT /F1 12 Tf 50 750 Td (Furniture manual width 90cm) Tj ET";
  const objects=["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "<< /Length "+stream.length+" >>\nstream\n"+stream+"\nendstream"];
  let pdf="%PDF-1.4\n"; const offsets=[0]; for (const [i,obj] of objects.entries()) { offsets.push(Buffer.byteLength(pdf)); pdf+=(i+1)+" 0 obj\n"+obj+"\nendobj\n"; }
  const xref=Buffer.byteLength(pdf); pdf+="xref\n0 6\n0000000000 65535 f \n"+offsets.slice(1).map(n=>String(n).padStart(10,"0")+" 00000 n \n").join("")+"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF";
  assert.match(await parseDocument(Buffer.from(pdf), "pdf"), /Furniture manual width 90cm/);
  const empty = pdf.replace("Furniture manual width 90cm", "                          "); await assert.rejects(parseDocument(Buffer.from(empty), "pdf"), /未提取到文字/);
});
