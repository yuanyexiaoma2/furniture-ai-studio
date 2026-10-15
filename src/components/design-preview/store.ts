"use client";
import {create} from "zustand";
import {applyNodeChanges,type Node,type NodeChange} from "@xyflow/react";
import type {ImageAction,OnImageAction} from "./contracts";
export type ImageData = {label:string;slot:string;image:string;final?:boolean;loading?:boolean;effect?:string;editCount?:number;highlight?:boolean;candidateCount?:number};
export type StudioNode = Node<ImageData>;
export const frameNames=["产品主图","客厅场景","空间搭配","材质细节","核心卖点","尺寸说明","安装说明"];
export const imagePath=(name:string)=>`/design-preview/${name}.webp`;
const frameImages=[[16,21,24,25,8],[5,10,12,13,15],[3,4,11,17,18],[2,7,9,14,29],[1,19,20,22,23],[6,26,27,28,30]];
export function initialNodes():StudioNode[]{
 const frames:StudioNode[]=frameNames.map((slot,i)=>({id:`frame-${i}`,type:"frame",position:{x:(i%2)*1270,y:Math.floor(i/2)*320},style:{width:1215,height:240},data:{label:`0${i+1} ${slot}`,slot,image:"",final:i<6&&i!==1,effect:i===6?"empty":""},dragHandle:".p-frame-title"}));
 const images:StudioNode[]=frameNames.slice(0,6).flatMap((slot,i)=>Array.from({length:5},(_,j)=>({id:`image-${i}-${j}`,type:"picture",parentId:`frame-${i}`,position:{x:24+j*236,y:30},data:{label:`候选 0${j+1}`,slot,image:`r3-${String(frameImages[i][j]).padStart(2,"0")}`,final:j===0&&i!==1,effect:i===0?"main":i===3?"detail":i===5?"dimensions":"",editCount:0},style:{width:224,height:180}})));
 return [...frames,...images];
}
type PreviewStore={nodes:StudioNode[];selected:string[];contextId:string|null;target:string;theme:string;tool:"select"|"pan";referencePicking:boolean;references:string[];editor:{id:string;action:ImageAction}|null;messages:string[];history:string[];pending:number;
 setTheme:(theme:string)=>void;changeNodes:(changes:NodeChange<StudioNode>[])=>void;select:(ids:string[])=>void;clearContext:()=>void;setTarget:(target:string)=>void;setTool:(tool:"select"|"pan")=>void;setPicking:(value:boolean)=>void;addReference:(id:string)=>void;setEditor:(editor:PreviewStore["editor"])=>void;setFinal:(id:string)=>void;update:(id:string,data:Partial<ImageData>)=>void;addImage:(image:string,position?:{x:number;y:number})=>void;addNote:()=>void;removeSelected:()=>void;send:(message:string)=>void;simulate:(id:string,action:ImageAction,onAction?:OnImageAction,mask?:Blob,count?:number)=>Promise<void>;reset:()=>void;
};
export const usePreviewStore=create<PreviewStore>((set,get)=>({
 nodes:initialNodes(),selected:[],contextId:null,target:"客厅场景",theme:"system",tool:"select",referencePicking:false,references:[],editor:null,messages:[],history:["14:32 · 调整客厅光线","14:20 · 生成 30 张候选","14:08 · 确认产品与图包"],pending:0,
 setTheme:theme=>set({theme}),changeNodes:changes=>set(s=>({nodes:applyNodeChanges(changes,s.nodes)})),
 select:ids=>{const node=get().nodes.find(n=>ids.includes(n.id)&&n.type==="picture")??get().nodes.find(n=>ids.includes(n.id)&&n.type==="frame");set({selected:ids,...(node?{contextId:node.type==="picture"?node.id:null,target:node.data.slot}:{})});},
 clearContext:()=>set({contextId:null}),setTarget:target=>set({target}),setTool:tool=>set({tool}),setPicking:referencePicking=>set({referencePicking}),
 addReference:id=>set(s=>({references:s.references.includes(id)?s.references:[...s.references,id],referencePicking:false})),setEditor:editor=>set({editor}),
 setFinal:id=>set(s=>{const node=s.nodes.find(n=>n.id===id);return{nodes:s.nodes.map(n=>n.type==="frame"&&n.data.slot===node?.data.slot?{...n,data:{...n.data,final:true}}:n.type==="picture"&&n.data.slot===node?.data.slot?{...n,data:{...n.data,final:n.id===id}}:n)}}),
 update:(id,data)=>set(s=>({nodes:s.nodes.map(n=>n.id===id?{...n,data:{...n.data,...data}}:n)})),
 addImage:(image,position)=>set(s=>({nodes:[...s.nodes,{id:`reference-${Date.now()}`,type:"picture",position:position??{x:60,y:-260},data:{image,label:"参考实拍",slot:"参考资料"},style:{width:224,height:180}}]})),
 addNote:()=>set(s=>({nodes:[...s.nodes,{id:`note-${Date.now()}`,type:"note",position:{x:70,y:-170},data:{image:"",slot:"便签",label:"保留产品木色与扶手轮廓。"}}]})),
 removeSelected:()=>set(s=>({nodes:s.nodes.filter(n=>!s.selected.includes(n.id)&&!s.selected.includes(n.parentId??"")),selected:[],contextId:null})),
 send:message=>set(s=>({messages:[...s.messages,message]})),
 simulate:async(id,action,onAction,mask,count=1)=>{
  const node=get().nodes.find(n=>n.id===id);if(!node)return;
  const isFrame=node.type==='frame';const seed=isFrame?{...node,type:'picture',style:{width:224,height:180},dragHandle:undefined,data:{...node.data,image:'sofa',label:'新候选',effect:'',final:false}}:node;
  const original=seed.data.image.startsWith('blob:')?seed.data.image:imagePath(seed.data.image);
  await onAction?.({action,imageId:id,originalImage:original,productReferences:get().references.map(ref=>{const image=get().nodes.find(n=>n.id===ref)?.data.image??ref;return image.startsWith('blob:')?image:imagePath(image);}),mask,editCount:node.data.editCount??0});
  get().update(id,{loading:true});set(s=>({pending:s.pending+1}));
  await new Promise(resolve=>setTimeout(resolve,1500));
  const parent=get().nodes.find(n=>n.id===node.parentId);
  const parentId=isFrame?node.id:parent?.id;
  const siblings=get().nodes.filter(n=>n.parentId===parentId&&n.type==='picture');
  const firstX=isFrame?24:parent?Math.max(24,...siblings.map(n=>n.position.x))+236:node.position.x+236;
  const width=firstX+(count-1)*236+248;
  set(s=>({nodes:[...s.nodes.map(n=>{let next=n;if(n.id===id)next={...n,data:{...n.data,loading:false}};if(n.id===parentId)next={...next,style:{...next.style,width},data:{...next.data,effect:'',candidateCount:siblings.length+count}};return next;}),...Array.from({length:count},(_,i)=>({...seed,selected:false,dragging:false,id:`result-${crypto.randomUUID()}`,position:{x:firstX+i*236,y:parentId?30:node.position.y},parentId,extent:undefined,data:{...seed.data,final:false,highlight:false,label:`新候选 0${i+1}`,loading:false,effect:action,editCount:(node.data.editCount??0)+1}}))],pending:Math.max(0,s.pending-1),history:[`刚刚 · ${node.data.slot}新增 ${count} 张候选`,...s.history],editor:null}));
 },reset:()=>set({nodes:initialNodes(),selected:[],contextId:null,editor:null,messages:[],pending:0,references:[]})
}));
