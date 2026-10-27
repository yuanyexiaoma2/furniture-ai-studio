import "dotenv/config";
import {test,expect} from "@playwright/test";
import {randomBytes} from "node:crypto";
import bcrypt from "bcrypt";
import {mkdir} from "node:fs/promises";
import {PrismaPg} from "@prisma/adapter-pg";
import {PrismaClient} from "../src/generated/prisma/client";

test("新版入口：登录回到请求的工作页，根路径和默认登录进入新版首页",async({page})=>{
 if (!process.env.DATABASE_URL || !["localhost","127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname)) throw Error("只允许本地导航验收");
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});
 const email="e2e-navigation-"+randomBytes(8).toString("hex")+"@example.invalid",password=randomBytes(24).toString("base64url");
 let userId:string|undefined;
 try {
  userId=(await db.user.create({data:{name:"导航验收临时账号",email,passwordHash:await bcrypt.hash(password,12),monthlyQuota:0}})).id;
  await page.goto("/design-preview/skus");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdesign-preview%2Fskus$/);
  await page.getByLabel("公司邮箱").fill(email);await page.getByLabel("密码",{exact:true}).fill(password);await page.getByRole("button",{name:"进入工作台"}).click();
  await expect(page).toHaveURL(/\/design-preview\/skus$/);await expect(page.getByRole("heading",{name:"全部 SKU",exact:true})).toBeVisible();
  await page.goto("/");await expect(page).toHaveURL(/\/design-preview$/);await expect(page.getByRole("heading",{name:"制作产品图片",exact:true})).toBeVisible();
  await page.goto("/login");await expect(page).toHaveURL(/\/design-preview$/);
  await page.goto("/login?callbackUrl=%2Fdesign-preview%2Flibrary");await expect(page).toHaveURL(/\/design-preview\/library$/);
  await page.context().clearCookies();await page.goto("/login");
  await page.getByLabel("公司邮箱").fill(email);await page.getByLabel("密码",{exact:true}).fill(password);await page.getByRole("button",{name:"进入工作台"}).click();
  await expect(page).toHaveURL(/\/design-preview$/);await expect(page.getByRole("heading",{name:"制作产品图片",exact:true})).toBeVisible();
  await mkdir(".local/verification",{recursive:true});await page.screenshot({path:".local/verification/navigation-new-home.png",fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 } finally {if(userId)await db.user.delete({where:{id:userId}});await db.$disconnect();}
});
