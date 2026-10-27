import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { ZenMuxImageProvider } from "../../src/lib/zenmux-image-provider";
import { ZenMuxLLMProvider } from "../../src/lib/zenmux-llm-provider";
import { KieLLMProvider } from "../../src/lib/kie-llm-provider";
import { kieRequest } from "../../src/lib/kie-http";
import { GatewayError } from "../../src/lib/gateway-error";
import { circuitFailure, emptyCircuit, routeCall, type CircuitStore } from "../../src/lib/gateway-router";
import type { ModelCandidate } from "../../src/lib/models.config";
import {DEFAULT_AGENT} from "../../src/lib/agent-default";
import {imageRetryAllowed} from "../../src/lib/studio-rules";
import type { ImageRequest } from "../../src/lib/image-provider";
import { identityPrompt, identitySchema, identityText } from "../../src/prompts/identity";
import { db } from "../../src/lib/db";
const oldKey = process.env.ZENMUX_API_KEY;
process.env.ZENMUX_API_KEY = "unit-test-not-real";
after(async () => { if (oldKey === undefined) delete process.env.ZENMUX_API_KEY; else process.env.ZENMUX_API_KEY = oldKey; await db.$disconnect(); });
const read = async () => ({ bytes: Buffer.from("reference"), mime: "image/png" as const });
const imageInput: ImageRequest = { prompt: "测试图片", referenceImages: [{ id: "asset" }], aspectRatio: "3:4", resolution: "4K", outputFormat: "png" };
test("线路耗尽仍保留扣费不确定标记，上层不能自动重发",async()=>{
 const s=setup();let attempts=0;
 await assert.rejects(routeCall({logical:"scene-main",candidates:[candidates[1]],circuit:s.circuit,configured:()=>true,hooks:s.hooks,call:async()=>{attempts++;throw new GatewayError("kie","模拟提交后断网",500,true,true);}}),error=>{assert.ok(error instanceof GatewayError);assert.equal(error.uncertain,true);assert.equal(imageRetryAllowed({},error.retryable,error.uncertain),false);return true;});
 assert.equal(attempts,1);
});
test("备用线路的已知错误不能抹掉前一线路的扣费不确定状态",async()=>{
 for(const status of [400,500]){
  const s=setup();await assert.rejects(routeCall({logical:"scene-main",candidates,circuit:s.circuit,configured:()=>true,hooks:s.hooks,call:async c=>{throw c.provider==="zenmux"?new GatewayError("zenmux","模拟断网",500,true,true):new GatewayError("kie","模拟备用失败",status,status>=500,false);}}),error=>error instanceof GatewayError&&error.uncertain===true);
 }
});
const candidates: ModelCandidate[] = [{ provider: "zenmux", model: "google/gemini-nano-banana-2.1", supportsTools: false, pricing: { currency: "USD" } }, { provider: "kie", model: "nano-banana-2-1", supportsTools: false, pricing: { currency: "credits" } }];
function setup() {
  let now = 1_000_000;
  const states = { zenmux: emptyCircuit(), kie: emptyCircuit() };
  const calls: string[] = [], logs: { provider: string; fallback: boolean; status?: string }[] = [];
  const circuit: CircuitStore = { async isOpen(p) { return (states[p].openUntil ?? 0) > now; }, async success(p) { states[p] = emptyCircuit(); }, async failure(p) { if (states[p].openUntil && states[p].openUntil! <= now) states[p] = emptyCircuit(); states[p] = circuitFailure(states[p], now); } };
  const hooks = { async start(c: ModelCandidate, fallback: boolean) { logs.push({ provider: c.provider, fallback }); return String(logs.length - 1); }, async success(id: string) { logs[Number(id)].status = "success"; }, async failure(id: string) { logs[Number(id)].status = "failed"; } };
  return { circuit, calls, logs, states, hooks, now: () => now, advance: (ms: number) => { now += ms; } };
}
test("ZenMux 生图：SDK 参数、MinIO 参考字节、inlineData / inline_data 与用量", async () => {
  for (const spelling of ["inlineData", "inline_data"]) {
    const provider = new ZenMuxImageProvider(undefined, { models: { async generateContent(body) {
      assert.equal(body.model, "google/gemini-nano-banana-2.1"); assert.deepEqual(body.config?.responseModalities, ["TEXT", "IMAGE"]);
      assert.deepEqual(body.config?.imageConfig, { aspectRatio: "3:4", imageSize: "4K", outputMimeType: "image/png" });
      assert.match(JSON.stringify(body.contents), /cmVmZXJlbmNl/);
      return { candidates: [{ content: { parts: [{ [spelling]: { data: Buffer.from("image").toString("base64"), mimeType: "image/png" } }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 } };
    } } }, read);
    const result = await provider.generate(imageInput); assert.equal(result.kind, "done"); if (result.kind === "done") { assert.equal(result.images[0].toString(), "image"); assert.equal(result.usage?.totalTokens, 30); }
  }
});
test("空 Key 的两个 ZenMux Provider 都不可用且不调用 SDK", async () => {
  const current = process.env.ZENMUX_API_KEY; process.env.ZENMUX_API_KEY = " ";
  try { const images = new ZenMuxImageProvider(); const llm = new ZenMuxLLMProvider(); assert.equal(images.isConfigured(), false); assert.equal(llm.isConfigured(), false); await assert.rejects(images.generate(imageInput), /未配置/); await assert.rejects(llm.chat({ messages: [] }), /未配置/); }
  finally { process.env.ZENMUX_API_KEY = current; }
});
test("ZenMux 生图：无图片、安全拦截、5xx、429 可切换，400 不切换", async () => {
  for (const response of [{ candidates: [{ content: { parts: [{ text: "没有图片" }] } }] }, { promptFeedback: { blockReason: "SAFETY" } }]) {
    await assert.rejects(new ZenMuxImageProvider(undefined, { models: { generateContent: async () => response } }, read).generate(imageInput), e => e instanceof GatewayError && e.retryable);
  }
  for (const status of [500, 503, 429, 400]) await assert.rejects(new ZenMuxImageProvider(undefined, { models: { generateContent: async () => { throw { status, message: "模拟失败" }; } } }, read).generate(imageInput), e => e instanceof GatewayError && e.status === status && e.retryable === (status !== 400));
});
test("ZenMux LLM：data URL、结构化 JSON、工具调用与 token 用量", async () => {
  const provider = new ZenMuxLLMProvider(undefined, async body => {
    assert.equal(body.model, "google/gemini-2.5-pro"); assert.equal(body.max_completion_tokens, 2200); assert.ok(body.response_format); assert.match(JSON.stringify(body.messages), /data:image\/png;base64,/);
    return { choices: [{ message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 } };
  }, read);
  const result = await provider.chat({ messages: [{ role: "user", content: "请读图" }], images: [{ id: "photo" }], responseFormat: { type: "json_object" } });
  assert.deepEqual(result.json, { ok: true }); assert.equal(result.usage.totalTokens, 12);
  const tools = [{ type: "function" as const, function: { name: "find", parameters: { type: "object" } } }];
  const toolProvider = new ZenMuxLLMProvider(undefined, async body => { assert.deepEqual(body.tools, tools); return { choices: [{ message: { content: null, tool_calls: [{ id: "1", type: "function", function: { name: "find", arguments: "{}" } }] } }] }; }, read);
  assert.equal((await toolProvider.chat({ messages: [{ role: "user", content: "查找" }], tools })).toolCalls?.[0].function.name, "find");
});
test("ZenMux LLM：5xx / 429 / 超时和拒绝可切换，422 不切换", async () => {
  for (const status of [500, 429, 422]) await assert.rejects(new ZenMuxLLMProvider(undefined, async () => { throw { status }; }, read).chat({ messages: [] }), e => e instanceof GatewayError && e.retryable === (status !== 422));
  await assert.rejects(new ZenMuxLLMProvider(undefined, async () => { throw new DOMException("timeout", "TimeoutError"); }, read).chat({ messages: [] }), e => e instanceof GatewayError && e.uncertain);
  await assert.rejects(new ZenMuxLLMProvider(undefined, async () => ({ choices: [{ finish_reason: "content_filter" }] }), read).chat({ messages: [] }), /拦截/);
});
test("默认Flash Agent通过ZenMux发送读图与工具请求并解析工具调用",async()=>{
 const tools=[{type:"function" as const,function:{name:"choose_recipe",parameters:{type:"object"}}}];
 const provider=new ZenMuxLLMProvider(DEFAULT_AGENT.candidate.model,async body=>{
  assert.equal(body.model,"google/gemini-3.8-flash");assert.deepEqual(body.tools,tools);
  assert.match(JSON.stringify(body.messages),/data:image\/png;base64,/);
  return {choices:[{message:{content:null,tool_calls:[{id:"flash-call",type:"function",function:{name:"choose_recipe",arguments:'{"templateId":"S01"}'}}]}}],usage:{prompt_tokens:100,completion_tokens:20,total_tokens:120}};
 },read);
 const reply=await provider.chat({messages:[{role:"user",content:"根据实拍规划"}],images:[{id:"photo"}],tools});
 assert.equal(reply.toolCalls?.[0].id,"flash-call");assert.equal(reply.toolCalls?.[0].function.arguments,'{"templateId":"S01"}');assert.equal(reply.usage.totalTokens,120);
});
test("未配置网关自动跳过，不标记备用；优先 ZenMux 为空仍走 KIE", async () => {
  const s = setup();
  const result = await routeCall({ logical: "scene-main", candidates, circuit: s.circuit, configured: p => p === "kie", hooks: s.hooks, async call(c) { s.calls.push(c.provider); return "图"; } });
  assert.deepEqual(s.calls, ["kie"]); assert.equal(result.fallback, false); assert.equal(s.logs.length, 1);
});
test("主网关 5xx 切换并逐次记录；400 参数错误仅调用一次", async () => {
  for (const status of [500, 400]) {
    const s = setup(); const request = routeCall({ logical: "scene-main", candidates, circuit: s.circuit, configured: () => true, hooks: s.hooks, async call(c) { s.calls.push(c.provider); if (c.provider === "zenmux") throw new GatewayError("zenmux", "模拟", status); return "图"; } });
    if (status === 400) { await assert.rejects(request, /未自动切换/); assert.deepEqual(s.calls, ["zenmux"]); }
    else { const result = await request; assert.equal(result.fallback, true); assert.deepEqual(s.logs.map(l => [l.provider, l.fallback, l.status]), [["zenmux", false, "failed"], ["kie", true, "success"]]); }
  }
});
test("备用未配置时保留原失败原因，并准确标明实际网关", async () => {
  const s = setup();
  await assert.rejects(routeCall({ logical: "scene-main", candidates, circuit: s.circuit, configured: p => p === "zenmux", hooks: s.hooks, async call() { throw new GatewayError("zenmux", "返回内容中没有图片"); } }), e => e instanceof GatewayError && e.provider === "zenmux" && /没有图片/.test(e.message));
  await assert.rejects(routeCall({ logical: "scene-main", candidates, circuit: s.circuit, configured: p => p === "kie", excluded: ["kie:nano-banana-2-1"], previousErrors: ["KIE：内容被拦截"], hooks: s.hooks, call: async () => "不应该调用" }), /内容被拦截/);
});
test("网关熔断：5 分钟内连续 3 次失败，3 分钟后恢复；过期失败窗口重置", async () => {
  const s = setup();
  const run = () => routeCall({ logical: "scene-main", candidates, circuit: s.circuit, configured: () => true, hooks: s.hooks, now: s.now, async call(c) { s.calls.push(c.provider); if (c.provider === "zenmux") throw new GatewayError("zenmux", "暂时失败"); return "ok"; } });
  for (let i = 0; i < 3; i++) await run(); assert.equal(await s.circuit.isOpen("zenmux"), true);
  const before = s.calls.length; await run(); assert.deepEqual(s.calls.slice(before), ["kie"]);
  s.advance(180_001); assert.equal(await s.circuit.isOpen("zenmux"), false); await run(); assert.equal(s.states.zenmux.consecutiveFailures, 1);
  s.advance(300_001); await run(); assert.equal(s.states.zenmux.consecutiveFailures, 1);
});
test("异步任务仅被接受时不清零失败；真正完成后才恢复", async () => {
  const s = setup(); await s.circuit.failure("kie");
  await routeCall({ logical: "scene-main", candidates: [candidates[1]], circuit: s.circuit, configured: () => true, hooks: s.hooks, call: async () => ({ kind: "pending" }), isSuccessful: () => false });
  assert.equal(s.states.kie.consecutiveFailures, 1);
  await s.circuit.success("kie"); assert.equal(s.states.kie.consecutiveFailures, 0);
});
test("KIE HTTP 200 业务失败（图片和聊天）必须检查 code；标准聊天可以省略 code", async () => {
  for (const allowMissingCode of [false, true]) for (const code of [401, 500]) await assert.rejects(kieRequest("https://fixture.invalid", {}, { key: "fake", beforeRequest: async () => {}, allowMissingCode, fetcher: async () => new Response(JSON.stringify({ code, msg: "模拟业务错误" }), { status: 200 }) }), e => e instanceof GatewayError && e.status === code);
  const reply = await kieRequest("https://fixture.invalid", {}, { key: "fake", beforeRequest: async () => {}, allowMissingCode: true, fetcher: async () => new Response(JSON.stringify({ choices: [] })) }); assert.ok(reply.choices);
  await assert.rejects(kieRequest("https://fixture.invalid", {}, { key: "fake", beforeRequest: async () => {}, fetcher: async () => new Response(JSON.stringify({ code: 0, msg: "其他业务失败" })) }), e => e instanceof GatewayError && e.retryable);
});
test("KIE LLM 使用独立 endpoint，无 model 字段，图片上传 URL；未适配 Agent 模型拒绝 tools", async () => {
  const provider = new KieLLMProvider(undefined, async (url, init, options) => {
    assert.match(url, /gemini-3-6-flash-openai\/v1\/chat\/completions/); assert.equal(options?.allowMissingCode, true);
    const body = JSON.parse(String(init.body)); assert.equal(body.model, undefined); assert.equal(body.reasoning_effort, "low"); assert.match(JSON.stringify(body.messages), /https:\/\/fixture.invalid\/photo/);
    return { choices: [{ message: { content: "已核对" } }], usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 }, credits_consumed: 0.1 };
  }, async () => "https://fixture.invalid/photo");
  const result = await provider.chat({ messages: [{ role: "user", content: "看图" }], images: [{ id: "photo" }] }); assert.equal(result.cost?.amount, 0.1);
  await assert.rejects(provider.chat({ messages: [], tools: [{ type: "function", function: { name: "f", parameters: {} } }] }), /未适配/);
});
test("身份提炼 schema 六类信息、部件数量和中文文本，提示词只在 prompts 中", () => {
  const raw = { structureAndParts: [{ part: "柜门", count: "2 扇", details: "左右对开" }], proportions: ["宽高接近"], colorsAndTextures: ["木纹"], hardware: ["黑色把手"], logosAndLabels: ["照片未发现"], driftWarnings: ["不可增加柜门"] };
  const parsed = identitySchema.parse(raw); assert.match(identityText(parsed), /柜门：2 扇/); assert.match(identityText(parsed), /易被 AI/);
  assert.equal(identitySchema.safeParse({ ...raw, structureAndParts: [] }).success, false);
  const input = identityPrompt({ sku: "TEST", name: "柜", category: "柜", dimensions: "80cm", colors: "木色", materials: "木", sellingPoints: [] }, ["a", "b"]); assert.equal(input.images?.length, 2); assert.equal(input.responseFormat?.type, "json_schema");
});
