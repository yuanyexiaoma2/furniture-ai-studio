import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { kieRequest, referenceImageUnavailable, KieError, ReferenceImageFailure } from "../../src/lib/kie-http";
import { models } from "../../src/lib/models.config";
import { estimateImageUsd, estimateLlmUsd, costFields, toUsd, kieCreditCost } from "../../src/lib/gateway-cost";
import { parseZenMuxBill, queryZenMuxBill } from "../../src/lib/zenmux-billing";
test("四类 KIE 请求：HTTP200业务失败、余额/参数/安全/参考图中文提示", async () => {
  for (const endpoint of ["api/file-stream-upload", "api/v1/jobs/createTask", "api/v1/jobs/recordInfo?taskId=mock", "chat/completions"]) {
    for (const [code, msg, expected] of [[402, "Insufficient balance", "余额不足"], [400, "Invalid parameter", "参数"], [500, "Content blocked by safety policy", "拦截"], [500, "Failed to download reference image: URL expired", "参考图"]] as const) {
      await assert.rejects(kieRequest(`https://fixture.invalid/${endpoint}`, {}, { key: "mock-key", beforeRequest: async () => {}, allowMissingCode: endpoint.includes("chat"), fetcher: async () => new Response(JSON.stringify({ code, msg }), { status: 200 }) }), error => error instanceof Error && error.message.includes(expected));
    }
  }
});
test("KIE业务code=null/空串不能当成功；参考图错误不能用状态码猜", async () => {
  for (const code of [null, "", 0]) await assert.rejects(kieRequest("https://fixture.invalid", {}, { key: "fake", beforeRequest: async () => {}, allowMissingCode: true, fetcher: async () => new Response(JSON.stringify({ code, msg: "Mock error" })) }), e => e instanceof KieError && e.businessFailure);
  await assert.rejects(kieRequest("https://fixture.invalid", {}, { key: "fake", beforeRequest: async () => {}, fetcher: async () => new Response(JSON.stringify({ code: 500, msg: "Content blocked", credits_consumed: 0.1 })) }), e => e instanceof KieError && e.cost?.amount === 0.1);
  assert.equal(referenceImageUnavailable("Invalid prompt parameter 422"), false); assert.equal(referenceImageUnavailable("HTTP 404 not found"), false);
  assert.equal(referenceImageUnavailable("Failed to download input image URL"), true);
  const error = new ReferenceImageFailure("expired"); assert.equal(error.retryable, false);
});
test("统一美元：KIE保留原积分、actual零值，ZenMux使用上游预估而不伪造固定单价", () => {
  const kie = models["scene-main"].find(c => c.provider === "kie")!, zen = models["scene-main"].find(c => c.provider === "zenmux")!;
  assert.equal(estimateImageUsd(kie, "2K"), 0.03); assert.equal(estimateImageUsd(kie, "4K"), 0.045);
  assert.equal(toUsd({ amount: 6, currency: "credits" }), 0.03);
  assert.deepEqual(costFields({ amount: 0, currency: "credits" }, 0.03), { costUsd: 0, credits: 0, costEstimated: false });
  assert.deepEqual(costFields(undefined, 0.03), { costUsd: 0.03, credits: null, costEstimated: true });
  assert.equal(kieCreditCost(-1), undefined); assert.equal(kieCreditCost("") , undefined); assert.equal(kieCreditCost(NaN), undefined); assert.equal(kieCreditCost(0)?.amount, 0);
  assert.ok(estimateImageUsd(zen, "4K") > 0.1134); assert.ok(estimateImageUsd(zen, "4K", "提示词", [{ width: 2048, height: 2048 }]) > estimateImageUsd(zen, "4K"));
  const vision = models["llm-vision"].find(c => c.provider === "kie")!; assert.equal(estimateLlmUsd(vision, 1000, 1000), 0.00135);
});
test("ZenMux延迟账单：准确ID/model才回填，零费用有效，未就绪保留预估", async () => {
  const model = models["scene-main"].find(c => c.provider === "zenmux")!.model;
  const reply = { generationId: "gen_mock", model, usage: 0.09, ratingResponses: { billAmount: 0.02 } };
  assert.equal(parseZenMuxBill(reply, "gen_mock", model), 0.02);
  assert.equal(parseZenMuxBill({ ...reply, ratingResponses: { billAmount: 0 } }, "gen_mock", model), 0);
  assert.equal(parseZenMuxBill({ generationId: "gen_mock", model }, "gen_mock", model), null);
  assert.equal(parseZenMuxBill(reply, "other", model), null); assert.equal(parseZenMuxBill(reply, "gen_mock", "wrong-model"), null);
  const bill = await queryZenMuxBill("gen_mock", model, async url => { assert.match(String(url), /\/management\/generation\?id=gen_mock$/); return new Response(JSON.stringify(reply)); }); assert.equal(bill.amount, 0.02);
  await assert.rejects(queryZenMuxBill("gen_mock", model, async () => new Response("not ready", { status: 404 })), /尚不可用/);
});
