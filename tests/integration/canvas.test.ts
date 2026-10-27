import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {db} from "../../src/lib/db";
import {agentSession} from "../../src/lib/agent-state";
import {canvasContext,loadCanvasState,saveCanvasState} from "../../src/lib/canvas-state";
import {emptyCanvasLayout} from "../../src/lib/canvas-rules";
import {runAgentTurn,type AgentChat,type AgentEvent} from "../../src/lib/planning-agent";
import {DEFAULT_AGENT} from "../../src/lib/agent-default";

test("真实数据库：布局版本、用户隔离、跨SKU拒绝、画布上下文与工具进度（不调用网关）",async()=>{
 if(!process.env.DATABASE_URL||!["localhost","127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname))throw Error("只允许本地验证");
 const run=randomUUID(),users:string[]=[],products:string[]=[];let calls=0;
 try{
  for(let i=0;i<2;i++)users.push((await db.user.create({data:{name:"画布隔离验证",email:`canvas-${run}-${i}@example.invalid`,passwordHash:"not-a-login-account",monthlyQuota:0}})).id);
  for(let i=0;i<2;i++)products.push((await db.product.create({data:{sku:`E2E-CANVAS-${run}-${i}`,name:"画布验证",category:"柜",dimensions:"未知",materials:"木",colors:"木色",sellingPoints:[],createdById:users[0]}})).id);
  const asset=await db.asset.create({data:{productId:products[0],createdById:users[0],type:"photo",storageKey:"verification/canvas/"+run,width:100,height:100}});
  const foreign=await db.asset.create({data:{productId:products[1],createdById:users[0],type:"photo",storageKey:"verification/canvas/foreign-"+run,width:100,height:100}});
  const initial=await loadCanvasState(products[0],users[0]);assert.equal(initial.revision,0);
  const simultaneous=await Promise.all(Array.from({length:16},()=>loadCanvasState(products[0],users[1])));assert(simultaneous.every(state=>state.revision===0));assert.equal(await db.agentSession.count({where:{productId:products[0],createdById:users[1]}}),1);
  const layout={...emptyCanvasLayout(),nodes:[{id:"reference-frame",x:900,y:100},{id:asset.id,x:30,y:50}],notes:[{id:"note-test",text:"保留原木色",x:80,y:100}],viewport:{x:20,y:40,zoom:.8}};
  const saved=await saveCanvasState(products[0],users[0],0,layout);assert.equal(saved.revision,1);
  assert.equal((await saveCanvasState(products[0],users[0],0,layout)).revision,1);
  await assert.rejects(saveCanvasState(products[0],users[0],0,{...layout,notes:[]}),/其他窗口/);
  assert.equal((await loadCanvasState(products[0],users[1])).revision,0);
  await assert.rejects(saveCanvasState(products[0],users[0],1,{...layout,nodes:[{id:foreign.id,x:0,y:0}]}),/当前SKU/);
  const canvas=await canvasContext(products[0],users[0],{selectedIds:[asset.id]});assert.deepEqual(canvas.referenceAssetIds,[asset.id]);assert.equal(canvas.summary.elements[0].x,930);assert.equal(canvas.summary.elements[0].y,150);
  const session=await agentSession(products[0],users[0]),events:AgentEvent[]=[];
  const chat:AgentChat=async input=>{calls++;if(calls===1){assert.deepEqual(input.images,[{id:asset.id}]);assert.match(JSON.stringify(input.messages),/保留原木色/);return {result:{text:"",toolCalls:[{id:run,type:"function",function:{name:"inspect_canvas",arguments:"{}"}}],usage:{inputTokens:0,outputTokens:0,totalTokens:0}},candidate:DEFAULT_AGENT.candidate,fallback:false,attemptId:"mock",warnings:[]};}assert.match(JSON.stringify(input.messages),/930/);return {result:{text:"已确认你选中的实拍。",usage:{inputTokens:0,outputTokens:0,totalTokens:0}},candidate:DEFAULT_AGENT.candidate,fallback:false,attemptId:"mock",warnings:[]};};
  const key=randomUUID();await runAgentTurn(products[0],users[0],"选中图片在哪里？",key,e=>events.push(e),undefined,chat,{selectedIds:[asset.id]});
  assert(events.some(e=>e.type==="tool"&&e.status==="running"));assert(events.some(e=>e.type==="tool"&&e.status==="success"));
  const tool=await db.agentToolCall.findUniqueOrThrow({where:{sessionId_callId:{sessionId:session.id,callId:run}}});assert.equal(tool.status,"success");assert(tool.completedAt);
  await runAgentTurn(products[0],users[0],"重复请求",key,()=>{},undefined,chat);assert.equal(calls,2);
  await assert.rejects(runAgentTurn(products[0],users[0],"跨SKU",randomUUID(),()=>{},undefined,chat,{referenceAssetIds:[foreign.id]}),/当前SKU/);assert.equal(calls,2);
  assert.equal(await db.llmCall.count({where:{productId:{in:products}}}),0);assert.equal(await db.generationJob.count({where:{productId:{in:products}}}),0);
  // 模拟生成在前端轮询之前完成：旧占位图仍可保存，无需让用户载入最新。
  const pack=await db.imagePack.create({data:{productId:products[0]}}),slot=await db.imageSlot.create({data:{packId:pack.id,name:"场景",slotType:"scene",method:"ai_scene",order:1,goal:"本地模拟"}});
  const job=await db.generationJob.create({data:{productId:products[0],slotId:slot.id,createdById:users[0],logicalModel:"scene-main",provider:"simulation",model:"本地模拟",status:"pending",input:{}}});
  const pending={...layout,nodes:[...layout.nodes,{id:"job-"+job.id,x:130,y:60}],hiddenIds:["job-"+job.id]};
  await saveCanvasState(products[0],users[0],1,pending);
  const result=await db.asset.create({data:{productId:products[0],createdById:users[0],type:"generated",storageKey:"verification/canvas/result-"+run,width:2048,height:1536}});
  await db.generationJob.update({where:{id:job.id},data:{status:"success",resultAssetIds:[result.id]}});
  const normalized=await saveCanvasState(products[0],users[0],2,{...pending,notes:[{...layout.notes[0],text:"完成前刚写的便签"}]});
  assert.equal(normalized.revision,3);assert.deepEqual(normalized.layout.nodes.at(-1),{id:result.id,x:130,y:60});assert.deepEqual(normalized.layout.hiddenIds,[result.id]);assert.equal(normalized.layout.notes[0].text,"完成前刚写的便签");assert.deepEqual(normalized.layout.viewport,layout.viewport);
  await db.asset.update({where:{id:result.id},data:{deletedAt:new Date()}});
  const removed=await saveCanvasState(products[0],users[0],3,normalized.layout);assert(!removed.layout.nodes.some(n=>n.id===result.id));assert.deepEqual(removed.layout.hiddenIds,[]);assert.equal(removed.layout.notes[0].text,"完成前刚写的便签");
 }finally{await db.generationJob.deleteMany({where:{productId:{in:products}}});await db.imagePack.deleteMany({where:{productId:{in:products}}});await db.asset.deleteMany({where:{productId:{in:products}}});await db.product.deleteMany({where:{id:{in:products}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect();}
});
