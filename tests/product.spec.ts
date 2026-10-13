import "dotenv/config";
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import bcrypt from "bcrypt";
import sharp from "sharp";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { S3Client, DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

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
  await expect(page.locator(".photo-dropzone")).toHaveCSS("display", "flex");
  await expect(page.locator(".scene-panel .resolution-options")).toHaveCSS("display", "grid");
  await expect(page.getByRole("button", { name: "生成一张场景图" })).toBeDisabled();
  await page.getByLabel("产品身份特征", { exact: true }).fill("模拟身份已确认：双门四脚，两个黑色把手，纹理一致");
  await page.getByRole("button", { name: "保存产品资料" }).click();
  await expect(page.getByText("产品资料与身份特征已保存", { exact: true })).toBeVisible();

  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#e7e5d8" } }).png().toBuffer();
  const png2 = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#d9ddd0" } }).png().toBuffer();
  // 模拟从文件管理器拖入文件，松手立即上传，不再要求额外点击上传按钮。
  const dropFiles = await page.evaluateHandle(({ first, second }) => { const transfer = new DataTransfer(); transfer.items.add(new File([new Uint8Array(first)], "fixture-1.png", { type: "image/png" })); transfer.items.add(new File([new Uint8Array(second)], "fixture-2.png", { type: "image/png" })); return transfer; }, { first: [...png], second: [...png2] });
  await page.locator(".photo-panel").dispatchEvent("dragover", { dataTransfer: dropFiles });
  await page.locator(".photo-panel").dispatchEvent("drop", { dataTransfer: dropFiles });
  await dropFiles.dispose();
  await expect(page.getByText("实拍图已保存，可继续填写场景意图", { exact: true })).toBeVisible();
  await expect(page.getByAltText("产品实拍图 1")).toBeVisible();
  await expect(page.getByAltText("产品实拍图 2")).toBeVisible();
  const api = adminContext.request;
  const photos = await db.asset.findMany({ where: { productId, type: "photo" } });
  await page.getByTestId(`reference-${photos[0].id}`).dragTo(page.getByTestId(`reference-${photos[1].id}`));
  await expect(page.getByText("参考图顺序已保存", { exact: true })).toBeVisible();
  expect((await (await api.get(`/api/products/${productId}`)).json()).product.photos.map((photo: { id: string }) => photo.id)).toEqual([photos[1].id, photos[0].id]);
  await page.reload();
  await expect(page.locator(".reference-card").first()).toHaveAttribute("data-testid", `reference-${photos[1].id}`);
  await page.getByRole("button", { name: "向后移动参考 1", exact: true }).click();
  await expect(page.getByText("参考图顺序已保存", { exact: true })).toBeVisible();
  const invalid = await api.post(`/api/products/${productId}/photos`, { headers: { Origin: origin }, multipart: { photos: { name: "broken.png", mimeType: "image/png", buffer: Buffer.from("not-an-image") } } });
  expect(invalid.status()).toBe(400);
  const mismatch = await api.post(`/api/products/${productId}/photos`, { headers: { Origin: origin }, multipart: { photos: { name: "wrong.jpg", mimeType: "image/jpeg", buffer: png } } });
  expect(mismatch.status()).toBe(400);
  const extra = await api.post(`/api/products/${productId}/photos`, { headers: { Origin: origin }, multipart: { photos: { name: "third.png", mimeType: "image/png", buffer: png } } });
  expect(extra.status()).toBe(201);
  const fourth = await api.post(`/api/products/${productId}/photos`, { headers: { Origin: origin }, multipart: { photos: { name: "fourth.png", mimeType: "image/png", buffer: png } } });
  expect(fourth.status()).toBe(400);
  await page.reload();
  await page.getByRole("button", { name: "删除参考 3", exact: true }).click();
  await expect(page.getByText("实拍图已删除，历史生成记录保留", { exact: true })).toBeVisible();
  await expect(page.locator(".reference-card")).toHaveCount(2);
  await page.getByLabel("实拍参考图", { exact: true }).setInputFiles([{ name: "replacement.png", mimeType: "image/png", buffer: png }]);
  await expect(page.getByText("实拍图已保存，可继续填写场景意图", { exact: true })).toBeVisible();
  await expect(page.locator(".reference-card")).toHaveCount(3);
  const scene = page.locator(".scene-panel");
  await expect(scene.locator('input[name="scene-aspectRatio"]')).toHaveCount(15);
  await scene.getByRole("radio", { name: "4K 9 积分" }).check();
  await expect(scene.locator(".generation-spec")).toContainText("4K");
  await expect(scene.locator(".generation-spec")).toContainText("9 积分");
  await scene.getByRole("radio", { name: "21:9", exact: true }).check();
  await scene.getByLabel("想把产品放进怎样的空间？").fill("模拟 4K 宽幅场景，仅用于参数验收");
  let scenePayload: Record<string, unknown> | undefined;
  const scenePath = `**/api/products/${productId}/generations`;
  await page.route(scenePath, async (route) => { if (route.request().method() !== "POST") { await route.continue(); return; } scenePayload = route.request().postDataJSON(); await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ jobId: "ui-scene-simulation" }) }); });
  await scene.getByRole("button", { name: "生成一张场景图" }).click();
  await expect(scene.getByRole("status")).toContainText("任务已加入队列");
  expect(scenePayload).toMatchObject({ resolution: "4K", aspectRatio: "21:9" });
  await page.unroute(scenePath);
  const invalidScene = await api.post(`/api/products/${productId}/generations`, { headers: { Origin: origin }, data: { sceneIntent: "测试", aspectRatio: "7:5" } });
  expect(invalidScene.status()).toBe(400);
  const crossOrigin = await api.post(`/api/products/${productId}/generations`, { headers: { Origin: "https://example.invalid" }, data: { sceneIntent: "测试" } });
  expect(crossOrigin.status()).toBe(403);
  // 不提交真实生图：模拟记录直接落库，仅验证显示、刷新留存与鉴权下载。
  const product = await db.product.findUniqueOrThrow({ where: { id: productId } });
  const storage = new S3Client({ endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION || "us-east-1", forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! } });
  const generatedKey = `verification/e2e-${runId}/generated.png`;
  await storage.send(new PutObjectCommand({ Bucket: "assets", Key: generatedKey, Body: png, ContentType: "image/png" })); storage.destroy();
  const generated = await db.asset.create({ data: { productId, createdById: product.createdById, type: "generated", width: 64, height: 64, storageKey: generatedKey } });
  const job = await db.generationJob.create({ data: { productId, createdById: product.createdById, logicalModel: "scene-main", provider: "simulation", model: "模拟测试记录", cost: 0, status: "success", input: { sceneIntent: "模拟场景记录，仅用于 UI 验收", resolution: "2K", aspect_ratio: "1:1" }, resultAssetIds: [generated.id], completedAt: new Date() } });
  await page.reload();
  await expect(page.getByTestId(`generation-${job.id}`)).toContainText("模拟场景记录");
  await expect(page.getByLabel("产品身份特征", { exact: true })).toHaveValue("模拟身份已确认：双门四脚，两个黑色把手，纹理一致");
  const result = await api.get(`/api/products/${productId}/generations`);
  expect(result.status()).toBe(200); expect((await result.json()).product.jobs[0].id).toBe(job.id);
  const download = await api.get(`/api/assets/${photos[0].id}?download=1`);
  expect(download.status()).toBe(200); expect(download.headers()["content-disposition"]).toContain("attachment");
  expect(download.headers()["cache-control"]).toBe("private, no-store");
  await page.getByTestId(`generation-${job.id}`).getByRole("button", { name: "二次编辑", exact: true }).click();
  const editPanel = page.getByRole("region", { name: "二次编辑面板" });
  await expect(editPanel.getByAltText("二次编辑原图")).toHaveAttribute("src", `/api/assets/${generated.id}`);
  await editPanel.getByLabel("这张图需要怎样修改？").fill("保留产品，将墙面改为暖白色");
  await editPanel.getByRole("radio", { name: "4K 9 积分" }).check();
  await editPanel.getByRole("radio", { name: "自动", exact: true }).check();
  // 拦截最终付费请求，只验证选中原图和用户选择送达；真实队列/版本由隔离测试覆盖。
  let editingPayload: Record<string, unknown> | undefined;
  await page.route(`**/api/products/${productId}/edits`, async (route) => { editingPayload = route.request().postDataJSON(); await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ jobId: "ui-simulation-only" }) }); });
  await editPanel.getByRole("button", { name: "生成编辑版本" }).click();
  await expect(editPanel.getByRole("status")).toContainText("编辑任务已加入队列");
  expect(editingPayload).toMatchObject({ sourceJobId: job.id, sourceAssetId: generated.id, editIntent: "保留产品，将墙面改为暖白色", resolution: "4K", aspectRatio: "auto" });
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
  for (const path of ["", "/photos", "/generations", "/identity"]) {
    const denied = path ? await viewerContext.request.post(`/api/products/${productId}${path}`, { headers: { Origin: origin }, data: {} }) : await viewerContext.request.patch(`/api/products/${productId}`, { headers: { Origin: origin }, data: {} });
    expect(denied.status()).toBe(403);
  }
  expect((await viewerContext.request.delete(`/api/products/${productId}/photos/${photos[0].id}`, { headers: { Origin: origin } })).status()).toBe(403);
  expect((await viewerContext.request.patch(`/api/products/${productId}/photos`, { headers: { Origin: origin }, data: { photoIds: [photos[0].id, photos[1].id] } })).status()).toBe(403);
  expect((await viewerContext.request.post(`/api/products/${productId}/edits`, { headers: { Origin: origin }, data: {} })).status()).toBe(403);
  const anonymous = await browser.newContext(); contexts.push(anonymous);
  for (const path of [`/api/products/${productId}/generations`, `/api/assets/${photos[0].id}`]) expect((await anonymous.request.get(path)).status()).toBe(401);
  expect((await anonymous.request.post(`/api/products/${productId}/generations`, { data: {} })).status()).toBe(401);
});
