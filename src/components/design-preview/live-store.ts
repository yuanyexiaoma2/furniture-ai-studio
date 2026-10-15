"use client";
import {create} from "zustand";
import {uploadIssue} from "@/lib/studio-rules";
import type {StudioSnapshot} from "@/lib/studio-main";
import {usePreviewStore,type StudioNode} from "./store";
import {demoSession,useModelStore,resolveSelection} from "./model-store";
export async function studioFetch<T>(url:string,options?:RequestInit):Promise<T>{
 const response=await fetch(url,options);const data=await response.json();
 if(!response.ok){if(response.status===401)window.location.replace(new URL("/login?callbackUrl="+encodeURIComponent(window.location.pathname+window.location.search),window.location.origin));throw Error(data.error??"请求未完成，请稍后重试");}return data;
}
type LiveState={files:File[];snapshot:StudioSnapshot|null;busy:boolean;error:string;addFiles:(files:File[])=>void;removeFile:(name:string)=>void;create:(text:string)=>Promise<string>;load:(id:string)=>Promise<void>;act:(action:string,data?:Record<string,unknown>)=>Promise<void>};
export const useLiveStore=create<LiveState>((set,get)=>({
 files:[],snapshot:null,busy:false,error:"",
 addFiles:files=>{const all=[...get().files,...files],issue=uploadIssue(all);if(issue)throw Error(issue);set({files:all});},
 removeFile:name=>set(s=>({files:s.files.filter(f=>f.name!==name)})),
 create:async text=>{set({busy:true,error:""});try{const form=new FormData();get().files.forEach(f=>form.append("files",f));form.append("text",text);form.append("settings",JSON.stringify(resolveSelection(useModelStore.getState(),"home")));const result=await studioFetch<{productId:string;results:{error?:string}[]}>("/api/studio",{method:"POST",body:form});set({files:[],snapshot:null});if(result.results.some(r=>r.error))set({error:"部分资料解析失败，请在工作台检查文件后重新上传"});return result.productId;}catch(e){set({error:e instanceof Error?e.message:"创建任务失败"});throw e;}finally{set({busy:false});}},
 load:async id=>{const s=await studioFetch<StudioSnapshot>("/api/studio/"+id);set({snapshot:s});syncLiveCanvas(s);},
 act:async(action,data={})=>{const id=get().snapshot?.product.id;if(!id)return;set({busy:true,error:""});try{if(["inspect","plan","generate","approve","retry"].includes(action))await studioFetch("/api/studio/"+id,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"settings",data:resolveSelection(useModelStore.getState(),demoSession)})});await studioFetch("/api/studio/"+id,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,data})});await get().load(id);}catch(e){const error=e instanceof Error?e.message:"操作失败，请刷新后重试";set({error});throw e;}finally{set({busy:false});}}
}));
let lastSignature="";
export function syncLiveCanvas(s:StudioSnapshot){
 const signature=JSON.stringify(s.pack.slots);if(signature===lastSignature)return;lastSignature=signature;
 const previous=usePreviewStore.getState(),nodes:StudioNode[]=[];
 s.pack.slots.forEach((slot,i)=>{
 const id="slot-"+slot.id,items=slot.jobs.filter(j=>!j.retriedById).flatMap(j=>j.assets.length?j.assets.map(a=>({id:a.id,image:"/api/assets/"+a.id,loading:false,error:"",jobId:j.id,editCount:Number(j.input.editCount??0)})):[{id:"job-"+j.id,image:"",loading:j.status==="pending"||j.status==="running",error:j.status==="failed"?"生成失败 · 重试":"",jobId:j.id,editCount:0}]);
 nodes.push({id,type:"frame",position:previous.nodes.find(n=>n.id===id)?.position??{x:0,y:i*340},style:{width:Math.max(540,items.length*260+48),height:280},dragHandle:".p-frame-title",data:{image:"",slot:slot.name,label:String(i+1).padStart(2,"0")+" "+slot.name,candidateCount:items.length,final:!!slot.finalAssetId}});
 items.forEach((a,j)=>{const old=previous.nodes.find(n=>n.id===a.id);nodes.push({id:a.id,type:"picture",parentId:id,position:old?.position??{x:24+j*260,y:30},style:{width:240,height:220},selected:old?.selected,data:{...a,label:a.loading?"正在生成":a.error||"候选 "+(j+1),slot:slot.name,final:a.id===slot.finalAssetId,externalLabel:true}});});
 });
 usePreviewStore.setState({nodes,selected:previous.selected.filter(id=>nodes.some(n=>n.id===id))});
}
