"use client";
import {create} from "zustand";
import {uploadIssue} from "@/lib/studio-rules";
import type {StudioSnapshot} from "@/lib/studio-main";
import {usePreviewStore,type StudioNode} from "./store";
import {useCanvasSession,applyCanvasLayout} from "./canvas-session";
import {demoSession,useModelStore,resolveSelection} from "./model-store";
export async function studioFetch<T>(url:string,options?:RequestInit):Promise<T>{
 const response=await fetch(url,options);const data=await response.json();
 if(!response.ok){if(response.status===401)window.location.replace(new URL("/login?callbackUrl="+encodeURIComponent(window.location.pathname+window.location.search),window.location.origin));throw Error(data.error??"请求未完成，请稍后重试");}return data;
}
type LiveState={files:File[];snapshot:StudioSnapshot|null;busy:boolean;error:string;addFiles:(files:File[])=>void;removeFile:(name:string,occurrence?:number)=>void;create:(text:string)=>Promise<string>;load:(id:string)=>Promise<void>;act:(action:string,data?:Record<string,unknown>)=>Promise<void>};
let loadVersion=0;
export function cancelLiveLoad(){loadVersion++;}
export const useLiveStore=create<LiveState>((set,get)=>({
 files:[],snapshot:null,busy:false,error:"",
 addFiles:files=>{const all=[...get().files,...files],issue=uploadIssue(all);if(issue)throw Error(issue);set({files:all});},
 removeFile:(name,occurrence=0)=>set(s=>{let found=0;const index=s.files.findIndex(file=>file.name===name&&found++===occurrence);return {files:s.files.filter((_,i)=>i!==index)};}),
 create:async text=>{set({busy:true,error:""});try{const form=new FormData();get().files.forEach(f=>form.append("files",f));form.append("text",text);form.append("settings",JSON.stringify(resolveSelection(useModelStore.getState(),"home")));const result=await studioFetch<{productId:string;results:{error?:string}[]}>("/api/studio",{method:"POST",body:form});set({files:[],snapshot:null});if(result.results.some(r=>r.error))set({error:"部分资料解析失败，请在工作台检查文件后重新上传"});return result.productId;}catch(e){set({error:e instanceof Error?e.message:"创建任务失败"});throw e;}finally{set({busy:false});}},
 load:async id=>{const version=++loadVersion,s=await studioFetch<StudioSnapshot>("/api/studio/"+id);if(version!==loadVersion)return;set({snapshot:s,error:""});syncLiveCanvas(s);},
 act:async(action,data={})=>{const id=get().snapshot?.product.id;if(!id)return;set({busy:true,error:""});try{if(["inspect","plan","generate","approve","retry"].includes(action))await studioFetch("/api/studio/"+id,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"settings",data:resolveSelection(useModelStore.getState(),demoSession)})});await studioFetch("/api/studio/"+id,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,data})});await get().load(id);}catch(e){const error=e instanceof Error?e.message:"操作失败，请刷新后重试";set({error});throw e;}finally{set({busy:false});}}
}));
let lastSignature="",canvasProductId="";
export function syncLiveCanvas(s:StudioSnapshot){
 const signature=JSON.stringify([s.product.id,s.product.assets.map(a=>a.id),s.pack.slots]);if(signature===lastSignature&&canvasProductId===s.product.id&&usePreviewStore.getState().nodes.some(n=>n.type!=="note"))return;lastSignature=signature;
 const first=canvasProductId!==s.product.id;canvasProductId=s.product.id;
 const previous=usePreviewStore.getState(),nodes:StudioNode[]=[];
 if(s.product.assets.length){nodes.push({id:"reference-frame",type:"frame",position:previous.nodes.find(n=>n.id==="reference-frame")?.position??{x:-620,y:0},style:{width:540,height:Math.max(280,Math.ceil(s.product.assets.length/2)*250+50)},dragHandle:".p-frame-title",data:{image:"",label:"产品实拍",slot:"产品实拍",candidateCount:s.product.assets.length}});s.product.assets.forEach((a,i)=>nodes.push({id:a.id,type:"picture",parentId:"reference-frame",position:previous.nodes.find(n=>n.id===a.id)?.position??{x:24+i%2*260,y:30+Math.floor(i/2)*250},style:{width:240,height:220},data:{image:"/api/assets/"+a.id,label:"原始实拍 "+(i+1),slot:"产品实拍",externalLabel:true,naturalWidth:a.width??undefined,naturalHeight:a.height??undefined}}));}

 s.pack.slots.forEach((slot,i)=>{
 const id="slot-"+slot.id,items=slot.jobs.filter(j=>!j.retriedById).flatMap<{id:string;image:string;loading:boolean;error:string;generationStage:string;naturalWidth?:number;naturalHeight?:number;jobId:string;editCount:number}>(j=>j.assets.length?j.assets.map(a=>({id:a.id,image:"/api/assets/"+a.id,loading:false,error:"",generationStage:"",naturalWidth:a.width??undefined,naturalHeight:a.height??undefined,jobId:j.id,editCount:Number(j.input.editCount??0)})):[{id:"job-"+j.id,image:"",loading:j.status==="pending"||j.status==="running",error:j.status==="failed"?(j.error||"生成失败"):"",generationStage:j.status==="pending"?"排队中":j.status==="running"?"生成中":"",naturalWidth:undefined,naturalHeight:undefined,jobId:j.id,editCount:0}]);
 nodes.push({id,type:"frame",position:previous.nodes.find(n=>n.id===id)?.position??{x:0,y:i*340},style:{width:Math.max(540,items.length*260+48),height:280},dragHandle:".p-frame-title",data:{image:"",slot:slot.name,label:String(i+1).padStart(2,"0")+" "+slot.name,candidateCount:items.length,final:!!slot.finalAssetId}});
 items.forEach((a,j)=>{const old=previous.nodes.find(n=>n.id===a.id),placeholder=previous.nodes.find(n=>n.id==="job-"+a.jobId),offset=items.slice(0,j).filter(item=>item.jobId===a.jobId).length;nodes.push({id:a.id,type:"picture",parentId:id,position:old?.position??(placeholder?{x:placeholder.position.x+offset*260,y:placeholder.position.y}:{x:24+j*260,y:30}),style:{width:240,height:220},selected:old?.selected,data:{...a,label:a.loading?a.generationStage:a.error?"生成失败":"候选 "+(j+1),slot:slot.name,final:a.id===slot.finalAssetId,externalLabel:true}});});
 });
 const hiddenIds=[...new Set(previous.hiddenIds.flatMap(id=>{if(!id.startsWith("job-"))return [id];const results=nodes.filter(n=>n.type==="picture"&&n.data.jobId===id.slice(4));return results.length?results.map(n=>n.id):[id];}))];
 const state=useCanvasSession.getState();useCanvasSession.setState({dataReady:true,registryIds:nodes.map(n=>n.id),baseNodes:nodes});
 const layout=first&&state.status!=="loading"?state.layout:null;
 const merged=layout?applyCanvasLayout(nodes,layout):[...nodes.filter(n=>!hiddenIds.includes(n.id)&&!hiddenIds.includes(n.parentId??"")),...previous.nodes.filter(n=>n.type==="note")];
 usePreviewStore.setState({nodes:merged,hiddenIds,selected:previous.selected.filter(id=>merged.some(n=>n.id===id))});
}
