import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

await mkdir(".local/verification", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  for (const path of ["/", "/templates", "/admin", "/admin/users", "/missing-page"]) {
    await page.goto(`http://localhost:3000${path}`);
    await page.waitForURL("http://localhost:3000/login");
  }
  await page.getByRole("heading", { name: "登录你的账号" }).waitFor();
  await page.screenshot({ path: ".local/verification/login-desktop.png", fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".local/verification/login-mobile.png", fullPage: true, animations: "disabled" });
  if (!await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)) throw new Error("移动页面横向溢出");
  console.log("未登录页面均跳转登录页；登录页桌面、移动端渲染通过");
} finally { await browser.close(); }
