import "dotenv/config";
import {test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {rm} from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {db} from "../../src/lib/db";
import {json,agentSession} from "../../src/lib/agent-state";
import {readVisualHistory,planToProposal,researchCompetitors} from "../../src/lib/visual-planning";
import {saveCompetitorInput} from "../../src/lib/visual-reference";
import {importListingFolder,approveListingImport} from "../../src/lib/listing-import";
import {retrievePatterns,selectVisualDirection,validateVisualPlan} from "../../src/lib/visual-plan-rules";
import {approveAgentCard} from "../../src/lib/agent-actions";
import {deleteObject} from "../../src/lib/storage";
import {fixture} from "../fixtures/visual-plan";
test("11-C数据库闭环：同品类最近5个SKU、方向冻结差异、竞品缓存、单文件夹待审与审核（模拟Agent，零付费）",async()=>{
 if(!process.env.DATABASE_URL||!["localhost","127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname))throw Error("仅允许本地测试");
 const run=randomUUID(),category="TEST-11C-"+run,ids:string[]=[];let userId="",batchId="";
 try{
 const user=await db.user.create({data:{name:"11C验证",email:run+"@example.invalid",passwordHash:"not-login",monthlyQuota:0}});userId=user.id;
 async function product(i:number){const p=await db.product.create({data:{sku:"TEST-11C-"+run+"-"+i,name:"测试产品",category,dimensions:"未知",materials:"未知",colors:[],sellingPoints:[],createdById:userId,createdAt:new Date(Date.now()-(10-i)*10000)}});ids.push(p.id);return p;}
 const current=await product(9);
 for(let i=0;i<6;i++){const p=await product(i);await db.generationJob.create({data:{productId:p.id,createdById:userId,status:"failed",logicalModel:"scene-main",input:{visualPlan:{slot:{combinationKey:"prior-"+i}}}}});}
 const history=await readVisualHistory(current.id,category);assert.equal(history.scope.length,6);assert(!history.priorKeys.includes("prior-0"));assert(history.priorKeys.includes("prior-5"));
 const photo=await db.asset.create({data:{productId:current.id,createdById:userId,type:"photo",storageKey:"verification/11c/"+run,width:8,height:8}});
 const session=await agentSession(current.id,userId),base=fixture.slots[0],directions=[{...base,id:"a",label:"方向A",reason:"突出入口动线"},{...base,id:"b",label:"方向B",reason:"突出墙角",scene:"墙角"}];
 const plan=validateVisualPlan({...fixture,productId:current.id,propPool:["编织篮"],identityLock:{...fixture.identityLock,referenceAssetIds:[photo.id]},slots:[{...base,key:"4",directions,selectedDirectionId:null}]});
 const card=await db.agentCard.create({data:{sessionId:session.id,kind:"pack",data:json({...planToProposal(plan),originalVisualPlan:plan})}});
 await assert.rejects(approveAgentCard(session.id,card.id,{}),/选择一个方向/);
 await assert.rejects(approveAgentCard(session.id,card.id,{visualPlan:{...plan,slots:[{...plan.slots[0],key:"bypass"}]}}),/图位列表/);
 const final={...plan,slots:[selectVisualDirection(plan.slots[0],"b")]};await approveAgentCard(session.id,card.id,{visualPlan:final});
 const saved=(await db.agentCard.findUniqueOrThrow({where:{id:card.id}})).data as {originalVisualPlan:unknown;confirmedVisualPlan:typeof final;planDiff:{field:string}[]};
 assert.equal(saved.confirmedVisualPlan.slots[0].selectedDirectionId,"b");assert(saved.planDiff.some(d=>d.field==="scene"));assert.deepEqual(saved.originalVisualPlan,plan);
 assert.deepEqual((await db.imageSlot.findFirstOrThrow({where:{pack:{productId:current.id}}})).visualPlan&&saved.confirmedVisualPlan.identityLock,plan.identityLock);
 await saveCompetitorInput(current.id,{assetIds:[],links:["https://example.invalid/product"]});await saveCompetitorInput(current.id,{assetIds:[],links:[]});
 const env=process.env.GOOGLE_SEARCH_ENABLED;process.env.GOOGLE_SEARCH_ENABLED="false";const research=await researchCompetitors(current.id,userId,plan.identityLock);process.env.GOOGLE_SEARCH_ENABLED=env;assert.equal(research.references.length,0);assert.match(research.note,/未提供竞品参考/);
 const bytes=await sharp({create:{width:8,height:8,channels:3,background:"white"}}).png().toBuffer();
 const files=[new File([new Uint8Array(bytes)],"listing/1.png",{type:"image/png"}),new File([new Uint8Array(bytes)],"listing/2.png",{type:"image/png"}),new File(['{"category":"测试"}'],"listing/params.json",{type:"application/json"})];
 const draft=await importListingFolder(userId,category,files,async input=>{assert.equal(input.images?.length,2);assert.match(JSON.stringify(input.messages),/params.json/);return {summary:"模拟拆解，验证真实存储和人工审核",entries:[{type:"scene_pattern",name:"入口构图",content:{roomType:"门厅",composition:"以动线交代收纳"},sellingPoints:[]},{type:"prop_pool",name:"门厅道具池",content:{props:["篮","绿植"]},sellingPoints:[]},{type:"selling_point_pattern",name:"收纳表达",content:{expression:"物件有序"},sellingPoints:["收纳"]},{type:"slot_sequence",name:"图位顺序",content:{slots:["主图","场景","细节"]},sellingPoints:[]}]};});batchId=draft.id;
 assert.equal((draft.content.originalImageRefs as string[]).length,2);assert.equal(retrievePatterns([draft],category,[]).entries.length,0);assert.equal(await db.product.count({where:{createdById:userId}}),7);
 await approveListingImport(userId,draft.id,draft.content.entries);
 const rows=await db.studioLibraryEntry.findMany({where:{id:{startsWith:draft.id}}});assert.equal(retrievePatterns(rows.map(r=>r.data),category,[]).entries.length,5);
 await assert.rejects(approveListingImport(userId,draft.id,draft.content.entries),/已审核/);
 assert.equal(await db.llmCall.count({where:{createdById:userId}}),0);
 }finally{
 const assets=await db.asset.findMany({where:{createdById:userId}});for(const a of assets)if(a.storageKey.startsWith("library/imports/"))await deleteObject(a.storageKey).catch(()=>undefined);
 if(batchId)await db.studioLibraryEntry.deleteMany({where:{id:{startsWith:batchId}}});
 await db.generationJob.deleteMany({where:{createdById:userId}});await db.imagePack.deleteMany({where:{productId:{in:ids}}});await db.productProfile.deleteMany({where:{productId:{in:ids}}});await db.productIdentityVersion.deleteMany({where:{productId:{in:ids}}});await db.asset.deleteMany({where:{createdById:userId}});await db.product.deleteMany({where:{id:{in:ids}}});if(userId)await db.user.delete({where:{id:userId}});
 const root=path.resolve("docs/review"),base=path.resolve(root,"TEST-11C-"+run+"-9");if(base.startsWith(root+path.sep)){await rm(base+".html",{force:true});await rm(base+"-assets",{recursive:true,force:true});}
 await db.$disconnect();
 }
});
