import test from "node:test";
import assert from "node:assert/strict";
import {canvasLayoutSchema,canvasSelectionSchema,emptyCanvasLayout,reconcileCanvasLayout,sameCanvasLayout,summarizeCanvas,type CanvasElement} from "../../src/lib/canvas-rules";
import {consumeAgentStream} from "../../src/lib/agent-stream";
import {progressSummary} from "../../src/lib/agent-progress";
import {usePreviewStore,type StudioNode} from "../../src/components/design-preview/store";
import {arrangeCanvasNodes,restoreCanvasNodes,placeCanvasResults} from "../../src/components/design-preview/canvas-operations";
import {syncLiveCanvas} from "../../src/components/design-preview/live-store";
import {applyCanvasLayout,useCanvasSession} from "../../src/components/design-preview/canvas-session";
import type {StudioSnapshot} from "../../src/lib/studio-main";
import {canvasGridSize} from "../../src/lib/canvas-arrangement";

const picture=(id:string,parentId="frame"):StudioNode=>({id,type:"picture",parentId,position:{x:40,y:30},data:{image:"/api/assets/"+id,label:id,slot:"场景"}});

test("修改任务倒序返回也追加到空位，完成后替换占位并保持原图位置和版本关系",()=>{
 const saved=usePreviewStore.getState(),canvas=useCanvasSession.getState();
 try{
  usePreviewStore.setState({nodes:[],selected:[],references:[],hiddenIds:[]});useCanvasSession.setState({status:"saved",layout:emptyCanvasLayout()});
  const original={id:"original-job",createdAt:"2026-11-13T00:00:00Z",input:{},assets:[{id:"original",width:100,height:100}],status:"success",reservedUsd:0,costUsd:.03};
  const edited={...original,id:"edit-job",createdAt:"2026-11-13T01:00:00Z",status:"pending",assets:[],input:{sourceAssetId:"original"}};
  const snapshot={product:{id:"canvas-edit-regression",assets:[]},conversationAssets:[],settings:{},pack:{slots:[{id:"s",name:"场景",jobs:[original]}]}} as unknown as StudioSnapshot;
  syncLiveCanvas(snapshot);const source=usePreviewStore.getState().nodes.find(n=>n.id==="original")!;
  snapshot.pack.slots[0].jobs=[edited,original] as unknown as StudioSnapshot["pack"]["slots"][number]["jobs"];
  syncLiveCanvas(snapshot);
  const placeholder=usePreviewStore.getState().nodes.find(n=>n.id==="job-edit-job")!;
  assert.notDeepEqual(placeholder.position,source.position);assert.deepEqual(usePreviewStore.getState().nodes.find(n=>n.id==="original")!.position,source.position);
  edited.assets=[{id:"edited",width:100,height:100}] as never[];edited.status="success";
  syncLiveCanvas(snapshot);const result=usePreviewStore.getState().nodes.find(n=>n.id==="edited")!;
  assert.deepEqual(result.position,placeholder.position);assert.equal(result.data.sourceAssetId,"original");assert.match(result.data.label,/版本 2.*修改/);
 }finally{usePreviewStore.setState(saved);useCanvasSession.setState(canvas);}
});

test("刷新修复旧版完全重叠的版本，同时保留其他自由位置、便签和隐藏状态",()=>{
 const frame:StudioNode={id:"slot-test",type:"frame",position:{x:600,y:700},data:{image:"",label:"场景",slot:"场景"}},a=picture("a",frame.id),b=picture("b",frame.id),c={...picture("c",frame.id),position:{x:900,y:500}};
 const layout={...emptyCanvasLayout(),nodes:[{id:"a",x:40,y:30},{id:"b",x:40,y:30},{id:"c",x:900,y:500}],hiddenIds:["hidden"],notes:[{id:"note-one",text:"保留便签",x:9,y:11}]};
 const nodes=applyCanvasLayout([frame,a,b,c],layout);
 assert.deepEqual(nodes.find(n=>n.id==="a")?.position,a.position);assert.notDeepEqual(nodes.find(n=>n.id==="b")?.position,a.position);assert.deepEqual(nodes.find(n=>n.id==="c")?.position,c.position);assert.equal(nodes.find(n=>n.id==="note-one")?.data.label,"保留便签");
 assert.deepEqual(placeCanvasResults(nodes,new Set(nodes.map(n=>n.id))),nodes);
});
test("选图、取消、移除分组保持操作对象及图片高亮同步，不遗留隐藏引用",()=>{
 const saved=usePreviewStore.getState();try{
  usePreviewStore.setState({nodes:[{id:"frame",type:"frame",position:{x:0,y:0},data:{image:"",label:"场景",slot:"场景"}},picture("a"),picture("b")],selected:[],references:[],hiddenIds:[]});
  const store=usePreviewStore.getState();store.select(["a","a","missing"]);assert.deepEqual(usePreviewStore.getState().selected,["a"]);assert.equal(usePreviewStore.getState().contextId,"a");assert.equal(usePreviewStore.getState().nodes.find(n=>n.id==="a")?.selected,true);
  store.select([]);assert.equal(usePreviewStore.getState().contextId,null);assert(usePreviewStore.getState().nodes.every(n=>!n.selected));
  store.addReference("a");store.select(["frame"]);store.removeSelected();assert.deepEqual(usePreviewStore.getState().references,[]);assert.deepEqual(usePreviewStore.getState().selected,[]);assert.deepEqual(usePreviewStore.getState().nodes,[]);assert(usePreviewStore.getState().hiddenIds.includes("a"));
 }finally{usePreviewStore.setState(saved);}
});
test("整理按图位分行，保留图片身份、终稿与便签；恢复隐藏子图同时恢复父组",()=>{
 const frame:StudioNode={id:"frame",type:"frame",position:{x:500,y:800},data:{image:"",label:"场景",slot:"场景"}};
 const note:StudioNode={id:"note-1",type:"note",position:{x:17,y:29},data:{image:"",label:"不要改这条便签",slot:"便签"}};
 const pictures=Array.from({length:7},(_,i)=>picture(String(i))),nodes=arrangeCanvasNodes([frame,...pictures,note]);
 assert.equal(nodes.find(n=>n.id==="3")?.position.y,300);assert.equal(nodes.find(n=>n.id==="6")?.position.y,570);assert.deepEqual(nodes.at(-1),note);assert(canvasGridSize(7).width<1000);
 const restored=restoreCanvasNodes([note],nodes,["frame",...pictures.map(p=>p.id)],"3");assert.deepEqual(restored.nodes.map(n=>n.id),["note-1","frame","3"]);assert(!restored.hiddenIds.includes("frame"));assert(restored.hiddenIds.includes("0"));assert.deepEqual(restored.nodes[0],note);
});

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
