import "dotenv/config";
import {test,expect} from "@playwright/test";
import {randomBytes} from "node:crypto";
import bcrypt from "bcrypt";
import {PrismaPg} from "@prisma/adapter-pg";
import {PrismaClient} from "../src/generated/prisma/client";

test("正式入口与旧路径301：保留登录回跳和查询参数，默认隐藏原型入口",async({page,request})=>{
 if (!process.env.DATABASE_URL || !["localhost","127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname)) throw Error("只允许本地导航验收");
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});
 const email="e2e-navigation-"+randomBytes(8).toString("hex")+"@example.invalid",password=randomBytes(24).toString("base64url");
 let userId:string|undefined;
 try {
  userId=(await db.user.create({data:{name:"导航验收临时账号",email,passwordHash:await bcrypt.hash(password,12),monthlyQuota:0}})).id;
  for(const [from,to] of [["/design-preview","/"],["/design-preview/skus","/skus"],["/design-preview/workspace?sku=example&export=1","/workspace?sku=example&export=1"],["/design-preview/library?tab=scene","/library?tab=scene"],["/design-preview/admin","/admin/models"]]){
   const response=await request.get(from,{maxRedirects:0});expect(response.status()).toBe(301);const location=new URL(response.headers().location,response.url());expect(location.pathname+location.search).toBe(to);
  }
  await page.goto("/skus");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fskus$/);
  await page.getByLabel("公司邮箱").fill(email);await page.getByLabel("密码",{exact:true}).fill(password);await page.getByRole("button",{name:"进入工作台"}).click();
  await expect(page).toHaveURL(/\/skus$/);await expect(page.getByRole("heading",{name:"全部 SKU",exact:true})).toBeVisible();
  await page.goto("/");await expect(page).toHaveURL(/\/$/);await expect(page.getByRole("heading",{name:"制作产品图片",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:/批量.*颜色|多语言|导出前检查/})).toHaveCount(0);
  await expect(page.getByRole("link",{name:"模板库",exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"场景模板",exact:true})).toHaveCount(0);
  await page.goto("/login");await expect(page).toHaveURL(/\/$/);
  await page.goto("/login?callbackUrl=%2Fdesign-preview%2Flibrary");await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole("heading",{name:"模板库",exact:true})).toBeVisible();
  expect((await page.request.get("/design")).status()).toBe(404);
  expect((await page.request.get("/admin/models")).status()).toBe(403);
  await page.context().clearCookies();await page.goto("/login");
  await page.getByLabel("公司邮箱").fill(email);await page.getByLabel("密码",{exact:true}).fill(password);await page.getByRole("button",{name:"进入工作台"}).click();
  await expect(page).toHaveURL(/\/$/);await expect(page.getByRole("heading",{name:"制作产品图片",exact:true})).toBeVisible();

  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 } finally {if(userId)await db.user.delete({where:{id:userId}});await db.$disconnect();}
});
