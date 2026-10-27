import "dotenv/config";
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import sharp from "sharp";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
const run = randomUUID(), email = `e2e-pack-${run}@example.invalid`, password = randomUUID();
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const s3 = new S3Client({ endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION || "us-east-1", forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! } });
let productId = "", userId = ""; const keys: string[] = [];
test.beforeAll(async () => {
  if (!process.env.DATABASE_URL || !["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname)) throw new Error("验收仅本地运行");
  userId = (await db.user.create({ data: { name: "图包浏览器验收", email, passwordHash: await bcrypt.hash(password, 12), monthlyQuota: 5 } })).id;
  productId = (await db.product.create({ data: { sku: `E2E-PACK-${run}`, name: "图包测试商品", category: "测试柜", dimensions: "测试", colors: "木色", materials: "木", sellingPoints: [], identityTraits: "双门四脚，黑色把手", createdById: userId } })).id;
  await db.productIdentityVersion.create({ data: { productId, text: "双门四脚，黑色把手", savedById: userId } });
  for (let i = 0; i < 2; i++) { const key = `verification/${run}/photo-${i}.png`; keys.push(key); const bytes = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#deded0" } }).png().toBuffer(); await s3.send(new PutObjectCommand({ Bucket: "assets", Key: key, Body: bytes, ContentType: "image/png" })); await db.asset.create({ data: { productId, type: "photo", storageKey: key, width: 64, height: 64, createdById: userId } }); }
});
test.afterAll(async () => {
  if (productId) { await db.generationJob.deleteMany({ where: { productId } }); await db.generationBatch.deleteMany({ where: { pack: { productId } } }); await db.imagePack.deleteMany({ where: { productId } }); await db.asset.deleteMany({ where: { productId } }); await db.product.delete({ where: { id: productId } }); }
  if (userId) await db.user.delete({ where: { id: userId } });
  for (const key of keys) await s3.send(new DeleteObjectCommand({ Bucket: "assets", Key: key })); s3.destroy(); await db.$disconnect();
});
test("图包：默认草稿→意图→确认6张→候选→终稿持久化→ZIP（模拟结果，不调用付费网关）", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto("/login"); await page.getByLabel("公司邮箱").fill(email); await page.getByLabel("密码", { exact: true }).fill(password); await page.getByRole("button", { name: "进入工作台" }).click(); await page.waitForURL("http://localhost:3000/");
  // 浏览器交互使用真实CRUD/估价/终稿/导出，只有收费提交响应替换为fixture；真实事务生成由隔离集成测试覆盖。
  await page.route(`**/api/products/${productId}/pack`, async route => {
    const request = route.request(); if (request.method() !== "POST" || request.postDataJSON().action !== "generate") return route.continue();
    const pack = await db.imagePack.findFirstOrThrow({ where: { productId }, include: { slots: { where: { method: "ai_scene", goal: { not: "" } } } } });
    const version = await db.productIdentityVersion.findFirstOrThrow({ where: { productId } });
    const batch = await db.generationBatch.create({ data: { packId: pack.id, createdById: userId, slotCount: 3, totalCount: 6, estimatedCostUsd: 0.18, requestKey: randomUUID() } });
    for (const slot of pack.slots) for (let i = 0; i < 2; i++) {
      const key = `verification/${run}/result-${slot.id}-${i}.png`; keys.push(key); const bytes = await sharp({ create: { width: 256, height: 256, channels: 3, background: i ? "#cad3bb" : "#dfd6c4" } }).png().toBuffer(); await s3.send(new PutObjectCommand({ Bucket: "assets", Key: key, Body: bytes, ContentType: "image/png" }));
      const asset = await db.asset.create({ data: { productId, type: "generated", storageKey: key, width: 256, height: 256, createdById: userId } });
      await db.generationJob.create({ data: { productId, slotId: slot.id, batchId: batch.id, logicalModel: "scene-main", provider: "kie", model: "模拟模型", createdById: userId, status: "success", costUsd: 0.03, credits: 6, costEstimated: false, resultAssetIds: [asset.id], completedAt: new Date(), input: { identityVersionId: version.id, identityTraits: version.text } } });
    }
    await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ batchId: batch.id }) });
  });
  await page.goto(`/products/${productId}/pack`); await page.getByRole("button", { name: "套用默认图包" }).click(); await expect(page.locator(".pack-slot")).toHaveCount(7);
  for (const name of ["主图", "客厅场景", "卧室场景"]) { const slot = page.locator(".pack-slot").filter({ has: page.getByRole("heading", { name, exact: true }) }); await slot.getByLabel(`${name}场景意图`).fill(`模拟${name}意图`); await slot.getByRole("button", { name: "保存图位" }).click(); await expect(slot.getByRole("button", { name: "再来 2 张" })).toBeEnabled(); }
  const quoteReply=page.waitForResponse(r=>r.url().endsWith(`/api/products/${productId}/pack`)&&r.request().method()==="POST"&&r.request().postDataJSON().action==="quote");
  await page.getByRole("button", { name: "批量生成候选图", exact: true }).click(); const quote=await (await quoteReply).json(); const dialog = page.getByRole("dialog"); await expect(dialog).toContainText("6 张"); expect(quote.estimatedCostUsd).toBeGreaterThan(0); expect(quote.provider).toBe("kie"); await expect(dialog).toContainText("$"+quote.estimatedCostUsd.toFixed(6)); await expect(dialog).toContainText(String(quote.estimatedCredits)+" "+(quote.creditEquivalent?"KIE 等值积分":"积分")); await expect(dialog).toContainText("其他空间场景"); await dialog.getByRole("button", { name: "确认并生成" }).click();
  await expect(page.getByText("已完成 6 / 6，失败 0", { exact: true })).toBeVisible(); await expect(page.locator(".pack-candidates .generation-card")).toHaveCount(6);
  for (const name of ["主图", "客厅场景", "卧室场景"]) { const slot = page.locator(".pack-slot").filter({ has: page.getByRole("heading", { name, exact: true }) }); await slot.getByRole("button", { name: "设为终稿", exact: true }).first().click(); await expect(slot.getByRole("button", { name: "终稿 · 取消终稿" })).toBeVisible(); }
  await page.reload(); await expect(page.getByRole("button", { name: "终稿 · 取消终稿" })).toHaveCount(3);
  await page.getByRole("button", { name: "导出终稿", exact: true }).click(); await expect(page.getByRole("dialog")).toContainText("尚无终稿");
  const downloaded = page.waitForEvent("download"); await page.getByRole("link", { name: "仅导出已完成部分" }).click(); const download = await downloaded; expect(await download.failure()).toBeNull(); expect(download.suggestedFilename()).toContain("_finals.zip");
  await page.getByRole("button", { name: "放大预览 主图", exact: true }).first().click(); await expect(page.getByRole("dialog")).toContainText("候选图预览"); await page.getByRole("button", { name: "关闭弹窗" }).click();
  await page.setViewportSize({ width: 390, height: 844 }); await expect(page.locator(".pack-slot-editor").first()).toHaveCSS("display", "grid");  expect(errors).toEqual([]);
});
