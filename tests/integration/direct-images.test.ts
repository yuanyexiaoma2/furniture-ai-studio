import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import sharp from "sharp";
import {db} from "../../src/lib/db";
import {prepareDirectImage,submitDirectImage,retryDirectImage,uploadDirectImages} from "../../src/lib/direct-image-generation";
import {imageCandidate,kieImageModels} from "../../src/lib/image-models";
import type {DirectImageSelection} from "../../src/lib/direct-image-rules";
import {conversationImageState,currentEditReferences} from "../../src/lib/conversation-images";
import {deleteObject,readObject} from "../../src/lib/storage";
import {prepareEditInput} from "../../src/lib/scene-generation";

test("本地数据库：新产品原图直接处理，独立图位、原图冻结、幂等及零Agent调用",async()=>{
 assert(["localhost","127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname));
 const run=randomUUID(),user=await db.user.create({data:{email:`upload-tools-${run}@example.invalid`,name:"新产品工具隔离测试",passwordHash:"not-for-login",monthlyQuota:1}});
 const product=await db.product.create({data:{sku:"TEST-TOOLS-"+run,name:"新产品",category:"自由创作",dimensions:"",materials:"",colors:"",sellingPoints:[],createdById:user.id}});
 const asset=await db.asset.create({data:{productId:product.id,createdById:user.id,type:"style_ref",storageKey:"isolated-test/no-file",width:512,height:512}});
 const candidate=imageCandidate(kieImageModels[0]);let enqueued=0;
 const deps={db,ready:async()=>true,boss:async()=>({}) as Awaited<ReturnType<typeof import("../../src/lib/generation-queue").getBoss>>,prepare:(tx:Parameters<typeof prepareDirectImage>[0],s:DirectImageSelection)=>prepareDirectImage(tx,s,candidate,async()=>({width:512,height:512})),enqueue:async(tx:Parameters<typeof prepareDirectImage>[0],data:Parameters<typeof import("../../src/lib/scene-generation").enqueueImageJob>[1])=>{enqueued++;return(await tx.generationJob.create({data})).id;}};
 try{
  for(const edit of [{tool:"recolor" as const,sourceAssetId:asset.id,appearanceChange:{description:"黑色",environment:"keep" as const}},{tool:"expand" as const,sourceAssetId:asset.id,expansion:{width:768,height:512,offsetX:128,offsetY:0}},{tool:"cutout" as const,sourceAssetId:asset.id}]){
   const selection:DirectImageSelection={productId:product.id,modelId:"image-banana",prompt:"处理当前原图，保留产品比例",resolution:"2K",aspectRatio:"1:1",referenceAssetIds:[],edit};
   const quote=await db.$transaction(tx=>deps.prepare(tx,selection));const key=randomUUID();
   const first=await submitDirectImage(user.id,selection,quote.fingerprint,key,deps),again=await submitDirectImage(user.id,selection,quote.fingerprint,key,deps);assert.equal(first.jobId,again.jobId);
   const job=await db.generationJob.findUniqueOrThrow({where:{id:first.jobId},include:{slot:true}}),input=job.input as Record<string,unknown>;
   assert.equal(input.generationMode,"direct");assert.equal(input.sourceAssetId,asset.id);assert.equal(input.sourceJobId,undefined);assert.deepEqual(input.referenceAssetIds,[asset.id]);assert.equal(job.slot?.method,"manual_upload");
   if(edit.tool==="expand"){assert.deepEqual(input.expansion,edit.expansion);assert.equal(input.editMode,"expanded");}
  }
  assert.equal(enqueued,3);assert.equal(await db.llmCall.count({where:{createdById:user.id}}),0);
  const session=await db.agentSession.findUniqueOrThrow({where:{productId_createdById:{productId:product.id,createdById:user.id}}});assert.equal(session.confirmedPack,false);assert.equal(session.confirmedProfileId,null);
  assert.equal(await db.agentToolCall.count({where:{sessionId:session.id}}),0);assert.equal((await db.asset.findUniqueOrThrow({where:{id:asset.id}})).type,"style_ref");
 }finally{
  await db.generationJob.deleteMany({where:{createdById:user.id}});await db.imagePack.deleteMany({where:{productId:product.id}});await db.asset.deleteMany({where:{productId:product.id}});await db.product.delete({where:{id:product.id}});await db.user.delete({where:{id:user.id}});
 }
});

test("本地数据库：单张提交的额度、指纹、幂等、独立图位及零Agent调用（不入真实队列）",async()=>{
 assert(["localhost","127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname));
 const run=randomUUID(),user=await db.user.create({data:{email:`direct-${run}@example.invalid`,name:"单张生图隔离测试",passwordHash:"not-for-login",monthlyQuota:1}}),products:string[]=[];
 const candidate=imageCandidate(kieImageModels[0]),selection={modelId:"image-banana",prompt:"一把绿色椅子",aspectRatio:"1:1" as const,resolution:"2K" as const,referenceAssetIds:[]};
 let enqueueCount=0;
 const deps={db,ready:async()=>true,boss:async()=>({}) as Awaited<ReturnType<typeof import("../../src/lib/generation-queue").getBoss>>,prepare:(tx:Parameters<typeof prepareDirectImage>[0],s:Parameters<typeof prepareDirectImage>[1])=>prepareDirectImage(tx,s,candidate),enqueue:async(tx:Parameters<typeof prepareDirectImage>[0],data:Parameters<typeof import("../../src/lib/scene-generation").enqueueImageJob>[1])=>{enqueueCount++;return(await tx.generationJob.create({data})).id;}};
 try{
  const prepared=await db.$transaction(tx=>deps.prepare(tx,selection));
  await assert.rejects(submitDirectImage(user.id,selection,"stale",randomUUID(),deps),/已变化/);assert.equal(enqueueCount,0);
  const key=randomUUID(),first=await submitDirectImage(user.id,selection,prepared.fingerprint,key,deps);products.push(first.productId!);
  const second=await submitDirectImage(user.id,selection,prepared.fingerprint,key,deps);assert.equal(second.jobId,first.jobId);assert.equal(enqueueCount,1);
  const job=await db.generationJob.findUniqueOrThrow({where:{id:first.jobId},include:{slot:true}});assert.equal(job.slot?.method,"manual_upload");assert.equal(Number(job.reservedUsd),.03);assert(job.sessionId);
  const session=await db.agentSession.findUniqueOrThrow({where:{id:job.sessionId!}});assert.equal(session.confirmedProfileId,null);assert.equal(session.confirmedPack,false);
  assert.equal(await db.llmCall.count({where:{createdById:user.id}}),0);assert.equal(await db.agentToolCall.count({where:{sessionId:session.id}}),0);
  await db.generationJob.update({where:{id:job.id},data:{status:"failed",reservedUsd:0}});
  const retryKey=randomUUID(),retried=await retryDirectImage(user.id,first.productId!,job.id,retryKey,deps);
  const replay=await retryDirectImage(user.id,first.productId!,job.id,retryKey,deps);assert.equal(replay.jobId,retried.jobId);assert.equal(enqueueCount,2);
  assert.equal((await db.generationJob.findUniqueOrThrow({where:{id:retried.jobId}})).retryOfId,job.id);
  await db.user.update({where:{id:user.id},data:{monthlyQuota:0}});
  await assert.rejects(submitDirectImage(user.id,selection,prepared.fingerprint,randomUUID(),deps),/额度|配额/);assert.equal(enqueueCount,2);
 }finally{
  await db.generationJob.updateMany({where:{createdById:user.id},data:{retryOfId:null}});await db.generationJob.deleteMany({where:{createdById:user.id}});await db.imagePack.deleteMany({where:{productId:{in:products}}});await db.product.deleteMany({where:{createdById:user.id}});await db.user.delete({where:{id:user.id}});await db.$disconnect();
 }
});

test("本地数据库和存储：上传恢复复用项目，历史附件不阻断直接改图，普通失败改图重放冻结输入",async()=>{
 assert(["localhost","127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname));
 assert(["localhost","127.0.0.1"].includes(new URL(process.env.S3_ENDPOINT!).hostname));
 const user=await db.user.create({data:{email:`review-fixes-${randomUUID()}@example.invalid`,name:"审查修复隔离测试",passwordHash:"not-for-login",monthlyQuota:1}});
 const candidate=imageCandidate(kieImageModels[0]);
 let enqueued=0;
 const deps={db,ready:async()=>true,boss:async()=>({}) as Awaited<ReturnType<typeof import("../../src/lib/generation-queue").getBoss>>,enqueue:async(tx:Parameters<typeof prepareDirectImage>[0],data:Parameters<typeof import("../../src/lib/scene-generation").enqueueImageJob>[1])=>{enqueued++;return(await tx.generationJob.create({data})).id;}};
 try{
  const bytes=await sharp({create:{width:600,height:400,channels:3,background:"white"}}).jpeg().withMetadata({orientation:6}).toBuffer();
  const file=new File([new Uint8Array(bytes)],"rotated.jpg",{type:"image/jpeg"}),key=randomUUID();
  const first=await uploadDirectImages(user.id,undefined,[file],key);
  assert.deepEqual(await uploadDirectImages(user.id,undefined,[file],key),first);
  assert.equal(await db.product.count({where:{createdById:user.id}}),1);
  assert.equal(await db.asset.count({where:{createdById:user.id}}),1);
  const productId=first.productId,assetId=first.results[0].assetId!;
  const asset=await db.asset.findUniqueOrThrow({where:{id:assetId}});
  const stored=await sharp((await readObject(asset.storageKey)).bytes).metadata();
  assert.deepEqual([asset.width,asset.height,stored.width,stored.height],[400,600,400,600]);
  assert.equal(stored.orientation,undefined);
  await assert.rejects(uploadDirectImages(user.id,undefined,[new File([new Uint8Array(bytes)],"other.jpg",{type:"image/jpeg"})],key),/内容已变化/);
  const separate=await uploadDirectImages(user.id,undefined,[file],randomUUID());
  assert.notEqual(separate.productId,productId);
  const session=await db.agentSession.findFirstOrThrow({where:{productId,createdById:user.id}});
  assert.deepEqual((await conversationImageState(session.id)).assetIds,[]);
  // 模拟历史记录仍保存方向归一前的尺寸，报价读取存储中的实际像素方向。
  await db.asset.update({where:{id:assetId},data:{width:600,height:400}});
  const extent={width:500,height:650,offsetX:50,offsetY:25};
  const selection:DirectImageSelection={productId,modelId:"image-banana",prompt:"扩图保留原图",resolution:"2K",aspectRatio:"1:1",referenceAssetIds:[],edit:{tool:"expand",sourceAssetId:assetId,expansion:extent}};
  const prepared=await db.$transaction(tx=>prepareDirectImage(tx,selection,candidate));
  assert.deepEqual((prepared.input as Record<string,unknown>).expansion,extent);
  assert.match(prepared.input.prompt,/400×600/);
  const pack=await db.imagePack.create({data:{productId}});
  const slot=await db.imageSlot.create({data:{packId:pack.id,name:"修复回归",order:1,slotType:"scene",method:"ai_scene",candidateCount:1,goal:"修改",aspectRatio:"1:1"}});
  const result=await db.asset.create({data:{productId,createdById:user.id,type:"generated",storageKey:"isolated-test/no-file",width:512,height:512}});
  await db.chatMessage.create({data:{sessionId:session.id,productId,role:"user",content:{text:"历史上传附件",referenceAssetIds:[assetId]}}});
  assert.deepEqual((await conversationImageState(session.id)).unresolved,[assetId]);
  await assert.rejects(currentEditReferences(session.id,result.id),/产品图还是参考图/);
  const completed=await db.generationJob.create({data:{productId,sessionId:session.id,slotId:slot.id,createdById:user.id,status:"success",logicalModel:"scene-main",input:prepared.input,resultAssetIds:[result.id]}});
  assert.equal(await currentEditReferences(session.id,result.id),undefined);
  await assert.rejects(currentEditReferences(session.id,result.id,[{assetId,purpose:"仅参考光线"}]),/当前对话说明用途/);
  const followup=await db.$transaction(tx=>prepareEditInput(tx,productId,"调整光线","1:1","2K",{sourceJobId:completed.id,sourceAssetId:result.id},candidate));
  assert.deepEqual(followup.input.referenceAssetIds,[result.id]);
  await db.agentSession.update({where:{id:session.id},data:{confirmedProfileId:"test-profile",confirmedPack:true}});
  const frozen={...followup.input,generationMode:"planned",selectedCandidate:candidate,expansion:extent,editMode:"expanded"};
  const failed=await db.generationJob.create({data:{productId,sessionId:session.id,slotId:slot.id,createdById:user.id,status:"failed",logicalModel:"edit",input:frozen}});
  assert.equal(failed.batchId,null);
  const retries=await Promise.all([retryDirectImage(user.id,productId,failed.id,randomUUID(),deps),retryDirectImage(user.id,productId,failed.id,randomUUID(),deps)]);
  assert.deepEqual(retries[0],retries[1]);assert.equal(enqueued,1);
  const retry=await db.generationJob.findUniqueOrThrow({where:{id:retries[0].jobId}}),input=retry.input as Record<string,unknown>;
  assert.equal(retry.retryOfId,failed.id);assert.equal(retry.slotId,slot.id);assert.equal(retry.batchId,null);
  const originalInput=failed.input as Record<string,unknown>;
  for(const field of ["sourceAssetId","prompt","referenceAssetIds","selectedCandidate","expansion","aspect_ratio","resolution"])assert.deepEqual(input[field],originalInput[field]);
  assert.equal(await db.llmCall.count({where:{createdById:user.id}}),0);
 }finally{
  const assets=await db.asset.findMany({where:{createdById:user.id,type:"style_ref"}});
  for(const asset of assets)await deleteObject(asset.storageKey);
  await db.generationJob.updateMany({where:{createdById:user.id},data:{retryOfId:null}});
  await db.generationJob.deleteMany({where:{createdById:user.id}});
  await db.productDocument.deleteMany({where:{createdById:user.id}});
  await db.asset.deleteMany({where:{createdById:user.id}});
  await db.studioLibraryEntry.deleteMany({where:{kind:"studio_request",data:{path:["ownerId"],equals:user.id}}});
  await db.product.deleteMany({where:{createdById:user.id}});
  await db.user.delete({where:{id:user.id}});
  await db.$disconnect();
 }
});
