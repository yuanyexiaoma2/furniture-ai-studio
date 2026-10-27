import "dotenv/config";
import {test,expect} from "@playwright/test";
import {randomUUID} from "node:crypto";
import bcrypt from "bcrypt";
import sharp from "sharp";
import {PrismaPg} from "@prisma/adapter-pg";
import {PrismaClient} from "../src/generated/prisma/client";
import {S3Client,PutObjectCommand,DeleteObjectCommand} from "@aws-sdk/client-s3";
import {fixture} from "./fixtures/visual-plan";
import {composeVisualSlot,validateVisualPlan} from "../src/lib/visual-plan-rules";

test("视觉方案卡编辑与冻结、版本对比回退、画布框选要求（零付费请求）",async({page})=>{
 if(!process.env.DATABASE_URL||!["localhost","127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname))throw Error("只允许本地验收");
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})}),run=randomUUID(),password=randomUUID();let userId="",productId="";
 const storage=new S3Client({endpoint:process.env.S3_ENDPOINT,region:process.env.S3_REGION||"us-east-1",forcePathStyle:true,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID!,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY!}});
 try{
  const user=await db.user.create({data:{name:"视觉方案验收",email:run+"@example.invalid",passwordHash:await bcrypt.hash(password,12),monthlyQuota:0}});userId=user.id;
  const product=await db.product.create({data:{sku:"UI-"+run,name:"视觉方案测试架",category:"鞋架",dimensions:"未知",materials:"木",colors:"木色",sellingPoints:[],createdById:userId}});productId=product.id;
  const png=await sharp({create:{width:256,height:256,channels:3,background:"#d9c9ae"}}).png().toBuffer();
  async function asset(type:"photo"|"generated",suffix:string){const storageKey="verification/visual-ui/"+run+"/"+suffix+".png";await storage.send(new PutObjectCommand({Bucket:"assets",Key:storageKey,Body:png,ContentType:"image/png"}));return db.asset.create({data:{productId,createdById:userId,type,storageKey,width:256,height:256}});}
  const photo=await asset("photo","input"),session=await db.agentSession.create({data:{productId,createdById:userId,settings:{agentId:"agent-zenmux-flash",imageId:"image-banana",imageIds:["image-banana"],auto:false}}});
  const plan=validateVisualPlan({...fixture,productId,identityLock:{...fixture.identityLock,referenceAssetIds:[photo.id]}}),card=await db.agentCard.create({data:{sessionId:session.id,kind:"pack",data:{visualPlan:JSON.parse(JSON.stringify(plan)),reason:plan.reason,slots:plan.slots.map(s=>({name:s.name,slotType:s.slotType,method:"ai_scene",goal:composeVisualSlot(s),candidateCount:1,aspectRatio:"1:1",reason:s.sellingPoint}))}}});
  await page.goto("/login");await page.getByLabel("公司邮箱").fill(user.email);await page.getByLabel("密码",{exact:true}).fill(password);await page.getByRole("button",{name:"进入工作台"}).click();await expect(page).toHaveURL(/\/$/);
  await page.goto("/workspace?sku="+productId);await expect(page.getByRole("heading",{name:"先核对画面，再开始生成"})).toBeVisible();
  await page.getByLabel("门厅 场景（可直接替换）",{exact:true}).fill("入户玄关");await page.getByLabel("门厅备注",{exact:true}).fill("保持空间清爽");
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
  expect(await db.llmCall.count({where:{productId}})).toBe(0);expect(await db.generationJob.count({where:{productId}})).toBe(2);
 }finally{
  if(productId){const assets=await db.asset.findMany({where:{productId}});for(const a of assets)await storage.send(new DeleteObjectCommand({Bucket:"assets",Key:a.storageKey}));await db.generationJob.deleteMany({where:{productId}});await db.imagePack.deleteMany({where:{productId}});await db.productProfile.deleteMany({where:{productId}});await db.productIdentityVersion.deleteMany({where:{productId}});await db.asset.deleteMany({where:{productId}});await db.product.delete({where:{id:productId}});}if(userId)await db.user.delete({where:{id:userId}});storage.destroy();await db.$disconnect();
 }
});
