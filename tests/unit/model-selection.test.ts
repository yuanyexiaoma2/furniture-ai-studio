import test from "node:test";
import assert from "node:assert/strict";
import {models} from "../../src/design-preview/mock/models";
import {DEFAULT_AGENT} from "../../src/lib/agent-default";
const savedWindow=Object.getOwnPropertyDescriptor(globalThis,"window");
const storage=new Map<string,string>();
Object.defineProperty(globalThis,"window",{configurable:true,value:{localStorage:{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)}}});
const {useModelStore,resolveSelection}=await import("../../src/components/design-preview/model-store");

test("旧首页迁移到Flash默认模型，同时保留已有会话与图片配置",async()=>{
 useModelStore.getState().reset();
 useModelStore.getState().updateSelection("home",{agentId:"agent-sol",resolution:"4K",webEnabled:false});
 useModelStore.getState().startSession("existing");
 const previous=useModelStore.getState();
 const migrate=useModelStore.persist.getOptions().migrate!;
 const migrated=await migrate(previous,1) as typeof previous;
 assert.equal(migrated.home.agentId,DEFAULT_AGENT.id);assert.equal(migrated.defaults.agent,DEFAULT_AGENT.id);
 assert.equal(migrated.home.resolution,"4K");assert.equal(migrated.home.webEnabled,false);
 assert.equal(migrated.sessions.existing.agentId,"agent-sol");
 useModelStore.setState(migrated);
 useModelStore.getState().setCatalog(models);
 useModelStore.getState().startSession("new-session");
 assert.equal(resolveSelection(useModelStore.getState(),"new-session").agentId,DEFAULT_AGENT.id);
 assert.equal(resolveSelection(useModelStore.getState(),"existing").agentId,"agent-sol");
 useModelStore.getState().reset();
 if(savedWindow)Object.defineProperty(globalThis,"window",savedWindow);else Reflect.deleteProperty(globalThis,"window");
});
