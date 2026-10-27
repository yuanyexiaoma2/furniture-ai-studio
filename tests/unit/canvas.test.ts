import test from "node:test";
import assert from "node:assert/strict";
import {canvasLayoutSchema,canvasSelectionSchema,emptyCanvasLayout,reconcileCanvasLayout,sameCanvasLayout,summarizeCanvas,type CanvasElement} from "../../src/lib/canvas-rules";
import {consumeAgentStream} from "../../src/lib/agent-stream";
import {progressSummary} from "../../src/lib/agent-progress";

test("布局拒绝重复ID、外部图片字段、非法坐标和过量引用",()=>{
 const layout=emptyCanvasLayout();assert(canvasLayoutSchema.safeParse(layout).success);
 assert(!canvasLayoutSchema.safeParse({...layout,nodes:[{id:"a",x:0,y:0},{id:"a",x:1,y:1}]}).success);
 assert(!canvasLayoutSchema.safeParse({...layout,nodes:[{id:"a",x:NaN,y:0}]}).success);
 assert(!canvasLayoutSchema.safeParse({...layout,nodes:[{id:"a",x:0,y:0,image:"https://outside.invalid"}]}).success);
 assert(!canvasSelectionSchema.safeParse({referenceAssetIds:Array.from({length:7},(_,i)=>String(i))}).success);
});
test("画布摘要优先保留选中元素、限制上下文长度并保留绝对坐标",()=>{
 const elements:CanvasElement[]=Array.from({length:70},(_,i)=>({id:"i"+i,type:"picture",label:"候选"+i,x:i*240,y:40,width:220,height:180}));
 const summary=summarizeCanvas(elements,["i69"],{x:20,y:30,zoom:.8});assert.equal(summary.elements.length,60);assert.equal(summary.elements[0].id,"i69");assert.equal(summary.elements[0].x,69*240);assert.equal(summary.truncated,true);assert.equal(elements[0].id,"i0");
});

test("占位图完成时自动迁移位置与隐藏状态，显式图片位置及便签保持不变",()=>{
 const layout={...emptyCanvasLayout(),nodes:[{id:"job-old",x:100,y:80},{id:"image-b",x:700,y:90},{id:"removed",x:0,y:0}],notes:[{id:"note-one",text:"用户刚写的便签",x:10,y:20}],hiddenIds:["job-old","removed"],viewport:{x:40,y:50,zoom:.7}};
 const next=reconcileCanvasLayout(layout,new Map([["job-old",["image-a","image-b"]],["removed",[]]]));
 assert.deepEqual(next.nodes,[{id:"image-b",x:700,y:90},{id:"image-a",x:100,y:80}]);assert.deepEqual(next.hiddenIds,["image-a","image-b"]);assert.deepEqual(next.notes,layout.notes);assert.deepEqual(next.viewport,layout.viewport);
 assert(sameCanvasLayout(next,{...next,nodes:[...next.nodes].reverse()}));assert(!sameCanvasLayout(next,{...next,notes:[]}));
});
test("工具事件流跨分块/中文/CRLF与末尾无空行时仍保留完成和错误状态",async()=>{
 const input='data: {"type":"tool","callId":"a","status":"running"}\r\n\r\ndata: {"type":"delta","text":"产品"}\r\n\r\ndata: {"type":"tool","callId":"a","status":"success","summary":"完成"}\n\ndata: {"type":"done"}';
 const bytes=new TextEncoder().encode(input),events:unknown[]=[];
 await consumeAgentStream(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=3)c.enqueue(bytes.slice(i,i+3));c.close();}}),e=>events.push(e));
 assert.equal(events.length,4);assert.deepEqual(events[1],{type:"delta",text:"产品"});assert.deepEqual(events[3],{type:"done"});assert.match(progressSummary({waitForUser:true}),/等待/);
});
