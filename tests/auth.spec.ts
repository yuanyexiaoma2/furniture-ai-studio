import "dotenv/config";
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const runId = randomBytes(8).toString("hex");
const designerEmail = `e2e-designer-${runId}@example.invalid`;
const viewerEmail = `e2e-viewer-${runId}@example.invalid`;
const password = randomBytes(24).toString("base64url");
const newPassword = randomBytes(24).toString("base64url");
const createdIds: string[] = [];
let db: PrismaClient;
const contexts: BrowserContext[] = [];

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("公司邮箱").fill(email);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "进入工作台" }).click();
  await expect(page).toHaveURL("http://localhost:3000/design-preview");
  await expect(page.getByRole("heading", { name: "制作产品图片" })).toBeVisible();
}

async function createUser(page: Page, name: string, email: string, role: string) {
  await page.getByLabel("姓名", { exact: true }).fill(name);
  await page.getByLabel("邮箱", { exact: true }).fill(email);
  await page.getByLabel("初始密码").fill(password);
  await page.getByLabel("角色", { exact: true }).selectOption(role);
  await page.getByLabel("部门（可选）").fill("验收临时账号");
  const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/admin/users") && response.request().method() === "POST");
  await page.getByRole("button", { name: "创建用户" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  const payload = await response.json();
  createdIds.push(payload.user.id);
  expect("passwordHash" in payload.user).toBe(false);
  await expect(page.getByTestId(`user-${email}`)).toBeVisible();
}

test.beforeAll(async () => {
  if (!process.env.DATABASE_URL || !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) throw new Error("验收需要填写本地 .env 的数据库和管理员账号");
  const hostname = new URL(process.env.DATABASE_URL).hostname;
  if (!["localhost", "127.0.0.1"].includes(hostname)) throw new Error("此验收脚本仅允许本地数据库");
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  await mkdir(".local/verification", { recursive: true });
});

test.afterAll(async () => {
  for (const context of contexts) await context.close();
  if (db) {
    // 只删除本次通过界面创建并记录了 ID 的临时账号。
    if (createdIds.length) await db.user.deleteMany({ where: { id: { in: createdIds }, email: { in: [designerEmail, viewerEmail] } } });
    await db.$disconnect();
  }
});

test("完整验收：登录、用户创建、角色限制、密码重置与会话撤销", async ({ browser }) => {
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  contexts.push(adminContext);
  const admin = await adminContext.newPage();
  for (const path of ["/", "/templates", "/admin", "/admin/users", "/missing-page"]) {
    await admin.goto(path); await expect(admin).toHaveURL(/\/login(?:\?.*)?$/);
  }
  const unauthenticated = await adminContext.request.post("/api/admin/users", { data: {} });
  expect(unauthenticated.status()).toBe(401);
  await admin.screenshot({ path: ".local/verification/login-desktop.png", fullPage: true, animations: "disabled" });
  await admin.getByLabel("公司邮箱").fill(`unknown-${runId}@example.invalid`);
  await admin.getByLabel("密码", { exact: true }).fill(password);
  await admin.getByRole("button", { name: "进入工作台" }).click();
  await expect(admin.getByRole("main").getByRole("alert")).toContainText("邮箱或密码不正确");
  await login(admin, process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);
  await expect(admin.getByRole("heading", { name: "制作产品图片" })).toBeVisible();
  await admin.screenshot({ path: ".local/verification/projects-desktop.png", fullPage: true, animations: "disabled" });
  await admin.goto("/templates");
  await expect(admin.getByRole("heading", { name: "即将开放" })).toBeVisible();
  await admin.goto("/admin/users");
  await createUser(admin, "验收设计师", designerEmail, "designer");
  await createUser(admin, "验收只读成员", viewerEmail, "viewer");
  await admin.screenshot({ path: ".local/verification/users-desktop.png", fullPage: true, animations: "disabled" });
  const designerRecord = await db.user.findUniqueOrThrow({ where: { email: designerEmail } });
  expect(await bcrypt.compare(password, designerRecord.passwordHash)).toBe(true);
  expect(Number(designerRecord.monthlyQuota)).toBe(0.5);
  const duplicate = await adminContext.request.post("/api/admin/users", { headers: { Origin: "http://localhost:3000" }, data: { name: "重复用户", email: designerEmail, password, role: "designer", monthlyQuota: 100 } });
  expect(duplicate.status()).toBe(409);
  const self = await db.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL!.trim().toLowerCase() } });
  const demotion = await adminContext.request.patch(`/api/admin/users/${self.id}`, { headers: { Origin: "http://localhost:3000" }, data: { action: "role", role: "viewer" } });
  expect(demotion.status()).toBe(400);
  const crossOrigin = await adminContext.request.patch(`/api/admin/users/${designerRecord.id}`, { headers: { Origin: "https://example.invalid" }, data: { action: "role", role: "admin" } });
  expect(crossOrigin.status()).toBe(403);
  await admin.getByRole("button", { name: "退出登录" }).click();
  await expect(admin).toHaveURL(/\/login(?:\?.*)?$/);
  await login(admin, designerEmail, password);
  await expect(admin.getByRole("heading", { name: "制作产品图片" })).toBeVisible();
  await loginAfterLogout(admin, process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);

  const viewerContext = await browser.newContext(); contexts.push(viewerContext);
  const viewer = await viewerContext.newPage();
  await login(viewer, viewerEmail, password);
  for (const path of ["/admin", "/admin/users", "/admin/gateways"]) {
    const response = await viewer.goto(path);
    expect(response?.status()).toBe(403);
    await expect(viewer.getByRole("heading", { name: "没有访问权限" })).toBeVisible();
  }
  const viewerWrite = await viewerContext.request.post("/api/admin/users", { headers: { Origin: "http://localhost:3000" }, data: {} });
  expect((await viewerContext.request.get("/api/admin/gateways")).status()).toBe(403);
  expect((await viewerContext.request.post("/api/admin/gateways/test", { headers: { Origin: "http://localhost:3000" }, data: { provider: "kie", kind: "image", confirmed: true } })).status()).toBe(403);
  expect(viewerWrite.status()).toBe(403);
  const viewerPatch = await viewerContext.request.patch(`/api/admin/users/${designerRecord.id}`, { headers: { Origin: "http://localhost:3000" }, data: { action: "role", role: "admin" } });
  expect(viewerPatch.status()).toBe(403);

  const designerContext = await browser.newContext(); contexts.push(designerContext);
  const designer = await designerContext.newPage();
  await login(designer, designerEmail, password);
  await admin.goto("/admin/users");
  const row = admin.getByTestId(`user-${designerEmail}`);
  await row.getByText("重置密码", { exact: true }).click();
  await row.getByLabel("新密码", { exact: true }).fill(newPassword);
  await row.getByRole("button", { name: "确认重置" }).click();
  await expect(row).toContainText("密码已重置");
  await designer.goto("/"); await expect(designer).toHaveURL(/\/login(?:\?.*)?$/);
  await designer.getByLabel("公司邮箱").fill(designerEmail);
  await designer.getByLabel("密码", { exact: true }).fill(password);
  await designer.getByRole("button", { name: "进入工作台" }).click();
  await expect(designer.getByRole("main").getByRole("alert")).toContainText("邮箱或密码不正确");
  await login(designer, designerEmail, newPassword);
  await row.getByLabel("验收设计师的角色").selectOption("viewer");
  await row.getByRole("button", { name: "保存角色" }).click();
  await expect(row).toContainText("角色已更新");
  await designer.goto("/"); await expect(designer).toHaveURL(/\/login(?:\?.*)?$/);
  await login(designer, designerEmail, newPassword);
  expect((await designer.goto("/admin"))?.status()).toBe(403);
  await admin.setViewportSize({ width: 390, height: 844 });
  await admin.goto("/");
  await expect(admin.getByRole("heading", { name: "制作产品图片" })).toBeVisible();
  expect(await admin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await admin.screenshot({ path: ".local/verification/projects-mobile.png", fullPage: true, animations: "disabled" });
});

async function loginAfterLogout(page: Page, email: string, password: string) {
  await page.goto("/templates");
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
  await login(page, email, password);
}
