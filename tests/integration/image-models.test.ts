import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {db} from "../../src/lib/db";
import {studioCatalog,selectedCandidate} from "../../src/lib/studio-models";
import {kieImageModels} from "../../src/lib/image-models";
import {fixture} from "../fixtures/visual-plan";
import {prepareSceneInput,prepareEditInput} from "../../src/lib/scene-generation";

test("真实模型目录及场景/修图报价：ZenMux智能体、五个KIE模型和Qwen蒙版（不提交任务）",async()=>{
 if(!process.env.DATABASE_URL||!["localhost","127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname))throw Error("仅本地验证");
 const run=randomUUID();let userId="",productId="";
 try{
  const catalog=await studioCatalog();for(const spec of kieImageModels)assert(catalog.some(m=>m.id===spec.id&&m.provider==="kie"));
  assert.equal((await selectedCandidate("agent",{})).provider,"zenmux");assert.equal((await selectedCandidate("image",{})).provider,"kie");
  userId=(await db.user.create({data:{name:"模型适配验证",email:`image-model-${run}@example.invalid`,passwordHash:"not-a-login",monthlyQuota:0}})).id;
  productId=(await db.product.create({data:{sku:"E2E-IMAGES-"+run,name:"本地验证柜",category:"柜",dimensions:"未知",materials:"木",colors:"木色",sellingPoints:[],identityTraits:"木色柜体，两扇柜门，保留黑色五金",createdById:userId}})).id;
  const photos=[];for(let i=0;i<3;i++)photos.push(await db.asset.create({data:{productId,createdById:userId,type:"photo",storageKey:`verification/image-models/${run}/${i}`,width:2000,height:2000,sortOrder:i}}));
  const source=await db.asset.create({data:{productId,createdById:userId,type:"generated",storageKey:`verification/image-models/${run}/source`,width:2000,height:2000}}),mask=await db.asset.create({data:{productId,createdById:userId,type:"mask",storageKey:`verification/image-models/${run}/mask`,width:2000,height:2000}});
  const job=await db.generationJob.create({data:{productId,createdById:userId,logicalModel:"scene-main",provider:"simulation",model:"本地模拟",status:"success",input:{},resultAssetIds:[source.id],costUsd:0}});
  const plan={...fixture,productId,identityLock:{...fixture.identityLock,referenceAssetIds:photos.map(p=>p.id)}};const frozen={plan,slot:plan.slots[0]};
  for(const spec of kieImageModels){const candidate=await selectedCandidate("image",{auto:false,imageId:spec.id});assert.equal(candidate.model,spec.model);
   const scene=await db.$transaction(tx=>prepareSceneInput(tx,productId,"自然客厅","1:1",candidate,"2K",frozen));assert.equal(scene.input.referenceAssetIds.length,3);assert(scene.estimate>0);
   const edit=await db.$transaction(tx=>prepareEditInput(tx,productId,"只调整背景光线","1:1","2K",{sourceJobId:job.id,sourceAssetId:source.id},candidate,[mask.id]));assert.equal(edit.input.referenceAssetIds[0],source.id);assert.equal(edit.input.referenceAssetIds[1],mask.id);assert.match(edit.input.prompt,/第二张参考图是黑白蒙版/);
   if(spec.id==="image-qwen3"){assert.deepEqual(edit.input.referenceAssetIds,[source.id,mask.id,photos[0].id]);assert.equal(edit.estimate,.0315);await assert.rejects(db.$transaction(tx=>prepareSceneInput(tx,productId,"场景","1:1",candidate,"4K",frozen)),/不支持4K/);}
  }
  assert.equal(await db.generationJob.count({where:{productId}}),1);assert.equal(await db.llmCall.count({where:{productId}}),0);
 }finally{if(productId){await db.generationJob.deleteMany({where:{productId}});await db.asset.deleteMany({where:{productId}});await db.product.delete({where:{id:productId}});}if(userId)await db.user.delete({where:{id:userId}});await db.$disconnect();}
});
