import "dotenv/config";
import {test,expect,type Page} from "@playwright/test";
import {randomUUID} from "node:crypto";
import bcrypt from "bcrypt";
import sharp from "sharp";
import {PrismaClient} from "../src/generated/prisma/client";
import {PrismaPg} from "@prisma/adapter-pg";
import {S3Client,PutObjectCommand,DeleteObjectCommand} from "@aws-sdk/client-s3";

test("首批融合：刷新恢复布局和便签、选图引用、进度留存及版本冲突（本地模拟）",async({page})=>{
 if(!process.env.DATABASE_URL||!["localhost","127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname))throw Error("只允许本地验证");
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})}),run=randomUUID(),email=`canvas-browser-${run}@example.invalid`,password=randomUUID()+"-test";
 const s3=new S3Client({endpoint:process.env.S3_ENDPOINT,region:process.env.S3_REGION??"us-east-1",forcePathStyle:true,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID!,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY!}}),keys:string[]=[];
 let userId="",productId="";const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 try{
  userId=(await db.user.create({data:{name:"画布体验验证",email,passwordHash:await bcrypt.hash(password,12),monthlyQuota:5}})).id;
  productId=(await db.product.create({data:{sku:"E2E-CANVAS-"+run,name:"画布体验验证柜",category:"收纳柜",dimensions:"待核实",materials:"木",colors:"木色",sellingPoints:[],createdById:userId}})).id;
  const assets:string[]=[];
  for(const [i,type]of(["photo","generated","generated"] as const).entries()){const key=`verification/canvas/${run}/${i}.png`;keys.push(key);const bytes=await sharp({create:{width:i?2048:256,height:i?1536:256,channels:3,background:i?"#c1ccc0":"#dfc5a0"}}).png().toBuffer();await s3.send(new PutObjectCommand({Bucket:"assets",Key:key,Body:bytes,ContentType:"image/png"}));assets.push((await db.asset.create({data:{productId,createdById:userId,type,storageKey:key,width:i?2048:256,height:i?1536:256}})).id);}
  const session=await db.agentSession.create({data:{productId,createdById:userId}}),pack=await db.imagePack.create({data:{productId}}),slot=await db.imageSlot.create({data:{packId:pack.id,name:"客厅场景",slotType:"scene",method:"ai_scene",order:1,goal:"模拟场景"}});
  await db.generationJob.create({data:{productId,slotId:slot.id,sessionId:session.id,createdById:userId,logicalModel:"scene-main",provider:"simulation",model:"本地模拟",status:"success",resultAssetIds:[assets[1]],input:{},costUsd:0,costEstimated:false,completedAt:new Date()}});
  const pendingJob=await db.generationJob.create({data:{productId,slotId:slot.id,sessionId:session.id,createdById:userId,logicalModel:"scene-main",provider:"simulation",model:"本地模拟",status:"pending",input:{}}});
  await db.agentToolCall.create({data:{sessionId:session.id,callId:run,name:"view_images",arguments:{},result:{analysis:"已核对实拍；产品木色保持不变。"},status:"success",completedAt:new Date()}});
  await db.agentToolCall.create({data:{sessionId:session.id,callId:run+"-failed",name:"web_search",arguments:{},status:"failed",error:"联网暂未配置，可以关闭联网继续"}});
  async function login(p:Page){await p.goto("/login");await p.getByLabel("公司邮箱").fill(email);await p.getByLabel("密码",{exact:true}).fill(password);await p.getByRole("button",{name:"进入工作台"}).click();await expect(p).toHaveURL(/\/$/);}
  await login(page);const endpoint=`/api/studio/${productId}/canvas`,origin="http://localhost:3000";
  const layout={version:1,nodes:[{id:"slot-"+slot.id,x:420,y:180},{id:"job-"+pendingJob.id,x:130,y:60}],notes:[{id:"note-browser",text:"保留产品木色与五金",x:460,y:100,width:220,height:160}],hiddenIds:[],viewport:{x:100,y:80,zoom:.7}};
  expect((await page.request.put(endpoint,{headers:{Origin:origin},data:{revision:0,layout}})).status()).toBe(200);
  await page.goto(`/workspace?sku=${productId}`);
  await expect(page.getByText("布局已保存",{exact:true})).toBeAttached();await expect(page.getByLabel("画布便签")).toHaveValue("保留产品木色与五金");await expect(page.getByRole("button",{name:"缩放百分比菜单"})).toHaveText("70%");
  const picture=page.locator(`[data-picture="${assets[1]}"]`);await picture.click();await expect(page.getByLabel("本次引用图片")).toContainText("本次引用 1 张");
  // 预览读取已保存原图，不触发生图；关闭后仍保留画布选中与引用。
  await picture.getByRole("button",{name:"放大查看图片",exact:true}).click();
  const preview=page.getByRole("dialog",{name:"图片预览"});await expect(preview).toBeVisible();
  const previewImage=preview.locator("img");await expect(previewImage).toHaveAttribute("src",`/api/assets/${assets[1]}`);
  await expect(preview).toContainText("2048 × 1536 px");await expect(previewImage).toBeVisible();
  const stage=preview.locator(".p-image-preview-stage");
  await expect.poll(()=>stage.evaluate(e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1)).toBe(true);
  await preview.getByRole("button",{name:"原始尺寸",exact:true}).click();
  await expect.poll(()=>previewImage.evaluate(e=>Math.round(e.getBoundingClientRect().width))).toBe(2048);
  await expect.poll(()=>stage.evaluate(e=>e.scrollWidth>e.clientWidth&&e.scrollHeight>e.clientHeight)).toBe(true);
  await preview.getByRole("button",{name:"放大图片",exact:true}).click();await expect(preview.getByLabel("图片缩放比例")).toHaveText("125%");
  await preview.getByRole("button",{name:"原始尺寸",exact:true}).click();await expect(preview.getByLabel("图片缩放比例")).toHaveText("100%");
  await page.keyboard.press("Delete");await expect(picture).toBeVisible();
  await preview.getByRole("button",{name:"适应窗口",exact:true}).click();
  await expect.poll(()=>stage.evaluate(e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1)).toBe(true);

  await page.keyboard.press("Escape");await expect(preview).toHaveCount(0);await expect(page.getByLabel("本次引用图片")).toContainText("本次引用 1 张");
  await picture.dblclick();await expect(preview).toBeVisible();await preview.getByRole("button",{name:"关闭",exact:true}).click();await expect(preview).toHaveCount(0);
  await expect(page.getByRole("button",{name:"缩放百分比菜单"})).toHaveText("70%");
  // 暂停前端轮询，模拟正式图片先入库、自动保存仍带旧占位图的竞争时序。
  const snapshotUrl="/api/studio/"+productId,frozen=await (await page.request.get(snapshotUrl)).json();
  await page.route("**"+snapshotUrl,route=>route.fulfill({status:200,json:frozen}));
  const pendingPicture=page.getByTestId("rf__node-job-"+pendingJob.id);await expect(pendingPicture).toHaveAttribute("style",/translate\(550px, 240px\)/);
  await db.generationJob.update({where:{id:pendingJob.id},data:{status:"success",resultAssetIds:[assets[2]],costUsd:0,costEstimated:false,completedAt:new Date()}});
  await page.getByLabel("画布便签").fill("出图时刚写的便签自动保留");
  await expect.poll(async()=>((await (await page.request.get(endpoint)).json()).layout.notes[0]?.text)).toBe("出图时刚写的便签自动保留");
  const normalized=await (await page.request.get(endpoint)).json();expect(normalized.layout.nodes).toContainEqual({id:assets[2],x:130,y:60,width:240,height:220});
  await expect(pendingPicture).toBeVisible();await expect(page.locator(".t11-save-status")).toHaveCount(0);
  await page.unroute("**"+snapshotUrl);
  await expect(page.getByTestId("rf__node-"+assets[2])).toHaveAttribute("style",/translate\(550px, 240px\)/);
  await expect(page.getByLabel("画布便签")).toHaveValue("出图时刚写的便签自动保留");await expect(page.locator(".t11-save-status")).toHaveCount(0);
  const toolProgress=page.getByRole("region",{name:"创作执行进度"});await expect(toolProgress).toContainText("查看引用图片");await expect(toolProgress).toContainText("未完成");
  let requestBody:Record<string,unknown>|undefined;
  await page.route(`**/api/products/${productId}/agent`,async route=>{requestBody=route.request().postDataJSON();const body=[{type:"tool",name:"inspect_canvas",callId:"browser-stream",status:"running"},{type:"tool",name:"inspect_canvas",callId:"browser-stream",status:"success",summary:"已核对选中图片"},{type:"delta",text:"已看到你选中的候选图。"},{type:"done"}].map(e=>"data: "+JSON.stringify(e)+"\n\n").join("");await route.fulfill({status:200,contentType:"text/event-stream",body});});
  await page.getByLabel("工作台创作要求").fill("只比较选中图片，不生成");await page.getByRole("button",{name:"发送创作要求",exact:true}).click();
  await expect.poll(()=>requestBody?.canvas).toEqual({selectedIds:[assets[1]],referenceAssetIds:[assets[1]]});await expect(toolProgress).toContainText("读取画布");
  await page.getByLabel("画布便签").fill("这条便签需要刷新后保留");
  await expect.poll(async()=>((await (await page.request.get(endpoint)).json()).layout.notes[0]?.text)).toBe("这条便签需要刷新后保留");
  await page.reload();await expect(page.getByLabel("画布便签")).toHaveValue("这条便签需要刷新后保留");await expect(page.getByRole("button",{name:"缩放百分比菜单"})).toHaveText("70%");await expect(toolProgress).toContainText("查看引用图片");
  const frame=page.locator(`[data-id="slot-${slot.id}"]`);await expect(frame).toHaveAttribute("style",/translate\(420px, 180px\)/);
  // 键盘移除只隐藏当前用户布局，原始资源和其他用户的画布不受影响。
  await picture.click();await page.keyboard.press("Delete");
  await expect.poll(async()=>((await (await page.request.get(endpoint)).json()).layout.hiddenIds)).toContain(assets[1]);
  await page.reload();await expect(picture).toHaveCount(0);expect(await db.asset.count({where:{id:assets[1]}})).toBe(1);
  await page.getByLabel("添加便签（N）").click();
  await expect.poll(async()=>((await (await page.request.get(endpoint)).json()).layout.notes.length)).toBe(2);
  const savedNotes=(await (await page.request.get(endpoint)).json()).layout.notes;const addedNoteId=savedNotes.find((n:{id:string})=>n.id!=="note-browser").id;
  const notes=page.getByTestId("rf__node-"+addedNoteId).getByLabel("画布便签");await expect(notes).toHaveValue("记录这次创作的要求…");
  await notes.fill("切换页面前的最后修改");await page.getByRole("button",{name:"返回 SKU",exact:true}).click();await expect(page).toHaveURL(/\/skus$/);
  await page.goto(`/workspace?sku=${productId}`);await expect(page.getByTestId("rf__node-"+addedNoteId).getByLabel("画布便签")).toHaveValue("切换页面前的最后修改");

  const remote=await (await page.request.get(endpoint)).json();expect((await page.request.put(endpoint,{headers:{Origin:origin},data:{revision:remote.revision,layout:{...remote.layout,notes:[]}}})).status()).toBe(200);
  await page.getByLabel("画布便签").first().fill("本窗口修改");await expect(page.getByText("其他窗口修改待处理",{exact:true})).toBeVisible();expect((await (await page.request.get(endpoint)).json()).layout.notes).toEqual([]);

  expect(errors).toEqual([]);expect(await db.llmCall.count({where:{productId}})).toBe(0);
 }finally{
  if(productId){await db.generationJob.deleteMany({where:{productId}});await db.imagePack.deleteMany({where:{productId}});await db.asset.deleteMany({where:{productId}});await db.product.delete({where:{id:productId}});}if(userId)await db.user.delete({where:{id:userId}});for(const key of keys)await s3.send(new DeleteObjectCommand({Bucket:"assets",Key:key}));s3.destroy();await db.$disconnect();
 }
});
