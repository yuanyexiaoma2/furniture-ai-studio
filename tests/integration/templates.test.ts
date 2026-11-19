import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import sharp from "sharp";
import {db} from "../../src/lib/db";
import {putObject,deleteObject} from "../../src/lib/storage";
import {saveReference,listSavedReferences,updateSavedTemplate,reuseReference,templateDraft} from "../../src/lib/saved-references";
import {prepareDirectImage} from "../../src/lib/direct-image-generation";
import {directImageSchema} from "../../src/lib/direct-image-rules";
import {imageCandidate,kieImageModels} from "../../src/lib/image-models";

test("模板闭环：原提示词追溯、编辑隔离、跨产品复制、真实参考顺序及指纹（零模型调用）",async()=>{
 assert(["localhost","127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname));
 const run=randomUUID(),users:string[]=[],products:string[]=[],keys:string[]=[];let savedId="";
 try{
  for(let i=0;i<2;i++)users.push((await db.user.create({data:{email:`template-${run}-${i}@example.invalid`,name:"模板隔离测试",passwordHash:"not-for-login"}})).id);
  for(let i=0;i<2;i++)products.push((await db.product.create({data:{sku:`TPL-${run}-${i}`,name:"模板验证柜",category:"柜",dimensions:"未知",materials:"木",colors:"木色",sellingPoints:[],createdById:users[0]}})).id);
  const bytes=await sharp({create:{width:12,height:12,channels:3,background:"white"}}).png().toBuffer(),storageKey="verification/templates/"+run;keys.push(storageKey);await putObject(storageKey,bytes,"image/png");
  const source=await db.asset.create({data:{productId:products[0],createdById:users[0],type:"generated",storageKey,width:12,height:12}}),photo=await db.asset.create({data:{productId:products[1],createdById:users[0],type:"photo",storageKey:storageKey+"-photo",width:12,height:12}});
  const job=await db.generationJob.create({data:{productId:products[0],createdById:users[0],status:"success",logicalModel:"scene-main",resultAssetIds:[source.id],input:{prompt:"原始红柜生成描述",basePrompt:"红柜在玄关",resolution:"2K",visualPlan:{slot:{scene:"玄关"}}}}});
  assert.deepEqual(await templateDraft(products[0],source.id),{category:"柜",scene:"玄关",reusablePrompt:"红柜在玄关"});
  const saved=await saveReference(users[0],{productId:products[0],assetId:source.id,name:"玄关模板",category:"柜",scene:"玄关",purpose:"场景和自然光",reusablePrompt:"替换当前产品，玄关自然光"});savedId=saved.id;
  const edited=await updateSavedTemplate(users[0],saved.id,{name:"新版模板",category:"柜",scene:"客厅",purpose:"客厅光线",reusablePrompt:"当前产品置于客厅，柔和光线"});assert.equal(edited.prompt,"原始红柜生成描述");assert.equal(((await db.generationJob.findUniqueOrThrow({where:{id:job.id}})).input as {prompt:string}).prompt,"原始红柜生成描述");
  assert.equal((await listSavedReferences(users[1])).length,0);await assert.rejects(updateSavedTemplate(users[1],saved.id,{name:"冒用",purpose:"场景"}),/不属于/);await assert.rejects(reuseReference(users[1],saved.id,products[1]),/不属于/);
  const copied=await reuseReference(users[0],saved.id,products[1],undefined,{attach:false});keys.push((await db.asset.findUniqueOrThrow({where:{id:copied.assetId}})).storageKey);
  assert.equal(await db.chatMessage.count({where:{productId:products[1]}}),0);
  const candidate=imageCandidate(kieImageModels[0]),selection={productId:products[1],modelId:"image-banana",prompt:edited.reusablePrompt!,resolution:"2K" as const,aspectRatio:"1:1" as const,referenceAssetIds:[copied.assetId],productAssetIds:[photo.id],referencePurpose:edited.purpose};
  const prepared=await db.$transaction(tx=>prepareDirectImage(tx,selection,candidate));assert.deepEqual(prepared.input.referenceAssetIds,[photo.id,copied.assetId]);assert.deepEqual(prepared.input.referenceUsage.map(r=>r.role),["product","reference"]);assert.match(prepared.input.prompt,/客厅光线/);assert.match(prepared.input.prompt,/严格保持/);assert.deepEqual(prepared.input.omittedReferences,[]);
  const noImage=await db.$transaction(tx=>prepareDirectImage(tx,{...selection,referenceAssetIds:[]},candidate));assert.deepEqual(noImage.input.referenceAssetIds,[photo.id]);assert.notEqual(noImage.fingerprint,prepared.fingerprint);
  const changed=await db.$transaction(tx=>prepareDirectImage(tx,{...selection,prompt:"新的描述"},candidate));assert.notEqual(changed.fingerprint,prepared.fingerprint);
  assert.equal(directImageSchema.safeParse({...selection,referenceAssetIds:[photo.id]}).success,false);
  await assert.rejects(db.$transaction(tx=>prepareDirectImage(tx,{...selection,productAssetIds:[source.id]},candidate)),/不属于/);
  await assert.rejects(db.$transaction(tx=>prepareDirectImage(tx,{...selection,productAssetIds:[copied.assetId],referenceAssetIds:[]},candidate)),/产品实拍/);
  await reuseReference(users[0],saved.id,products[1],undefined,{withPrompt:true});const message=await db.chatMessage.findFirstOrThrow({where:{productId:products[1]}});assert.match(JSON.stringify(message.content),/当前产品置于客厅/);assert.match(JSON.stringify(message.content),/不直接照搬/);
  assert.equal(await db.llmCall.count({where:{createdById:{in:users}}}),0);assert.equal(await db.generationJob.count({where:{createdById:{in:users}}}),1);
 }finally{
  if(savedId)await db.studioLibraryEntry.deleteMany({where:{id:savedId}});await db.generationJob.deleteMany({where:{createdById:{in:users}}});await db.asset.deleteMany({where:{createdById:{in:users}}});await db.product.deleteMany({where:{id:{in:products}}});await db.user.deleteMany({where:{id:{in:users}}});for(const key of keys)await deleteObject(key);await db.$disconnect();
 }
});
