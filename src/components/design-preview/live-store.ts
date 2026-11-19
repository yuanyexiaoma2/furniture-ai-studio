"use client";
import {canvasGridPosition,canvasGridSize} from "@/lib/canvas-arrangement";
import {conversationImages} from "@/lib/generation-references";
import {canvasSelection,placeCanvasResults} from "./canvas-operations";
import {create} from "zustand";
import {uploadIssue} from "@/lib/studio-rules";
import type {StudioSnapshot} from "@/lib/studio-main";
import {usePreviewStore,type StudioNode} from "./store";
import {useCanvasSession,applyCanvasLayout} from "./canvas-session";
import {demoSession,useModelStore,resolveSelection} from "./model-store";
import {studioFetch,type StudioFetchError} from "./studio-fetch";
import {clientSubmissionSignature,submissionKey,forgetSubmission} from "./submission-key";
import {flushWorkspaceSettings} from "./workspace-settings";
export {studioFetch} from "./studio-fetch";
const submissionKeys=new Map<string,string>();
export const defaultPackPrompt="请根据产品实拍，帮我做一套商品图：主图、场景、卖点和尺寸图。";
type LiveState={initializationReady:boolean;generationChoiceRequired:boolean;files:File[];packPrompt:string|null;snapshot:StudioSnapshot|null;busy:boolean;error:string;addFiles:(files:File[])=>void;removeFile:(name:string,occurrence?:number)=>void;create:(text:string,scope?:string)=>Promise<string>;load:(id:string)=>Promise<StudioSnapshot|undefined>;act:(action:string,data?:Record<string,unknown>)=>Promise<{jobId?:string;modeChoiceRequired?:boolean}>};
let loadVersion=0,projectEpoch=0,activeProductId:string|null=null;
export function cancelLiveLoad(){loadVersion++;}
export function liveProjectEpoch(){return projectEpoch;}
export function isLiveProduct(id:string,epoch=projectEpoch){return epoch===projectEpoch&&(activeProductId===null||activeProductId===id);}
export function activateLiveProduct(id:string){
 const epoch=++projectEpoch;activeProductId=id;cancelLiveLoad();
 useLiveStore.setState({busy:false,error:"",generationChoiceRequired:false,...(useLiveStore.getState().snapshot?.product.id!==id?{snapshot:null}:{})});
 return ()=>{if(projectEpoch===epoch){activeProductId="";projectEpoch++;cancelLiveLoad();useLiveStore.setState({busy:false,snapshot:null,error:""});}};
}
export const useLiveStore=create<LiveState>((set,get)=>({
 initializationReady:true,generationChoiceRequired:false,files:[],packPrompt:null,snapshot:null,busy:false,error:"",
 addFiles:files=>{const all=[...get().files,...files],issue=uploadIssue(all);if(issue)throw Error(issue);set({files:all});},
 removeFile:(name,occurrence=0)=>set(s=>{let found=0;const index=s.files.findIndex(file=>file.name===name&&found++===occurrence);return {files:s.files.filter((_,i)=>i!==index)};}),
 create:async(text,scope="home")=>{
  if(get().busy)throw Error("当前操作正在处理，请稍候");const epoch=projectEpoch,files=[...get().files],selection=resolveSelection(useModelStore.getState(),scope);let key="";
  set({busy:true,error:""});
  try{
   key=submissionKey("create-project",await clientSubmissionSignature({text,selection},files));
   const form=new FormData();files.forEach(f=>form.append("files",f));form.append("text",text);form.append("settings",JSON.stringify(selection));form.append("requestKey",key);
   const result=await studioFetch<{productId:string;results:{error?:string}[];initializationReady?:boolean}>("/api/studio",{method:"POST",body:form});
   forgetSubmission("create-project",key);
   if(projectEpoch===epoch)set({files:get().files.filter(file=>!files.includes(file)),snapshot:null,generationChoiceRequired:false,initializationReady:result.initializationReady!==false,error:result.results.some(r=>r.error)?"部分资料解析失败，请在工作台检查后补充":""});
   return result.productId;
  }catch(e){if(key&&["failed","mismatch"].includes((e as StudioFetchError).requestState??""))forgetSubmission("create-project",key);if(projectEpoch===epoch)set({error:e instanceof Error?e.message:"创建任务失败"});throw e;}
  finally{if(projectEpoch===epoch)set({busy:false});}
 },
 load:async id=>{const epoch=projectEpoch;if(!isLiveProduct(id,epoch))return;const version=++loadVersion,s=await studioFetch<StudioSnapshot>("/api/studio/"+id);if(version!==loadVersion||!isLiveProduct(id,epoch))return;set({snapshot:s,error:"",...(get().snapshot?.product.id!==id||s.agent.session.mode!=="manual"?{generationChoiceRequired:false}:{})});syncLiveCanvas(s);return s;},
 act:async(action,data={})=>{const id=get().snapshot?.product.id,epoch=projectEpoch;if(!id)throw Error("请先创建产品");if(!isLiveProduct(id,epoch))throw Error("工作台已切换，请在当前项目继续");if(get().busy)throw Error("当前操作正在处理，请稍后重试");const selection=resolveSelection(useModelStore.getState(),demoSession);set({busy:true,error:""});
 const logical={...data};delete logical.requestKey;
 const paid=["generate","retry"].includes(action),signature=id+action+JSON.stringify(logical);
 if(paid&&!submissionKeys.has(signature))submissionKeys.set(signature,crypto.randomUUID());
 try{
  if(["inspect","plan","generate","approve","retry"].includes(action)){
   await flushWorkspaceSettings(id);if(!isLiveProduct(id,epoch))return {};
   await studioFetch("/api/studio/"+id,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"settings",data:selection})});
   if(!isLiveProduct(id,epoch))return {};
  }
  const result=await studioFetch<{jobId?:string;modeChoiceRequired?:boolean}>("/api/studio/"+id,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,data:{...data,...(paid?{requestKey:submissionKeys.get(signature)}:{})}})});
  if(paid){submissionKeys.delete(signature);if(isLiveProduct(id,epoch))set({generationChoiceRequired:result.modeChoiceRequired===true});}
  if(isLiveProduct(id,epoch))try{await get().load(id);}catch{if(isLiveProduct(id,epoch))set({error:"操作已提交，进度暂未刷新，请刷新查看；不要重复生成"});}
  return result;
 }catch(e){const error=e instanceof Error?e.message:"操作失败，请刷新后重试";if(isLiveProduct(id,epoch))set({error});throw e;}finally{if(isLiveProduct(id,epoch))set({busy:false});}}

}));
let lastSignature="",canvasProductId="";
export function syncLiveCanvas(s:StudioSnapshot){
 const signature=JSON.stringify([s.product.id,s.product.assets,s.conversationAssets,s.settings,s.pack.slots]);if(signature===lastSignature&&canvasProductId===s.product.id&&usePreviewStore.getState().nodes.some(n=>n.type!=="note"))return;lastSignature=signature;
 const first=canvasProductId!==s.product.id;canvasProductId=s.product.id;
 const previous=usePreviewStore.getState(),nodes:StudioNode[]=[];
 const inputAssets=[...s.product.assets,...s.conversationAssets??[]].filter((a,i,all)=>all.findIndex(b=>b.id===a.id)===i),roles=conversationImages(s.settings??{});
 const productIds=new Set(s.product.assets.map(a=>a.id));
 if(inputAssets.length){nodes.push({id:"reference-frame",type:"frame",position:previous.nodes.find(n=>n.id==="reference-frame")?.position??{x:-620,y:0},style:{width:540,height:Math.max(280,Math.ceil(inputAssets.length/2)*250+50)},dragHandle:".p-frame-title",data:{image:"",label:"产品实拍与参考资料",slot:"参考资料",candidateCount:inputAssets.length}});inputAssets.forEach((a,i)=>nodes.push({id:a.id,type:"picture",parentId:"reference-frame",position:previous.nodes.find(n=>n.id===a.id)?.position??{x:24+i%2*260,y:30+Math.floor(i/2)*250},style:{width:240,height:220},data:{image:"/api/assets/"+a.id,assetRole:roles.find(r=>r.assetId===a.id)?.role??(productIds.has(a.id)?"product":"unresolved"),label:(roles.find(r=>r.assetId===a.id)?.role==="reference"?"场景参考 ":roles.find(r=>r.assetId===a.id)?.role==="source"?"待编辑原图 ":roles.find(r=>r.assetId===a.id)?.role==="product"||productIds.has(a.id)?"产品实拍 ":"待说明用途 ")+(i+1),slot:"参考资料",externalLabel:true,naturalWidth:a.width??undefined,naturalHeight:a.height??undefined}}));}

 let nextTop=0;
 s.pack.slots.forEach((slot,i)=>{
 const id="slot-"+slot.id,items=[...slot.jobs].sort((a,b)=>String(a.createdAt??"").localeCompare(String(b.createdAt??""))||a.id.localeCompare(b.id)).filter(j=>!j.retriedById).flatMap<{sourceAssetId?:string;id:string;image:string;loading:boolean;error:string;generationStage:string;naturalWidth?:number;naturalHeight?:number;jobId:string;editCount:number;costUsd:number|null;reservedUsd:number;costEstimated:boolean;provider?:string|null;model?:string|null;fallback?:boolean;switchReason?:string;referenceUsage?:import("@/lib/generation-references").ReferenceUse[];omittedReferences?:import("@/lib/generation-references").ReferenceUse[];referenceLimit?:number}>(j=>j.assets.length?j.assets.map(a=>({sourceAssetId:typeof j.input.sourceAssetId==="string"?j.input.sourceAssetId:undefined,id:a.id,image:"/api/assets/"+a.id,loading:false,error:"",generationStage:"",naturalWidth:a.width??undefined,naturalHeight:a.height??undefined,jobId:j.id,editCount:Number(j.input.editCount??0),provider:j.provider,model:j.model,fallback:j.fallback,switchReason:String(j.input.switchReason??(j.fallback?j.error??"":"")),costUsd:j.costUsd,reservedUsd:j.reservedUsd,costEstimated:j.costEstimated,referenceUsage:j.input.referenceUsage as import("@/lib/generation-references").ReferenceUse[]|undefined,omittedReferences:j.input.omittedReferences as import("@/lib/generation-references").ReferenceUse[]|undefined,referenceLimit:j.input.referenceLimit as number|undefined})):[{id:"job-"+j.id,image:"",loading:j.status==="pending"||j.status==="running",error:j.status==="failed"?(j.error||"生成失败"):"",generationStage:j.status==="pending"?"排队中":j.status==="running"?"生成中":"",naturalWidth:undefined,naturalHeight:undefined,jobId:j.id,editCount:0,provider:j.provider,model:j.model,fallback:j.fallback,switchReason:String(j.input.switchReason??(j.fallback?j.error??"":"")),costUsd:j.costUsd,reservedUsd:j.reservedUsd,costEstimated:j.costEstimated,referenceUsage:j.input.referenceUsage as import("@/lib/generation-references").ReferenceUse[]|undefined,omittedReferences:j.input.omittedReferences as import("@/lib/generation-references").ReferenceUse[]|undefined,referenceLimit:j.input.referenceLimit as number|undefined}]);
 nodes.push({id,type:"frame",position:previous.nodes.find(n=>n.id===id)?.position??{x:0,y:nextTop},style:canvasGridSize(items.length),dragHandle:".p-frame-title",data:{image:"",slot:slot.name,label:String(i+1).padStart(2,"0")+" "+slot.name,candidateCount:items.length,final:!!slot.finalAssetId}});
 nextTop+=canvasGridSize(items.length).height+70;
 items.forEach((a,j)=>{const old=previous.nodes.find(n=>n.id===a.id),placeholder=previous.nodes.find(n=>n.id==="job-"+a.jobId),offset=items.slice(0,j).filter(item=>item.jobId===a.jobId).length;nodes.push({id:a.id,type:"picture",parentId:id,position:old?.position??(placeholder?{x:placeholder.position.x+offset*260,y:placeholder.position.y}:canvasGridPosition(j)),style:{width:240,height:220},selected:old?.selected,data:{...a,assetRole:"result",label:a.loading?a.generationStage:a.error?"生成失败":"版本 "+(j+1)+(a.sourceAssetId?" · 修改":" · 生成"),slot:slot.name,final:a.id===slot.finalAssetId,externalLabel:true}});});
 });
 // 刷新结果只扩充分组容纳范围，不缩掉用户已有的自由布局。
 for(const frame of nodes.filter(n=>n.type==="frame")){
  const prior=previous.nodes.find(n=>n.id===frame.id),children=nodes.filter(n=>n.parentId===frame.id);
  frame.style={...frame.style,width:Math.max(Number(frame.style?.width??0),Number(prior?.style?.width??0),...children.map(n=>n.position.x+Number(n.style?.width??240)+24)),height:Math.max(Number(frame.style?.height??0),Number(prior?.style?.height??0),...children.map(n=>n.position.y+Number(n.style?.height??220)+30))};
 }
 const hiddenIds=[...new Set(previous.hiddenIds.flatMap(id=>{if(!id.startsWith("job-"))return [id];const results=nodes.filter(n=>n.type==="picture"&&n.data.jobId===id.slice(4));return results.length?results.map(n=>n.id):[id];}))];
 const state=useCanvasSession.getState();useCanvasSession.setState({dataReady:true,registryIds:nodes.map(n=>n.id),baseNodes:nodes});
 const layout=first&&state.status!=="loading"?state.layout:null;
 const merged=placeCanvasResults(layout?applyCanvasLayout(nodes,layout):[...nodes.filter(n=>!hiddenIds.includes(n.id)&&!hiddenIds.includes(n.parentId??"")),...previous.nodes.filter(n=>n.type==="note")],new Set([...(layout?.nodes.map(n=>n.id)??[]),...previous.nodes.map(n=>n.id)]));
 usePreviewStore.setState({...canvasSelection(merged,previous.selected),hiddenIds,references:previous.references.filter(id=>merged.some(n=>n.id===id)),editor:merged.some(n=>n.id===previous.editor?.id)?previous.editor:null});
}
