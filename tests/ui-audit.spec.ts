import "dotenv/config";
import {test,expect} from "@playwright/test";
import {randomUUID} from "node:crypto";
import bcrypt from "bcrypt";
import sharp from "sharp";
import {mkdir} from "node:fs/promises";
import {PrismaClient} from "../src/generated/prisma/client";
import {PrismaPg} from "@prisma/adapter-pg";
import {S3Client,PutObjectCommand,DeleteObjectCommand} from "@aws-sdk/client-s3";

test("界面巡检：真实账户、窄屏切换、实拍操作、取消修图及原图蒙版（无付费调用）",async({page})=>{
 if(!process.env.DATABASE_URL||!["localhost","127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname))throw Error("仅本地验证");
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})}),run=randomUUID(),email=`ui-audit-${run}@example.invalid`,password=randomUUID();
 const s3=new S3Client({endpoint:process.env.S3_ENDPOINT,region:process.env.S3_REGION??"us-east-1",forcePathStyle:true,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID!,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY!}}),keys:string[]=[],errors:string[]=[];
 let userId="",productId="",quoted=0,submitted=0,maskSize:{width?:number;height?:number}|undefined;
 page.on("pageerror",e=>errors.push(e.message));
 try{
  userId=(await db.user.create({data:{name:"界面检查甲",email,passwordHash:await bcrypt.hash(password,12),monthlyQuota:0}})).id;
  productId=(await db.product.create({data:{sku:"E2E-UI-"+run,name:"界面巡检柜",category:"柜",dimensions:"未知",materials:"木",colors:"木色",sellingPoints:[],identityTraits:"保留木色、双门和五金",createdById:userId}})).id;
  const assets:string[]=[];for(const [i,type]of(["photo","generated"] as const).entries()){const key=`verification/ui/${run}/${i}.png`;keys.push(key);const width=i?2048:256,height=i?1536:256,bytes=await sharp({create:{width,height,channels:3,background:i?"#c1ccc0":"#dfc5a0"}}).png().toBuffer();await s3.send(new PutObjectCommand({Bucket:"assets",Key:key,Body:bytes,ContentType:"image/png"}));assets.push((await db.asset.create({data:{productId,createdById:userId,type,storageKey:key,width,height}})).id);}
  const pack=await db.imagePack.create({data:{productId}}),slot=await db.imageSlot.create({data:{packId:pack.id,name:"场景",slotType:"scene",method:"ai_scene",order:1,goal:"自然场景"}});
  await db.generationJob.create({data:{productId,slotId:slot.id,createdById:userId,logicalModel:"scene-main",provider:"simulation",model:"本地模拟",status:"success",input:{},resultAssetIds:[assets[1]],costUsd:0,completedAt:new Date()}});
  await page.setViewportSize({width:1440,height:1000});await page.goto("/login");await page.getByLabel("公司邮箱").fill(email);await page.getByLabel("密码",{exact:true}).fill(password);await page.getByRole("button",{name:"进入工作台"}).click();await expect(page).toHaveURL(/\/design-preview$/);
  const first=await Promise.all(Array.from({length:12},(_,i)=>page.request.get(`/api/studio/${productId}${i%2?"/canvas":""}`)));expect(first.map(r=>r.status())).toEqual(Array(12).fill(200));expect(await db.agentSession.count({where:{productId,createdById:userId}})).toBe(1);
  await page.getByRole("button",{name:"头像菜单"}).click();await expect(page.getByRole("menu")).toContainText("界面检查甲 · 设计师");await expect(page.getByRole("menuitem",{name:"管理后台"})).toHaveCount(0);await expect(page.getByRole("menuitem",{name:"退出登录"})).toBeVisible();await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"更多创作选项"}).click();await page.getByRole("button",{name:"图片参数",exact:true}).click();await expect(page.getByRole("combobox",{name:"分辨率"})).toBeVisible();await expect(page.getByRole("combobox",{name:"图片比例"})).toHaveCount(0);await expect(page.getByRole("combobox",{name:"生成张数"})).toHaveCount(0);await page.keyboard.press("Escape");await page.keyboard.press("Escape");
  const input=page.getByLabel("首页创作要求");await input.focus();await page.keyboard.press("Shift+Tab");await expect(input).toHaveValue("");
  // 同名文件逐个移除，剩余缩略图与真正提交的文件保持一致；拦截创建避免模型调用。
  const red=await sharp({create:{width:20,height:20,channels:3,background:"red"}}).png().toBuffer(),blue=await sharp({create:{width:20,height:20,channels:3,background:"blue"}}).png().toBuffer();
  await page.locator('input[aria-label="首页上传实拍"]').setInputFiles([{name:"same.png",mimeType:"image/png",buffer:red},{name:"same.png",mimeType:"image/png",buffer:blue}]);await expect(page.getByRole("button",{name:"删除附件 same.png",exact:true})).toHaveCount(2);await page.getByRole("button",{name:"删除附件 same.png",exact:true}).nth(1).click();
  let upload:Buffer|undefined;await page.route("**/api/studio",route=>{if(route.request().method()!=="POST")return route.continue();upload=route.request().postDataBuffer()??undefined;return route.fulfill({status:400,json:{error:"本地巡检已拦截创建"}});});await page.getByRole("button",{name:"发送并进入工作台"}).click();await expect.poll(()=>!!upload).toBe(true);expect(upload!.includes(red)).toBe(true);expect(upload!.includes(blue)).toBe(false);await page.unroute("**/api/studio");
  await page.setViewportSize({width:390,height:844});await page.goto("/design-preview/library");await expect(page.getByRole("tablist",{name:"模板库分类"})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole("tab",{name:/术语表/}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.goto(`/design-preview/workspace?sku=${productId}`);await expect(page.getByText("布局已保存",{exact:true})).toBeAttached();
  await expect(page.getByRole("button",{name:"头像菜单"})).toBeInViewport();await expect(page.getByRole("button",{name:"导出图包",exact:true})).toBeInViewport();
  const chat=page.getByLabel("工作台创作要求");await chat.fill("这条未发送的文字需要保留");await page.getByRole("tab",{name:"画布",exact:true}).click();await expect(chat).toBeHidden();await page.getByRole("tab",{name:"对话",exact:true}).click();await expect(chat).toHaveValue("这条未发送的文字需要保留");
  await mkdir(".local/verification/ui-audit",{recursive:true});await page.screenshot({path:".local/verification/ui-audit/mobile-chat.png"});
  await page.getByRole("tab",{name:"画布",exact:true}).click();await page.getByRole("button",{name:"适应屏幕",exact:true}).click();await page.screenshot({path:".local/verification/ui-audit/mobile-canvas.png"});
  await page.getByRole("button",{name:"头像菜单"}).click();await page.getByRole("menuitemradio",{name:"暗色",exact:true}).click();await expect(page.locator("html")).toHaveClass(/dark/);
  await page.locator(`[data-picture="${assets[1]}"]`).click();await page.getByRole("button",{name:"扩图",exact:true}).click();const expand=page.getByRole("dialog",{name:"扩展画面"});await expect(expand).toBeVisible();await expect(expand.getByRole("button",{name:"取消扩图"})).toBeInViewport();
  await expect.poll(()=>expand.locator(".p-expand-stage canvas").evaluate(e=>e.getBoundingClientRect().width<=innerWidth-40)).toBe(true);await page.screenshot({path:".local/verification/ui-audit/mobile-expand-dark.png"});await expand.getByRole("button",{name:"取消扩图"}).click();
  await page.getByRole("button",{name:"局部重绘",exact:true}).click();await expect(page.locator(".p-mask-tools")).toBeVisible();await expect(page.locator(".p-editor-footer").getByRole("button",{name:"取消",exact:true})).toBeInViewport();await page.locator(".p-editor-footer").getByRole("button",{name:"取消",exact:true}).click();
  await page.setViewportSize({width:1440,height:1000});await page.getByRole("button",{name:"展开对话",exact:true}).click();await page.getByRole("button",{name:"适应屏幕",exact:true}).click();
  const photo=page.locator(`[data-picture="${assets[0]}"]`),picture=page.locator(`[data-picture="${assets[1]}"]`);await photo.click();await expect(page.getByRole("button",{name:"加入对话引用",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"设为终稿",exact:true})).toHaveCount(0);
  const downloadPromise=page.waitForEvent("download");await page.getByRole("button",{name:"下载实拍",exact:true}).click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe(assets[0]+".png");
  await page.route(`**/api/studio/${productId}`,async route=>{
   const request=route.request();if(request.method()!=="POST")return route.continue();
   if(request.headers()["content-type"]?.includes("multipart/form-data")){const body=request.postDataBuffer()!,start=body.indexOf(Buffer.from([137,80,78,71,13,10,26,10])),end=body.indexOf(Buffer.from("IEND"),start)+8;maskSize=await sharp(body.subarray(start,end)).metadata();return route.fulfill({status:200,json:{assetId:"mock-mask"}});}
   const action=request.postDataJSON().action;if(action==="edit_quote"){quoted++;return route.fulfill({status:200,json:{estimatedCostUsd:.03,fingerprint:"mock-quote",warning:null}});}if(action==="edit"){submitted++;return route.fulfill({status:500,json:{error:"测试禁止提交生图"}});}return route.continue();
  });
  await picture.click();const toolbar=page.locator(".p-live-image-toolbar .p-toolbar");await expect(toolbar).toBeVisible();const bounds=await toolbar.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(640);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(1440);
  page.once("dialog",dialog=>dialog.dismiss());await page.getByRole("button",{name:"抠图",exact:true}).click();await expect.poll(()=>quoted).toBe(1);await expect(page.getByText(/假效果|假候选|修改已提交|新候选已加入画布/)).toHaveCount(0);expect(submitted).toBe(0);
  await page.getByRole("button",{name:"局部重绘",exact:true}).click();const mask=page.locator(".p-mask-editor");await expect(mask).toBeVisible();const box=await mask.boundingBox();await page.mouse.move(box!.x+box!.width*.3,box!.y+box!.height*.4);await page.mouse.down();await page.mouse.move(box!.x+box!.width*.6,box!.y+box!.height*.6,{steps:8});await page.mouse.up();
  page.once("dialog",dialog=>dialog.dismiss());await page.locator(".p-editor-footer").getByRole("button",{name:/确认/}).click();await expect.poll(()=>maskSize?.width).toBe(2048);expect(maskSize?.height).toBe(1536);await expect.poll(()=>quoted).toBe(2);await expect(mask).toBeVisible();await expect(page.locator(".p-editor-footer").getByRole("button",{name:/确认/})).toBeEnabled();expect(submitted).toBe(0);
  await page.locator(".p-editor-footer").getByRole("button",{name:"取消",exact:true}).click();await expect(mask).toHaveCount(0);await expect(page.getByText(/修改已提交|新候选已加入画布/)).toHaveCount(0);
  await page.getByRole("button",{name:"头像菜单"}).click();await page.getByRole("menuitem",{name:"退出登录"}).click();await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);expect(await db.llmCall.count({where:{createdById:userId}})).toBe(0);expect(await db.generationJob.count({where:{productId}})).toBe(1);
 }finally{if(productId){await db.generationJob.deleteMany({where:{productId}});await db.imagePack.deleteMany({where:{productId}});await db.asset.deleteMany({where:{productId}});await db.product.delete({where:{id:productId}});}if(userId)await db.user.delete({where:{id:userId}});for(const key of keys)await s3.send(new DeleteObjectCommand({Bucket:"assets",Key:key}));s3.destroy();await db.$disconnect();}
});
