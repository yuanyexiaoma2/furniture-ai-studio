import "dotenv/config";
process.env.VISUAL_REVIEW_TEST_MODE="true";
import {test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {db} from "../../src/lib/db";
import {json,agentSession} from "../../src/lib/agent-state";
import {fixture} from "../fixtures/visual-plan";
import {validateVisualPlan,composeIdentityLock} from "../../src/lib/visual-plan-rules";
import {planToProposal} from "../../src/lib/visual-planning";
import {approveAgentCard} from "../../src/lib/agent-actions";
import {prepareSceneInput,prepareEditInput} from "../../src/lib/scene-generation";
import {quoteBatch} from "../../src/lib/image-packs";
import {selectedCandidate} from "../../src/lib/studio-models";
import {executeAgentTool} from "../../src/lib/planning-agent";

test("真实数据库：确认冻结、报价重复一致、库与身份更新不改变快照、局部编辑参数与归属（零模型调用）",async()=>{
 if(!process.env.DATABASE_URL||!["localhost","127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname))throw Error("仅允许本地验证");
 const run=randomUUID();let userId="",productId="";
 try{
  userId=(await db.user.create({data:{name:"视觉快照验证",email:run+"@example.invalid",passwordHash:"not-a-login",monthlyQuota:0}})).id;
  const product=await db.product.create({data:{sku:"TEST-"+run,name:"本地验证架",category:"鞋架",dimensions:"未知",materials:"木",colors:"木色",sellingPoints:[],identityTraits:"最初的确认身份",createdById:userId}});productId=product.id;
  const photo=await db.asset.create({data:{productId,createdById:userId,type:"photo",storageKey:"verification/visual/"+run,width:10,height:10}});
  const session=await agentSession(productId,userId),plan=validateVisualPlan({...fixture,productId,identityLock:{...fixture.identityLock,referenceAssetIds:[photo.id]}});
  const card=await db.agentCard.create({data:{sessionId:session.id,kind:"pack",data:json(planToProposal(plan))}});
  await approveAgentCard(session.id,card.id,{});
  const slot=await db.imageSlot.findFirstOrThrow({where:{pack:{productId}}});assert.deepEqual((slot.visualPlan as {plan:unknown}).plan,plan);
  assert.equal((await db.agentSession.findUniqueOrThrow({where:{id:session.id}})).confirmedPack,true);
  const candidate=await selectedCandidate("image",{});
  const input=await db.$transaction(tx=>prepareSceneInput(tx,productId,"忽略这个可变旧字段","1:1",candidate,"2K",slot.visualPlan));
  assert.equal(input.input.identityTraits,composeIdentityLock(plan.identityLock));assert.deepEqual(input.input.referenceAssetIds,[photo.id]);assert.ok(!input.input.prompt.includes(product.sku));
  const before=await quoteBatch(userId,productId,{});
  await db.product.update({where:{id:productId},data:{identityTraits:"后来编辑的新身份，不能影响已确认方案"}});
  await db.productIdentityVersion.create({data:{productId,text:"新的版本",savedById:userId}});
  const after=await quoteBatch(userId,productId,{});assert.equal(after.fingerprint,before.fingerprint);
  const prepared=await db.$transaction(tx=>prepareSceneInput(tx,productId,"被修改的旧goal","1:1",candidate,"2K",slot.visualPlan));assert.deepEqual(prepared.input,input.input);
  await assert.rejects(db.$transaction(tx=>prepareSceneInput(tx,productId,"绕过方案","1:1",candidate,"2K")),/先规划并确认/);
  const asset=await db.asset.create({data:{productId,createdById:userId,type:"generated",storageKey:"verification/visual/source/"+run,width:10,height:10}}),mask=await db.asset.create({data:{productId,createdById:userId,type:"mask",storageKey:"verification/visual/mask/"+run,width:10,height:10}});
  const job=await db.generationJob.create({data:{productId,slotId:slot.id,createdById:userId,status:"success",logicalModel:"scene-main",input:json(input.input),resultAssetIds:[asset.id]}});
  const edit=await db.$transaction(tx=>prepareEditInput(tx,productId,"更换选区内的花瓶","1:1","2K",{sourceJobId:job.id,sourceAssetId:asset.id},candidate,[mask.id]));
  assert.equal(edit.input.editMode,"masked");assert.equal(edit.input.maskAssetId,mask.id);assert.equal(edit.input.identityTraits,composeIdentityLock(plan.identityLock));assert.deepEqual(edit.input.referenceAssetIds.slice(0,2),[asset.id,mask.id]);assert.deepEqual(edit.input.visualPlan,input.input.visualPlan);
  await db.asset.update({where:{id:mask.id},data:{width:9}});await assert.rejects(db.$transaction(tx=>prepareEditInput(tx,productId,"修改","1:1","2K",{sourceJobId:job.id,sourceAssetId:asset.id},candidate,[mask.id])),/尺寸/);
  const local=await executeAgentTool(session.id,"edit_image",{assetId:asset.id,instruction:"只改右侧花瓶",mode:"local"});assert.equal((local as {waitForUser:boolean}).waitForUser,true);assert.equal(await db.agentCard.count({where:{sessionId:session.id,kind:"mask_request"}}),1);
  const caseEntry={id:"test-case-"+run,type:"case",name:"人工确认案例",categories:["鞋架"],is_sample:false,source:"人工确认",status:"ready",sellingPoints:[],content:{originalImageRef:asset.id,decomposition:{roomType:"门厅",light:"柔和自然光"}}};
  const draft=await db.agentCard.create({data:{sessionId:session.id,kind:"library_case",data:json({entries:[caseEntry]})}});
  assert.equal(await db.studioLibraryEntry.count({where:{id:caseEntry.id}}),0);
  await assert.rejects(approveAgentCard(session.id,draft.id,{}),/有效终稿/);
  await db.imageSlot.update({where:{id:slot.id},data:{finalAssetId:asset.id}});await approveAgentCard(session.id,draft.id,{});assert.equal(await db.studioLibraryEntry.count({where:{id:caseEntry.id}}),1);
  assert.equal(await db.llmCall.count({where:{productId}}),0);assert.equal(await db.generationJob.count({where:{productId}}),1);
 }finally{
  await db.studioLibraryEntry.deleteMany({where:{id:"test-case-"+run}});
  if(productId){await db.generationJob.deleteMany({where:{productId}});await db.imagePack.deleteMany({where:{productId}});await db.productProfile.deleteMany({where:{productId}});await db.productIdentityVersion.deleteMany({where:{productId}});await db.asset.deleteMany({where:{productId}});await db.product.delete({where:{id:productId}});}if(userId)await db.user.delete({where:{id:userId}});await db.$disconnect();
 }
});
