import "dotenv/config";
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import bcrypt from "bcrypt";
import sharp from "sharp";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const runId = randomBytes(8).toString("hex");
const viewerEmail = `e2e-product-viewer-${runId}@example.invalid`;
const password = randomBytes(24).toString("base64url");
let db: PrismaClient;
let productId = "", viewerId = "";
const contexts: BrowserContext[] = [];
const origin = "http://localhost:3000";

async function login(page: Page, email: string, secret: string) {
  await page.goto("/login");
  await page.getByLabel("公司邮箱").fill(email);
  await page.getByLabel("密码", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "进入工作台" }).click();
  await expect(page).toHaveURL(`${origin}/`);
  await expect(page.getByRole("heading", { name: "全部项目" })).toBeVisible();
}

test.beforeAll(async () => {
  if (!process.env.DATABASE_URL || !["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname)) throw new Error("验收只允许本地数据库");
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const viewer = await db.user.create({ data: { name: "商品验收只读成员", email: viewerEmail, passwordHash: await bcrypt.hash(password, 12), role: "viewer" } });
  viewerId = viewer.id;
  await mkdir(".local/verification", { recursive: true });
});
test.afterAll(async () => {
  for (const context of contexts) await context.close();
  if (!db) return;
  try {
    if (productId) {
      const client = new S3Client({ endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION || "us-east-1", forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false", credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! } });
      const assets = await db.asset.findMany({ where: { productId } });
      for (const asset of assets) await client.send(new DeleteObjectCommand({ Bucket: "assets", Key: asset.storageKey }));
      client.destroy();
      await db.generationJob.deleteMany({ where: { productId } });
      await db.asset.deleteMany({ where: { productId } });
      await db.product.delete({ where: { id: productId } });
    }
    if (viewerId) await db.user.delete({ where: { id: viewerId } });
  } finally { await db.$disconnect(); }
});

test("商品创作验收：保存、上传、生成条件、记录留存、下载及只读权限（模拟数据）", async ({ browser }) => {
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } }); contexts.push(adminContext);
  const page = await adminContext.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);
  await page.getByText("新建商品", { exact: true }).click();
  await page.getByLabel("SKU", { exact: true }).fill(`E2E-${runId}`);
  await page.getByLabel("商品名称").fill("验收测试商品（模拟数据）");
  await page.getByLabel("品类", { exact: true }).fill("测试收纳柜");
  await page.getByLabel("尺寸", { exact: true }).fill("80 × 40 × 100 cm");
  await page.getByLabel("颜色", { exact: true }).fill("模拟橡木色");
  await page.getByLabel("卖点", { exact: true }).fill("仅用于自动验收，不作为实拍或真实生成验收");
  await page.getByLabel("产品身份特征", { exact: true }).fill("模拟身份：双门，四脚，两个黑色把手");
  const created = page.waitForResponse((response) => response.url().endsWith("/api/products") && response.request().method() === "POST");
  await page.getByRole("button", { name: "创建商品", exact: true }).click();
  const response = await created; expect(response.status()).toBe(201);
  productId = (await response.json()).product.id;
  await expect(page).toHaveURL(`${origin}/products/${productId}`);
  await expect(page.getByRole("heading", { name: "03 / 场景创作" })).toBeVisible();
  await expect(page.getByRole("button", { name: "生成一张场景图" })).toBeDisabled();
  await page.getByLabel("产品身份特征", { exact: true }).fill("模拟身份已确认：双门四脚，两个黑色把手，纹理一致");
  await page.getByRole("button", { name: "保存产品资料" }).click();
  await expect(page.getByText("产品资料与身份特征已保存", { exact: true })).toBeVisible();

  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#e7e5d8" } }).png().toBuffer();
  const png2 = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#d9ddd0" } }).png().toBuffer();
  await page.getByLabel("实拍参考图", { exact: true }).setInputFiles([{ name: "fixture-1.png", mimeType: "image/png", buffer: png }, { name: "fixture-2.png", mimeType: "image/png", buffer: png2 }]);
  await page.getByRole("button", { name: "上传实拍图" }).click();
  await expect(page.getByText("实拍图已保存，可继续填写场景意图", { exact: true })).toBeVisible();
  await expect(page.getByAltText("产品实拍图 1")).toBeVisible();
  await expect(page.getByAltText("产品实拍图 2")).toBeVisible();
  const api = adminContext.request;
  const photos = await db.asset.findMany({ where: { productId, type: "photo" } });
  const invalid = await api.post(`/api/products/${productId}/photos`, { headers: { Origin: origin }, multipart: { photos: { name: "broken.png", mimeType: "image/png", buffer: Buffer.from("not-an-image") } } });
  expect(invalid.status()).toBe(400);
  const mismatch = await api.post(`/api/products/${productId}/photos`, { headers: { Origin: origin }, multipart: { photos: { name: "wrong.jpg", mimeType: "image/jpeg", buffer: png } } });
  expect(mismatch.status()).toBe(400);
  const extra = await api.post(`/api/products/${productId}/photos`, { headers: { Origin: origin }, multipart: { photos: { name: "third.png", mimeType: "image/png", buffer: png } } });
  expect(extra.status()).toBe(201);
  const fourth = await api.post(`/api/products/${productId}/photos`, { headers: { Origin: origin }, multipart: { photos: { name: "fourth.png", mimeType: "image/png", buffer: png } } });
  expect(fourth.status()).toBe(400);
  const invalidScene = await api.post(`/api/products/${productId}/generations`, { headers: { Origin: origin }, data: { sceneIntent: "测试", aspectRatio: "8:1" } });
  expect(invalidScene.status()).toBe(400);
  const crossOrigin = await api.post(`/api/products/${productId}/generations`, { headers: { Origin: "https://example.invalid" }, data: { sceneIntent: "测试" } });
  expect(crossOrigin.status()).toBe(403);
  // 不提交真实生图：模拟记录直接落库，仅验证显示、刷新留存与鉴权下载。
  const product = await db.product.findUniqueOrThrow({ where: { id: productId } });
  const job = await db.generationJob.create({ data: { productId, createdById: product.createdById, logicalModel: "scene-main", provider: "simulation", model: "模拟测试记录", cost: 0, status: "success", input: { sceneIntent: "模拟场景记录，仅用于 UI 验收", resolution: "2K", aspect_ratio: "1:1" }, resultAssetIds: [photos[0].id], completedAt: new Date() } });
  await page.reload();
  await expect(page.getByTestId(`generation-${job.id}`)).toContainText("模拟场景记录");
  await expect(page.getByLabel("产品身份特征", { exact: true })).toHaveValue("模拟身份已确认：双门四脚，两个黑色把手，纹理一致");
  const result = await api.get(`/api/products/${productId}/generations`);
  expect(result.status()).toBe(200); expect((await result.json()).product.jobs[0].id).toBe(job.id);
  const download = await api.get(`/api/assets/${photos[0].id}?download=1`);
  expect(download.status()).toBe(200); expect(download.headers()["content-disposition"]).toContain("attachment");
  expect(download.headers()["cache-control"]).toBe("private, no-store");
  await page.screenshot({ path: ".local/verification/product-desktop.png", fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator(".generation-history").scrollIntoViewIfNeeded();
  await expect(page.getByTestId(`generation-${job.id}`)).toBeVisible();
  await expect.poll(() => page.locator(".generation-history").evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
  await page.screenshot({ path: ".local/verification/product-mobile.png", fullPage: true, animations: "disabled" });
  expect(errors).toEqual([]);

  const viewerContext = await browser.newContext(); contexts.push(viewerContext);
  const viewer = await viewerContext.newPage(); await login(viewer, viewerEmail, password);
  await viewer.goto(`/products/${productId}`);
  await expect(viewer.getByRole("button", { name: "生成一张场景图" })).toBeDisabled();
  await expect(viewer.getByLabel("产品身份特征", { exact: true })).toBeDisabled();
  for (const path of ["", "/photos", "/generations"]) {
    const denied = path ? await viewerContext.request.post(`/api/products/${productId}${path}`, { headers: { Origin: origin }, data: {} }) : await viewerContext.request.patch(`/api/products/${productId}`, { headers: { Origin: origin }, data: {} });
    expect(denied.status()).toBe(403);
  }
  const anonymous = await browser.newContext(); contexts.push(anonymous);
  for (const path of [`/api/products/${productId}/generations`, `/api/assets/${photos[0].id}`]) expect((await anonymous.request.get(path)).status()).toBe(401);
  expect((await anonymous.request.post(`/api/products/${productId}/generations`, { data: {} })).status()).toBe(401);
});
