"use client";
import {create} from "zustand";
import {applyNodeChanges,type Node,type NodeChange} from "@xyflow/react";
import {demoSession,resolveSelection,useModelStore} from "./model-store";
import {models} from "@/design-preview/mock/models";
import {originalPhotoReferences,useLibraryStore} from "./library/library-store";
import type {ImageAction,OnImageAction} from "./contracts";
import type {CopyLayout} from "@/design-preview/workflows/types";
export type ImageData = {costUsd?:number|null;reservedUsd?:number;costEstimated?:boolean;naturalWidth?:number;naturalHeight?:number;generationStage?:string;hideFinalBadge?:boolean;externalLabel?:boolean;error?:string;jobId?:string;variantColor?:string;copy?:CopyLayout;label:string;slot:string;image:string;final?:boolean;loading?:boolean;effect?:string;editCount?:number;highlight?:boolean;candidateCount?:number};
export type StudioNode = Node<ImageData>;
export const frameNames=["产品主图","客厅场景","空间搭配","材质细节","核心卖点","尺寸说明","安装说明"];
export const imagePath=(name:string)=>/^(\/|data:|blob:)/.test(name)?name:`/design-preview/${name}.webp`;
const frameImages=[[16,21,24,25,8],[5,10,12,13,15],[3,4,11,17,18],[2,7,9,14,29],[1,19,20,22,23],[6,26,27,28,30]];
export function initialNodes():StudioNode[]{
 const frames:StudioNode[]=frameNames.map((slot,i)=>({id:`frame-${i}`,type:"frame",position:{x:(i%2)*1270,y:Math.floor(i/2)*320},style:{width:1215,height:240},data:{label:`0${i+1} ${slot}`,slot,image:"",final:i<6&&i!==1,effect:i===6?"empty":""},dragHandle:".p-frame-title"}));
 const images:StudioNode[]=frameNames.slice(0,6).flatMap((slot,i)=>Array.from({length:5},(_,j)=>({id:`image-${i}-${j}`,type:"picture",parentId:`frame-${i}`,position:{x:24+j*236,y:30},data:{label:`候选 0${j+1}`,slot,image:`r3-${String(frameImages[i][j]).padStart(2,"0")}`,final:j===0&&i!==1,effect:i===0?"main":i===3?"detail":i===5?"dimensions":"",editCount:0},style:{width:224,height:180}})));
 return [...frames,...images];
}
type PreviewStore={hiddenIds:string[];liveMode:boolean;nodes:StudioNode[];selected:string[];contextId:string|null;target:string;theme:string;tool:"select"|"pan";referencePicking:boolean;references:string[];editor:{id:string;action:ImageAction}|null;messages:string[];history:string[];pending:number;
 restoreTask:(images:{id:string;image:string}[])=>void;clearTask:()=>void;addBatch:(images:string[])=>{id:string;image:string}[];setTheme:(theme:string)=>void;changeNodes:(changes:NodeChange<StudioNode>[])=>void;select:(ids:string[])=>void;clearContext:()=>void;setTarget:(target:string)=>void;setTool:(tool:"select"|"pan")=>void;setPicking:(value:boolean)=>void;addReference:(id:string)=>void;setEditor:(editor:PreviewStore["editor"])=>void;setFinal:(id:string)=>void;update:(id:string,data:Partial<ImageData>)=>void;addImage:(image:string,position?:{x:number;y:number})=>void;addNote:()=>void;removeSelected:()=>void;send:(message:string)=>void;simulate:(id:string,action:ImageAction,onAction?:OnImageAction,mask?:Blob,count?:number,instruction?:string)=>Promise<boolean>;reset:()=>void;
};
export const usePreviewStore=create<PreviewStore>((set,get)=>({
 hiddenIds:[],liveMode:false,nodes:[],selected:[],contextId:null,target:"客厅场景",theme:"system",tool:"select",referencePicking:false,references:[],editor:null,messages:[],history:["14:32 · 调整客厅光线","14:20 · 生成 30 张候选","14:08 · 确认产品与图包"],pending:0,
 restoreTask:images=>{get().clearTask();get().addBatch(images.map(i=>i.image));const ids=images.map(i=>i.id);set(s=>({nodes:s.nodes.map(n=>n.type==="picture"?{...n,id:ids.shift()!}:n)}));},
 clearTask:()=>set({nodes:[{id:"frame-0",type:"frame",position:{x:0,y:0},style:{width:1215,height:240},dragHandle:".p-frame-title",data:{label:"01 场景候选",slot:"场景候选",image:"",effect:"empty",candidateCount:0}}],selected:[],contextId:null,editor:null,messages:[],pending:0,references:[]}),
 addBatch:images=>{const results=images.map(image=>({id:"candidate-"+crypto.randomUUID(),image}));set(s=>({nodes:[...s.nodes.map(n=>n.id==="frame-0"?{...n,style:{...n.style,width:Math.max(1215,24+(s.nodes.filter(n=>n.parentId==="frame-0").length+images.length)*236)},data:{...n.data,effect:"",candidateCount:s.nodes.filter(n=>n.parentId==="frame-0").length+images.length}}:n),...results.map((r,i)=>({id:r.id,type:"picture",parentId:"frame-0",position:{x:24+(s.nodes.filter(n=>n.parentId==="frame-0").length+i)*236,y:30},style:{width:224,height:180},data:{image:r.image,label:"候选 0"+(i+1),slot:"场景候选"}}))]}));return results;},
 setTheme:theme=>set({theme}),changeNodes:changes=>set(s=>{const removed=changes.filter(c=>c.type==="remove").map(c=>c.id),hidden=s.nodes.filter(n=>n.type!=="note"&&(removed.includes(n.id)||removed.includes(n.parentId??""))).map(n=>n.id);return {nodes:applyNodeChanges(changes,s.nodes).filter(n=>!removed.includes(n.parentId??"")),hiddenIds:[...new Set([...s.hiddenIds,...hidden])]};}),
 select:ids=>{const node=get().nodes.find(n=>ids.includes(n.id)&&n.type==="picture")??get().nodes.find(n=>ids.includes(n.id)&&n.type==="frame");set({selected:ids,...(node?{contextId:node.type==="picture"?node.id:null,target:node.data.slot}:{})});},
 clearContext:()=>set({contextId:null}),setTarget:target=>set({target}),setTool:tool=>set({tool}),setPicking:referencePicking=>set({referencePicking}),
 addReference:id=>set(s=>({references:s.references.includes(id)?s.references:[...s.references,id],referencePicking:false})),setEditor:editor=>set({editor}),
 setFinal:id=>set(s=>{const node=s.nodes.find(n=>n.id===id);return{nodes:s.nodes.map(n=>n.type==="frame"&&n.data.slot===node?.data.slot?{...n,data:{...n.data,final:true}}:n.type==="picture"&&n.data.slot===node?.data.slot&&n.parentId===node?.parentId?{...n,data:{...n.data,final:n.id===id}}:n)}}),
 update:(id,data)=>set(s=>({nodes:s.nodes.map(n=>n.id===id?{...n,data:{...n.data,...data}}:n)})),
 addImage:(image,position)=>set(s=>({nodes:[...s.nodes,{id:"reference-"+crypto.randomUUID(),type:"picture",position:position??{x:60,y:-260},data:{image,label:"参考实拍",slot:"参考资料"},style:{width:224,height:180}}]})),
 addNote:()=>set(s=>({nodes:[...s.nodes,{id:`note-${crypto.randomUUID()}`,type:"note",position:{x:70,y:-170},data:{image:"",slot:"便签",label:get().liveMode?"记录这次创作的要求…":"保留产品木色与扶手轮廓。"}}]})),
 removeSelected:()=>set(s=>({hiddenIds:[...new Set([...s.hiddenIds,...s.nodes.filter(n=>n.type!=="note"&&(s.selected.includes(n.id)||s.selected.includes(n.parentId??""))).map(n=>n.id)])],nodes:s.nodes.filter(n=>!s.selected.includes(n.id)&&!s.selected.includes(n.parentId??"")),selected:[],contextId:null})),
 send:message=>set(s=>({messages:[...s.messages,message]})),
 simulate:async(id,action,onAction,mask,count=1,instruction)=>{
  const node=get().nodes.find(n=>n.id===id);if(!node)return false;
  if(get().liveMode&&onAction){const accepted=await onAction({action,imageId:id,originalImage:node.data.image,originalPhotoReferences:[],productReferences:[],mask,instruction,editCount:node.data.editCount??0});if(accepted===false)return false;set({editor:null});return true;}
  const isFrame=node.type==='frame';const seed=isFrame?{...node,type:'picture',style:{width:224,height:180},dragHandle:undefined,data:{...node.data,image:'sofa',label:'新候选',effect:'',final:false}}:node;
  if(!originalPhotoReferences().length)throw new Error("修图必须同时保留原始实拍");

  const beforeIds=new Set(get().nodes.map(n=>n.id));
  const original=/^(blob:|data:|\/)/.test(seed.data.image)?seed.data.image:imagePath(seed.data.image);
  const accepted=await onAction?.({action,imageId:id,originalImage:original,originalPhotoReferences:originalPhotoReferences(),productReferences:[...originalPhotoReferences(),...get().references.map(ref=>{const image=get().nodes.find(n=>n.id===ref)?.data.image??ref;return /^(blob:|data:|\/)/.test(image)?image:imagePath(image);})],mask,editCount:node.data.editCount??0});
  if(accepted===false)return false;
  get().update(id,{loading:true});set(s=>({pending:s.pending+1}));
  await new Promise(resolve=>setTimeout(resolve,1500));
  const parent=get().nodes.find(n=>n.id===node.parentId);
  const parentId=isFrame?node.id:parent?.id;
  const siblings=get().nodes.filter(n=>n.parentId===parentId&&n.type==='picture');
  const firstX=isFrame?24:parent?Math.max(24,...siblings.map(n=>n.position.x))+236:node.position.x+236;
  const width=firstX+(count-1)*236+248;
  set(s=>({nodes:[...s.nodes.map(n=>{let next=n;if(n.id===id)next={...n,data:{...n.data,loading:false}};if(n.id===parentId)next={...next,style:{...next.style,width},data:{...next.data,effect:'',candidateCount:siblings.length+count}};return next;}),...Array.from({length:count},(_,i)=>({...seed,selected:false,dragging:false,id:`result-${crypto.randomUUID()}`,position:{x:firstX+i*236,y:parentId?30:node.position.y},parentId,extent:undefined,data:{...seed.data,final:false,highlight:false,label:`新候选 0${i+1}`,loading:false,effect:action,editCount:(node.data.editCount??0)+1}}))],pending:Math.max(0,s.pending-1),history:[`刚刚 · ${node.data.slot}新增 ${count} 张候选`,...s.history],editor:null}));
  const generated=get().nodes.filter(n=>!beforeIds.has(n.id)&&n.type==="picture").map(n=>({id:n.id,image:n.data.image.startsWith("data:")||n.data.image.startsWith("blob:")?n.data.image:imagePath(n.data.image)}));
  const selection=resolveSelection(useModelStore.getState(),demoSession),model=models.find(m=>m.id===(selection.auto?selection.imageIds[0]:selection.imageId));
  useLibraryStore.getState().finishManualEdit(id,generated,({paint:"按涂抹区域局部重绘",erase:"消除涂抹区域",recolor:"修改选中区域颜色",cutout:"移除背景",expand:"扩展画面",background:"替换背景",regenerate:"再生成一张"} as Record<string,string>)[action]??"按要求调整",model?.name);
  return true;
 },reset:()=>set({nodes:initialNodes(),selected:[],contextId:null,editor:null,messages:[],pending:0,references:[]})
}));
