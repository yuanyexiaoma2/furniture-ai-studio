import "dotenv/config";
import {test,expect} from "@playwright/test";
import {randomUUID} from "node:crypto";
import bcrypt from "bcrypt";
import {PrismaClient} from "../src/generated/prisma/client";
import {PrismaPg} from "@prisma/adapter-pg";
import {mkdir} from "node:fs/promises";

test("真实目录：默认ZenMux智能体及KIE生图，新增模型选择与Qwen分辨率限制",async({page})=>{
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})}),password=randomUUID(),email=`models-${randomUUID()}@example.invalid`;let userId="";
 try{
  userId=(await db.user.create({data:{name:"模型菜单验证",email,passwordHash:await bcrypt.hash(password,12),monthlyQuota:0}})).id;
  await page.goto("/login");await page.getByLabel("公司邮箱").fill(email);await page.getByLabel("密码",{exact:true}).fill(password);await page.getByRole("button",{name:"进入工作台"}).click();await expect(page).toHaveURL(/\/design-preview$/);
  await expect(page.getByRole("button",{name:"智能体模型",exact:true})).toContainText("Gemini 3.8 Flash");await expect(page.getByRole("button",{name:"生图模型",exact:true})).toContainText("Nano Banana 2.1");
  const catalog=(await (await page.request.get("/api/studio/models")).json()).models;
  expect(catalog.find((m:{id:string})=>m.id==="agent-zenmux-flash").provider).toBe("zenmux");expect(catalog.filter((m:{kind:string})=>m.kind==="image").every((m:{provider:string})=>m.provider==="kie")).toBe(true);
  await page.getByRole("button",{name:"更多创作选项",exact:true}).click();await page.getByRole("button",{name:"图片参数",exact:true}).click();await page.getByRole("combobox",{name:"分辨率",exact:true}).click();await page.getByRole("option",{name:"4K",exact:true}).click();await page.keyboard.press("Escape");await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"生图模型",exact:true}).click();
  for(const name of ["GPT Image 2.5","Nano Banana 2","Nano Banana Pro","Qwen3"])await expect(page.getByRole("checkbox",{name,exact:true})).toBeVisible();
  await mkdir(".local/verification",{recursive:true});await page.screenshot({path:".local/verification/image-model-menu.png",fullPage:true});
  await page.getByRole("switch",{name:"自动挑选生图模型"}).click();await page.getByRole("radio",{name:"Qwen3",exact:true}).click();await page.keyboard.press("Escape");
  await expect(page.getByRole("button",{name:"生图模型",exact:true})).toContainText("Qwen3");
  await page.getByRole("button",{name:"更多创作选项",exact:true}).click();await page.getByRole("button",{name:"图片参数",exact:true}).click();await expect(page.getByRole("combobox",{name:"分辨率",exact:true})).toContainText("2K");await page.getByRole("combobox",{name:"分辨率",exact:true}).click();await expect(page.getByRole("option",{name:"4K",exact:true})).toHaveCount(0);await expect(page.getByRole("option",{name:"2K",exact:true})).toBeVisible();
  await page.keyboard.press("Escape");await page.keyboard.press("Escape");await page.keyboard.press("Escape");await page.reload();await expect(page.getByRole("button",{name:"生图模型",exact:true})).toContainText("Qwen3");
  expect(await db.llmCall.count({where:{createdById:userId}})).toBe(0);expect(await db.generationJob.count({where:{createdById:userId}})).toBe(0);
 }finally{if(userId)await db.user.delete({where:{id:userId}});await db.$disconnect();}
});
