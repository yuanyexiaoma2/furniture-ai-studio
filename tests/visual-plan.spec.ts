import "dotenv/config";
import {test,expect} from "@playwright/test";
import {mkdir,writeFile,rm} from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
import bcrypt from "bcrypt";
import sharp from "sharp";
import {PrismaPg} from "@prisma/adapter-pg";
import {PrismaClient} from "../src/generated/prisma/client";
import {S3Client,PutObjectCommand,DeleteObjectCommand} from "@aws-sdk/client-s3";
import {fixture} from "./fixtures/visual-plan";
import {composeVisualSlot,validateVisualPlan} from "../src/lib/visual-plan-rules";

test("视觉方案方向与池子、冻结差异、版本回退、竞品输入与文件夹审核（零付费请求）",async({page})=>{
 if(!process.env.DATABASE_URL||!["localhost","127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname))throw Error("只允许本地验收");
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})}),run=randomUUID(),password=randomUUID();let userId="",productId="";
 const storage=new S3Client({endpoint:process.env.S3_ENDPOINT,region:process.env.S3_REGION||"us-east-1",forcePathStyle:true,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID!,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY!}});
 try{
  const user=await db.user.create({data:{name:"视觉方案验收",email:run+"@example.invalid",passwordHash:await bcrypt.hash(password,12),monthlyQuota:0}});userId=user.id;
  const product=await db.product.create({data:{sku:"UI-"+run,name:"视觉方案测试架",category:"鞋架",dimensions:"未知",materials:"木",colors:"木色",sellingPoints:[],createdById:userId}});productId=product.id;
  const png=await sharp({create:{width:256,height:256,channels:3,background:"#d9c9ae"}}).png().toBuffer();
  async function asset(type:"photo"|"generated",suffix:string){const storageKey="verification/visual-ui/"+run+"/"+suffix+".png";await storage.send(new PutObjectCommand({Bucket:"assets",Key:storageKey,Body:png,ContentType:"image/png"}));return db.asset.create({data:{productId,createdById:userId,type,storageKey,width:256,height:256}});}
  const photo=await asset("photo","input"),session=await db.agentSession.create({data:{productId,createdById:userId,settings:{agentId:"agent-zenmux-flash",imageId:"image-banana",imageIds:["image-banana"],auto:false}}});
  const baseSlot=fixture.slots[0],plan=validateVisualPlan({...fixture,propPool:["编织篮","花瓶"],scenePool:["门厅","入户玄关","墙角"],slots:[{...baseSlot,key:"4",selectedDirectionId:null,directions:[{...baseSlot,id:"a",label:"方向A",reason:"贴近日常进出"},{...baseSlot,id:"b",label:"方向B",reason:"突出墙角利用",scene:"墙角"}]}],productId,identityLock:{...fixture.identityLock,referenceAssetIds:[photo.id]}}),card=await db.agentCard.create({data:{sessionId:session.id,kind:"pack",data:{visualPlan:JSON.parse(JSON.stringify(plan)),reason:plan.reason,slots:plan.slots.map(s=>({name:s.name,slotType:s.slotType,method:"ai_scene",goal:composeVisualSlot(s),candidateCount:1,aspectRatio:"1:1",reason:s.sellingPoint}))}}});
  await page.goto("/login");await page.getByLabel("公司邮箱").fill(user.email);await page.getByLabel("密码",{exact:true}).fill(password);await page.getByRole("button",{name:"进入工作台"}).click();await expect(page).toHaveURL(/\/$/);
  await page.goto("/workspace?sku="+productId);await expect(page.getByRole("heading",{name:"先核对画面，再开始生成"})).toBeVisible();
  await expect(page.getByRole("button",{name:"确认并冻结方案"})).toBeDisabled();await page.getByRole("button",{name:/方向B/}).click();await expect(page.getByRole("button",{name:/方向B/})).toHaveAttribute("aria-pressed","true");
  await page.getByLabel("门厅 场景（可直接替换）",{exact:true}).selectOption("入户玄关");await page.getByLabel("门厅备注",{exact:true}).fill("保持空间清爽");
  await page.getByRole("button",{name:"确认并冻结方案"}).click();await expect(page.getByRole("heading",{name:"先核对画面，再开始生成"})).toHaveCount(0);
  const slot=await db.imageSlot.findFirstOrThrow({where:{pack:{productId}}}),snapshot=slot.visualPlan as {plan:typeof plan;slot:typeof plan.slots[0]};expect(snapshot.slot.scene).toBe("入户玄关");expect(snapshot.slot.notes).toBe("保持空间清爽");expect((await db.agentCard.findUniqueOrThrow({where:{id:card.id}})).status).toBe("executed");
  const original=await asset("generated","original"),edited=await asset("generated","edited");
  const source=await db.generationJob.create({data:{productId,sessionId:session.id,slotId:slot.id,createdById:userId,status:"success",logicalModel:"scene-main",input:{identityTraits:plan.identityLock.traits,visualPlan:JSON.parse(JSON.stringify(snapshot))},resultAssetIds:[original.id],completedAt:new Date()}});
  await db.generationJob.create({data:{productId,sessionId:session.id,slotId:slot.id,createdById:userId,status:"success",logicalModel:"edit",input:{sourceJobId:source.id,sourceAssetId:original.id,editMode:"whole",identityTraits:plan.identityLock.traits,visualPlan:JSON.parse(JSON.stringify(snapshot))},resultAssetIds:[edited.id],completedAt:new Date()}});
  await db.imageSlot.update({where:{id:slot.id},data:{finalAssetId:edited.id}});
  await page.reload();await page.getByText("修改版本 · 对比与回退",{exact:true}).click();await page.getByRole("button",{name:"与修改前对比"}).click();await expect(page.getByAltText("修改前",{exact:true})).toBeVisible();await expect(page.getByAltText("修改后",{exact:true})).toBeVisible();await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"回退为终稿"}).click();await expect.poll(async()=>((await db.imageSlot.findUniqueOrThrow({where:{id:slot.id}})).finalAssetId)).toBe(original.id);
  await page.getByRole("button",{name:"适应屏幕",exact:true}).click();
  await page.locator(`[data-picture="${edited.id}"]`).click();await page.getByRole("button",{name:"局部重绘",exact:true}).click();await expect(page.getByRole("button",{name:"矩形框选"})).toBeVisible();await expect(page.getByLabel("局部修改要求")).toBeVisible();await page.getByLabel("局部修改要求").fill("只替换选中的环境装饰");await page.getByRole("button",{name:"矩形框选"}).click();await page.getByRole("button",{name:"取消",exact:true}).click();
  await page.goto("/products/"+productId);await expect(page.getByRole("heading",{name:"补充图与参数文件"})).toBeVisible();await expect(page.getByRole("heading",{name:"竞品参考 · 图片优先"})).toBeVisible();
  // 初始竞品GET会恢复受控输入；等读取结束后再填值，避免测试输入被初始化结果覆盖。
  await page.waitForLoadState("networkidle");
  await page.getByLabel("竞品链接",{exact:true}).fill("https://example.invalid/competitor");await page.getByLabel("上传竞品截图",{exact:true}).setInputFiles({name:"competitor.png",mimeType:"image/png",buffer:png});await expect(page.getByText("竞品参考已保存；下次规划逐张拆解。",{exact:true})).toBeVisible();
  const research=(await db.product.findUniqueOrThrow({where:{id:productId}})).visualResearch as {inputs:{assetIds:string[];links:string[]}};expect(research.inputs.assetIds.length).toBe(1);expect(research.inputs.links).toEqual(["https://example.invalid/competitor"]);
  const importDir=path.resolve(".local/runtime/ui-listing-"+run);await mkdir(importDir,{recursive:true});await writeFile(path.join(importDir,"1.png"),png);let pendingImport=false,reviewed=false;
  const imported={id:"mock-listing-"+run,type:"case",name:"Listing导入 · UI验证",categories:["鞋架"],is_sample:false,source:"用户提供",status:"draft",content:{isListingImport:true,summary:"浏览器模拟拆解，仅验证审核交互",originalImageRefs:[photo.id],entries:[{id:"draft",type:"prop_pool",name:"道具池",categories:["鞋架"],is_sample:false,source:"用户提供",status:"draft",content:{props:["篮"]}}]}};
  await page.route("**/api/studio/library/import",async route=>{if(route.request().method()==="POST"){pendingImport=true;await route.fulfill({json:imported});}else{reviewed=true;pendingImport=false;await route.fulfill({json:{entryIds:["approved"]}});}});
  await page.route("**/api/studio/library",async route=>{const response=await route.fetch(),rows=await response.json();await route.fulfill({json:pendingImport?[...rows,imported]:rows});});
  try{await page.goto("/library");await page.getByLabel("导入品类",{exact:true}).fill("鞋架");await page.getByLabel("选择Listing文件夹",{exact:true}).setInputFiles(importDir);await expect(page.getByText("Listing导入 · UI验证 · 待审核",{exact:true})).toBeVisible();await page.getByRole("button",{name:"审核通过并入库"}).click();await expect(page.getByText("审核通过，经验已入库。",{exact:true})).toBeVisible();expect(reviewed).toBe(true);}finally{if(importDir.startsWith(path.resolve(".local/runtime")+path.sep))await rm(importDir,{recursive:true,force:true});}
  expect(await db.llmCall.count({where:{productId}})).toBe(0);expect(await db.generationJob.count({where:{productId}})).toBe(2);
 }finally{
  if(productId){const assets=await db.asset.findMany({where:{productId}});for(const a of assets)await storage.send(new DeleteObjectCommand({Bucket:"assets",Key:a.storageKey}));await db.generationJob.deleteMany({where:{productId}});await db.imagePack.deleteMany({where:{productId}});await db.productProfile.deleteMany({where:{productId}});await db.productIdentityVersion.deleteMany({where:{productId}});await db.asset.deleteMany({where:{productId}});await db.product.delete({where:{id:productId}});}if(userId)await db.user.delete({where:{id:userId}});const reviewRoot=path.resolve("docs/review"),reviewBase=path.resolve(reviewRoot,"UI-"+run);if(reviewBase.startsWith(reviewRoot+path.sep)){await rm(reviewBase+".html",{force:true});await rm(reviewBase+"-assets",{recursive:true,force:true});}storage.destroy();await db.$disconnect();
 }
});
