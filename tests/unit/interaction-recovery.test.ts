import {test} from "node:test";
import assert from "node:assert/strict";
import {models} from "../../src/design-preview/mock/models";
import {workspaceMessageText} from "../../src/lib/workspace-messages";
import {useModelStore,resolveSelection,demoSession} from "../../src/components/design-preview/model-store";
import {useLiveStore,activateLiveProduct} from "../../src/components/design-preview/live-store";
import {startWorkspaceSettings} from "../../src/components/design-preview/workspace-settings";
import {clientSubmissionSignature,submissionKey,forgetSubmission} from "../../src/components/design-preview/submission-key";
import type {StudioSnapshot} from "../../src/lib/studio-main";

const storage=new Map<string,string>();
Object.defineProperty(globalThis,"sessionStorage",{configurable:true,value:{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)}});
const snapshot=(id:string)=>({product:{id,assets:[]},settings:{},conversationAssets:[],pack:{slots:[]},agent:{session:{mode:"quick"},cards:[]}} as unknown as StudioSnapshot);
const reset=()=>{useModelStore.getState().reset();useModelStore.getState().setCatalog(models);useModelStore.getState().startSession(demoSession,true);};
const fetchOriginal=globalThis.fetch;

test("A 的迟到操作不能覆盖 B，也不能清掉 B 的忙碌状态",async()=>{
 let release!:(value:Response)=>void;
 globalThis.fetch=async(url,init)=>init?.method==="POST"?new Promise<Response>(resolve=>{release=resolve;}):Response.json(snapshot(String(url).split("/").at(-1)!));
 const leaveA=activateLiveProduct("A");useLiveStore.setState({snapshot:snapshot("A")});
 const request=useLiveStore.getState().act("settings",{});leaveA();const leaveB=activateLiveProduct("B");await useLiveStore.getState().load("B");useLiveStore.setState({busy:true});
 release(Response.json({ok:true}));await request;
 assert.equal(useLiveStore.getState().snapshot?.product.id,"B");assert.equal(useLiveStore.getState().busy,true);
 leaveB();globalThis.fetch=fetchOriginal;
});

test("A→B→A 后，第一次进入 A 的请求仍然过期",async()=>{
 let release!:(value:Response)=>void;let reads=0;
 globalThis.fetch=async(_url,init)=>init?.method==="POST"?new Promise<Response>(resolve=>{release=resolve;}):(reads++,Response.json(snapshot("A")));
 const old=activateLiveProduct("A");useLiveStore.setState({snapshot:snapshot("A")});const request=useLiveStore.getState().act("settings",{});old();activateLiveProduct("B")();const current=activateLiveProduct("A");await useLiveStore.getState().load("A");
 release(Response.json({ok:true}));await request;assert.equal(reads,1);current();globalThis.fetch=fetchOriginal;
});

test("旧模型设置缺项及 undefined 补丁不会清空图片列表，联网 false 保留",()=>{
 reset();useModelStore.setState({sessions:{[demoSession]:{agentId:models.find(m=>m.kind==="agent")!.id,webEnabled:false} as never}});
 useModelStore.getState().updateSelection(demoSession,{imageIds:undefined});const selected=resolveSelection(useModelStore.getState(),demoSession);
 assert.ok(selected.imageIds.length);assert.ok(selected.imageId);assert.equal(selected.webEnabled,false);
});

test("提交编号在相同内容重试时保留，旧回调不清除更新的提交",async()=>{
 const signature=await clientSubmissionSignature({text:"测试"},[new File(["1"],"a.txt")]);
 const first=submissionKey("test",signature);assert.equal(submissionKey("test",signature),first);
 const changed=await clientSubmissionSignature({text:"测试"},[new File(["2"],"a.txt")]);assert.notEqual(changed,signature);
 const second=submissionKey("test",changed);forgetSubmission("test",first);assert.equal(submissionKey("test",changed),second);
 forgetSubmission("test",second);assert.notEqual(submissionKey("test",changed),second);
});

test("设置按顺序保存最新值，失败保留草稿，手动重试成功后清除",async()=>{
 reset();storage.clear();let release!:(value:Response)=>void;const writes:Record<string,unknown>[]=[];let fail=false;const errors:string[]=[];
 globalThis.fetch=async(_url,init)=>{writes.push(JSON.parse(String(init?.body)).data);if(fail)return Response.json({error:"模拟断网"},{status:503});if(writes.length===1)return new Promise<Response>(resolve=>{release=resolve;});return Response.json({ok:true});};
 const sync=startWorkspaceSettings("settings",{},true,message=>errors.push(message),"user");
 useModelStore.getState().updateSelection(demoSession,{webEnabled:false});useModelStore.getState().updateSelection(demoSession,{resolution:"4K"});
 assert.equal(writes.length,1);release(Response.json({ok:true}));await sync.flush();assert.equal(writes.length,2);assert.equal(writes[1].resolution,"4K");assert.equal(storage.size,0);
 fail=true;useModelStore.getState().updateSelection(demoSession,{webEnabled:true});await assert.rejects(sync.flush());assert.equal(storage.size,1);assert.ok(errors.some(Boolean));
 fail=false;await sync.flush();assert.equal(storage.size,0);assert.equal(errors.at(-1),"");sync.stop();globalThis.fetch=fetchOriginal;
});

test("设置草稿按用户和产品隔离，只读浏览不保存",async()=>{
 reset();storage.clear();let writes=0;globalThis.fetch=async()=>{writes++;throw Error("模拟离线");};
 const a=startWorkspaceSettings("draft",{},true,()=>{},"user-A");useModelStore.getState().updateSelection(demoSession,{resolution:"4K"});await assert.rejects(a.flush());a.stop();
 const b=startWorkspaceSettings("draft",{resolution:"1K"},false,()=>{},"user-B");assert.equal(resolveSelection(useModelStore.getState(),demoSession).resolution,"1K");const count=writes;useModelStore.getState().updateSelection(demoSession,{resolution:"2K"});await b.flush();assert.equal(writes,count);b.stop();globalThis.fetch=fetchOriginal;
});

test("只去掉系统修改报价，不吞掉警告、实际费用或用户文字",()=>{
 const price="本次修改预计 $0.03（估），提交后开始。";
 assert.equal(workspaceMessageText("system",price),"");assert.equal(workspaceMessageText("system",price+"\n参考图超出上限"),"参考图超出上限");
 assert.equal(workspaceMessageText("user",price),price);assert.equal(workspaceMessageText("system","实际费用 $0.03"),"实际费用 $0.03");
});
