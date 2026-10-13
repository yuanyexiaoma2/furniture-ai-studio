import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultSlots, eligibleSlots, packFilename, batchProgress, slotSchema } from "../../src/lib/pack-rules";
import { estimateImageUsd, roundUsd } from "../../src/lib/gateway-cost";
import { models, KIE_USD_PER_CREDIT } from "../../src/lib/models.config";
import { buildZip, crc32 } from "../../src/lib/zip";
import { quotaShortage } from "../../src/lib/quota-math";
test("整批配额计算包含进行中预留且精确给出美元差额", () => {
  assert.equal(quotaShortage(0.5, 0.1 + 0.24, 0.18), 0.02);
  assert.equal(quotaShortage(0.5, 0.1 + 0.22, 0.18), 0);
  assert.equal(quotaShortage(0.000001, 0, 0.18), 0.179999);
});
test("默认图包与空意图过滤：人工图位永不自动参与", () => {
  assert.equal(defaultSlots.length, 7);
  const slots = defaultSlots.map((s, i) => ({ ...s, goal: i < 3 ? "客厅空间" : "   " }));
  assert.equal(eligibleSlots(slots).length, 3);
  assert.equal(eligibleSlots([{ method: "manual_upload", goal: "有意图也不生成" }]).length, 0);
  assert.equal(slotSchema.safeParse({ ...slots[0], candidateCount: 5, aspectRatio: "1:1" }).success, false);
});
test("批次费用复用配置实时单价，六张2K美元与原积分一致", () => {
  const candidate = models["scene-main"].find(c => c.provider === "kie")!;
  const total = roundUsd(estimateImageUsd(candidate, "2K") * 6);
  assert.equal(total, 0.18); assert.equal(total / KIE_USD_PER_CREDIT, 36);
  const repriced = { ...candidate, pricing: { ...candidate.pricing, images: { "2K": 8 } } };
  assert.equal(roundUsd(estimateImageUsd(repriced, "2K") * 6), 0.24);
});
test("失败重试替代进度，不把历史失败重复计入总数", () => {
  assert.deepEqual(batchProgress([{ status: "failed", retriedBy: { id: "retry" } }, { status: "success", retriedBy: null }, { status: "pending", retriedBy: null }]), { completed: 1, failed: 0, total: 2, status: "generating" });
  assert.equal(batchProgress([{ status: "failed", retriedBy: null }]).status, "partial_failed");
});
test("终稿文件名与ZIP内容：UTF8文件名、PNG原字节和CRC正确", () => {
  assert.equal(packFilename("NL27TS01", 2, "scene"), "NL27TS01_02_scene.png");
  assert.equal(packFilename("../非法:SKU", 10, "detail"), ".._非法_SKU_10_detail.png");
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
  const zip = buildZip([{ name: "中文.png", bytes: Buffer.from("fixture") }, { name: "manifest.json", bytes: Buffer.from("{}") }]);
  assert.equal(zip.readUInt32LE(0), 0x04034b50); assert.equal(zip.readUInt16LE(6), 0x800);
  assert.equal(zip.readUInt16LE(zip.length - 12), 2); assert.ok(zip.includes(Buffer.from("manifest.json"))); assert.ok(zip.includes(Buffer.from("fixture")));
});
