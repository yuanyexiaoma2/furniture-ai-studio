import "dotenv/config";
import {test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import sharp from "sharp";
import {db} from "../../src/lib/db";
import {json} from "../../src/lib/agent-state";
import {runStudioRequest,STUDIO_REQUEST_KIND} from "../../src/lib/studio-requests";
import {claimInitialInspection,createStudioTask,updateStudioSettings} from "../../src/lib/studio-main";
import {studioCatalog} from "../../src/lib/studio-models";
import {importListingFolder} from "../../src/lib/listing-import";
import {deleteObject} from "../../src/lib/storage";

test("真实本地数据库：创建/导入重试只找回原结果，首次识别只认领一次，设置保留会话元数据",async()=>{
 assert(["localhost","127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname));
 const users:string[]=[],run=randomUUID();let draftId="";
 try{
  for(let i=0;i<2;i++)users.push((await db.user.create({data:{name:"交互恢复隔离验证",email:`recovery-${run}-${i}@example.invalid`,passwordHash:"not-a-login-account"}})).id);
  const catalog=await studioCatalog(),agent=catalog.find(m=>m.kind==="agent")!,image=catalog.find(m=>m.kind==="image")!;
  const selection={agentId:agent.id,imageId:image.id,imageIds:[image.id],auto:true,webEnabled:false,resolution:"2K"};
  const key=randomUUID();const form=()=>{const f=new FormData();f.append("text","只建立隔离验证项目");f.append("settings",JSON.stringify(selection));f.append("requestKey",key);return f;};
  const created=await createStudioTask(users[0],form()),again=await createStudioTask(users[0],form());assert.equal(again.productId,created.productId);assert.equal(await db.product.count({where:{createdById:users[0]}}),1);
  const changed=form();changed.set("text","不同请求不能冒充旧请求");await assert.rejects(createStudioTask(users[0],changed),/内容已变化/);
  const other=await createStudioTask(users[1],form());assert.notEqual(other.productId,created.productId);
  const session=await db.agentSession.findFirstOrThrow({where:{productId:created.productId}});
  assert.deepEqual((await Promise.all([claimInitialInspection(session.id),claimInitialInspection(session.id)])).sort(),[false,true]);assert.equal(await claimInitialInspection(session.id),false);
  await db.agentSession.update({where:{id:session.id},data:{settings:json({...selection,initialInspectionAttempted:true,conversationImages:[{assetId:"kept",role:"reference",purpose:"场景"}]})}});
  await updateStudioSettings(created.productId,users[0],{...selection,resolution:"4K"});const settings=(await db.agentSession.findUniqueOrThrow({where:{id:session.id}})).settings as Record<string,unknown>;
  assert.equal(settings.initialInspectionAttempted,true);assert.equal(settings.resolution,"4K");assert.equal((settings.conversationImages as unknown[]).length,1);
  const prior=await db.agentSession.findFirstOrThrow({where:{productId:other.productId}});await db.agentToolCall.create({data:{sessionId:prior.id,callId:randomUUID(),name:"inspect_product",status:"failed",arguments:{},error:"模拟历史失败"}});assert.equal(await claimInitialInspection(prior.id),false);

  const pixels=await sharp({create:{width:16,height:16,channels:3,background:"white"}}).png().toBuffer(),file=new File([new Uint8Array(pixels)],"scene.png",{type:"image/png"});let analyses=0;
  const analyze=async()=>{analyses++;return {summary:"本地模拟拆解",entries:[{type:"scene_pattern",name:"构图",content:{roomType:"门厅"},sellingPoints:[]}]};};
  const importKey=randomUUID();const draft=await importListingFolder(users[0],"测试柜",[file],analyze,importKey);draftId=draft.id;
  assert.equal((await importListingFolder(users[0],"测试柜",[file],analyze,importKey)).id,draft.id);assert.equal(analyses,1);
  await assert.rejects(importListingFolder(users[0],"不同品类",[file],analyze,importKey),/内容已变化/);assert.equal(analyses,1);

  let release!:()=>void,started!:()=>void;const begun=new Promise<void>(done=>{started=done;});let calls=0;const pendingKey=randomUUID();
  const pending=runStudioRequest(users[0],"concurrency",pendingKey,"same",async()=>{calls++;started();await new Promise<void>(done=>{release=done;});return {ok:true};});await begun;
  await assert.rejects(runStudioRequest(users[0],"concurrency",pendingKey,"same",async()=>{calls++;return {ok:true};}),/仍在处理/);release();await pending;assert.equal(calls,1);
  const recovery=await runStudioRequest(users[0],"checkpoint",randomUUID(),"same",async({checkpoint})=>{await checkpoint({existing:"retained"});throw Error("模拟结果之后响应中断");});assert.deepEqual(recovery,{existing:"retained"});
  const rollbackKey=randomUUID();await assert.rejects(runStudioRequest(users[0],"rollback",rollbackKey,"same",async({checkpoint})=>db.$transaction(async tx=>{await checkpoint({uncommitted:true},tx);throw Error("模拟事务回滚");})),/模拟事务回滚/);
  await assert.rejects(runStudioRequest(users[0],"rollback",rollbackKey,"same",async()=>{throw Error("不得重新执行");}),/模拟事务回滚/);
  assert.equal(await db.llmCall.count({where:{createdById:{in:users}}}),0);assert.equal(await db.generationJob.count({where:{createdById:{in:users}}}),0);
 }finally{
  // 只清理本测试建立的数据，不触碰现有项目、图片或历史。
  const assets=await db.asset.findMany({where:{createdById:{in:users}}});for(const asset of assets)await deleteObject(asset.storageKey);
  await db.studioLibraryEntry.deleteMany({where:{OR:[{id:draftId},{kind:STUDIO_REQUEST_KIND,data:{path:["ownerId"],equals:users[0]??"never"}},{kind:STUDIO_REQUEST_KIND,data:{path:["ownerId"],equals:users[1]??"never"}}]}});
  await db.asset.deleteMany({where:{createdById:{in:users}}});await db.product.deleteMany({where:{createdById:{in:users}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect();
 }
});
