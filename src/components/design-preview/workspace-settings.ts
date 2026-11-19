"use client";
import {demoSession,resolveSelection,useModelStore,type ModelSelection} from "./model-store";
import {studioFetch} from "./studio-fetch";

type SavedDraft={selection:ModelSelection;signature:string};
type Sync={flush:()=>Promise<void>;stop:()=>void};
const managers=new Map<string,Sync>();
const key=(id:string)=>"furniture-workspace-settings:"+id;
function readDraft(id:string){try{const raw=sessionStorage.getItem(key(id));if(!raw)return null;const parsed=JSON.parse(raw) as SavedDraft;return parsed&&typeof parsed.signature==="string"&&parsed.selection&&Array.isArray(parsed.selection.imageIds)?parsed:null;}catch{return null;}}
function writeDraft(id:string,draft:SavedDraft){try{sessionStorage.setItem(key(id),JSON.stringify(draft));}catch{/* 页面内仍按顺序保存。 */}}
const fields=["agentId","imageId","imageIds","auto","qualities","webEnabled","resolution"] as const;

export function startWorkspaceSettings(productId:string,settings:unknown,canWrite:boolean,onError:(message:string)=>void=()=>{},userId=""):Sync{
 managers.get(productId)?.stop();
 const storageId=userId?userId+":"+productId:productId;
 const source=settings&&typeof settings==="object"?settings as Partial<ModelSelection>:{},draft=canWrite?readDraft(storageId):null;
 const patch=Object.fromEntries(fields.filter(field=>source[field]!==undefined).map(field=>[field,source[field]])) as Partial<ModelSelection>;
 useModelStore.getState().updateSelection(demoSession,{...patch,...draft?.selection});
 let current=JSON.stringify(resolveSelection(useModelStore.getState(),demoSession)),pending=draft?resolveSelection(useModelStore.getState(),demoSession):null,inFlight:Promise<void>|null=null,active=true;
 if(pending)writeDraft(storageId,{selection:pending,signature:current});
 async function flush():Promise<void>{
  if(!canWrite)return;
  if(inFlight){await inFlight;return flush();}
  if(!pending)return;
  if(!pending.agentId||!pending.imageId||!pending.imageIds.length)return; // 等模型目录就绪后再保存。
  const selection=pending,signature=JSON.stringify(selection);pending=null;
  const promise=studioFetch("/api/studio/"+productId,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"settings",data:selection}),keepalive:true}).then(()=>{
   const stored=readDraft(storageId);if(stored?.signature===signature)try{sessionStorage.removeItem(key(storageId));}catch{/* 不清除更新的草稿。 */}
   if(active)onError("");
  }).catch(error=>{if(!pending)pending=selection;if(active)onError("模型设置未保存，修改已保留。请重试保存后继续。" );throw error;}).finally(()=>{inFlight=null;});
  inFlight=promise;try{await promise;}catch(error){if(pending&&JSON.stringify(pending)!==signature)void flush().catch(()=>{});throw error;}if(pending)await flush();
 }
 const unsubscribe=canWrite?useModelStore.subscribe(()=>{
  const selection=resolveSelection(useModelStore.getState(),demoSession),signature=JSON.stringify(selection);if(signature===current)return;
  current=signature;pending=selection;writeDraft(storageId,{selection,signature});if(active)onError("");void flush().catch(()=>{});
 }):()=>{};
 const sync:Sync={flush,stop:()=>{unsubscribe();active=false;void flush().catch(()=>{});if(managers.get(productId)===sync)managers.delete(productId);}};
 managers.set(productId,sync);if(pending)void flush().catch(()=>{});
 return sync;
}
export async function flushWorkspaceSettings(productId:string){await managers.get(productId)?.flush();}
