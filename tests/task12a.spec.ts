import "dotenv/config";
import {test,expect} from "@playwright/test";
import {randomUUID} from "node:crypto";
import bcrypt from "bcrypt";
import sharp from "sharp";
import {PrismaClient} from "../src/generated/prisma/client";
import {PrismaPg} from "@prisma/adapter-pg";

test("12-A：模型与费用显示、真实附件预览保留，暂停入口隐藏（零模型、零生图）",async({page})=>{
 if(!process.env.DATABASE_URL||!["localhost","127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname))throw Error("只允许本地检查");
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})}),token=randomUUID(),password=randomUUID();let userId="",businessWrites=0;
 page.on("request",request=>{const p=new URL(request.url()).pathname;if(p.startsWith("/api/")&&!p.startsWith("/api/auth/")&&request.method()!=="GET")businessWrites++;});
 try{
  const user=await db.user.create({data:{name:"12-A本地验收",email:`task12a-${token}@example.invalid`,passwordHash:await bcrypt.hash(password,12),role:"admin",monthlyQuota:0}});userId=user.id;
  await page.goto("/login");await page.getByLabel("公司邮箱").fill(user.email);await page.getByLabel("密码",{exact:true}).fill(password);await page.getByRole("button",{name:"进入工作台"}).click();await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button",{name:"智能体模型",exact:true})).toContainText("Gemini 3.8 Flash");await expect(page.getByRole("button",{name:"生图模型",exact:true})).toContainText("Nano Banana 2.1");await expect(page.getByRole("switch",{name:"联网",exact:true})).toHaveCount(0);
  await page.getByLabel("首页创作要求").fill("本地费用与预览检查，不发送");const cost=page.locator(".p-cost-estimate");await expect(cost).toBeVisible();const amount=async()=>Number((await cost.innerText()).match(/\$([\d.]+)/)?.[1]);const before=await amount();expect(before).toBeGreaterThan(0);
  await page.getByRole("button",{name:"更多创作选项",exact:true}).click();await page.getByRole("button",{name:"图片参数",exact:true}).click();await page.getByRole("combobox",{name:"分辨率",exact:true}).click();await page.getByRole("option",{name:"4K",exact:true}).click();await page.keyboard.press("Escape");await page.keyboard.press("Escape");expect(await amount()).toBeGreaterThan(before);
  const image=await sharp({create:{width:20,height:20,channels:3,background:"gray"}}).png().toBuffer();
  await page.getByLabel("首页上传实拍").setInputFiles([{name:"检查实拍.png",mimeType:"image/png",buffer:image},{name:"检查参数.txt",mimeType:"text/plain",buffer:Buffer.from("仅本地预览，不提交模型") }]);
  await expect(page.locator('.r4-attachment img[alt="检查实拍.png"]')).toHaveAttribute("src",/^data:image\/png/);await expect(page.getByRole("button",{name:"删除附件 检查参数.txt",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"删除附件 检查实拍.png",exact:true}).click();await expect(page.locator('.r4-attachment img[alt="检查实拍.png"]')).toHaveCount(0);await expect(page.getByRole("button",{name:"删除附件 检查参数.txt",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"删除附件 检查参数.txt",exact:true}).click();await expect(page.getByLabel("首页附件")).toHaveCount(0);
  await page.getByRole("link",{name:"模板库",exact:true}).click();await expect(page.getByRole("heading",{name:"模板库",exact:true})).toBeVisible();await expect(page.getByText("积累画面表达；具体产品外观由每次实拍分析决定。示例数据已排除检索。",{exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"选择文件夹",exact:true})).toHaveCount(0);await expect(page.locator(".p-pattern-card details,.p-pattern-card pre,.p-listing-import")).toHaveCount(0);
  await page.goto("/admin/models");await expect(page.getByRole("heading",{name:"模型管理",exact:true})).toBeVisible();const table=page.locator(".p-admin-table"),catalog=(await(await page.request.get("/api/studio/models?admin=1")).json()).models as {name:string}[];
  for(const name of ["Gemini 3.8 Flash","Nano Banana 2.1","Qwen3"]){const expected=catalog.filter(m=>m.name===name).length;expect(expected).toBeGreaterThan(0);const labels=table.getByText(name,{exact:true});await expect(labels).toHaveCount(expected);for(let i=0;i<expected;i++)await expect(labels.nth(i)).toBeVisible();}
  await page.getByRole("textbox",{name:"后台搜索",exact:true}).fill("Qwen3");await expect(table.locator("tbody tr")).toHaveCount(catalog.filter(m=>m.name.toLowerCase().includes("qwen3")).length);await expect(table.getByText("Qwen3",{exact:true})).toBeVisible();await expect(page.getByText("$30.50",{exact:true})).toHaveCount(0);
  expect(businessWrites).toBe(0);expect(await db.llmCall.count({where:{createdById:userId}})).toBe(0);expect(await db.generationJob.count({where:{createdById:userId}})).toBe(0);
 }finally{if(userId)await db.user.delete({where:{id:userId}});await db.$disconnect();}
});
