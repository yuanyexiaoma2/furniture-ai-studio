"use client";
import type {FinalPack,OutputFrame} from "@/design-preview/workflows/types";
import {useLibraryStore} from "../library/library-store";
import {usePreviewStore,type StudioNode} from "../store";
import {useWorkflowStore} from "./workflow-store";
export function loadPack(pack:FinalPack){
 useWorkflowStore.getState().setPack(pack);
 useLibraryStore.getState().startDemo(pack.product.categoryId);
 const task=useLibraryStore.getState().task!;
 useLibraryStore.setState({task:{...task,product:structuredClone(pack.product),categoryConfirmed:true,messages:[],recipeIds:[],stage:"ready"}});
 usePreviewStore.setState({nodes:packNodes(pack),selected:[],contextId:null});
}
function packNodes(pack:FinalPack):StudioNode[]{return[{id:"pack-"+pack.id,type:"frame",position:{x:0,y:0},style:{width:760,height:260},dragHandle:".p-frame-title",data:{label:pack.sku+" · 已定稿图包",slot:"源图包",image:"",final:true,candidateCount:pack.images.length}},...pack.images.map((image,i)=>({id:image.id,type:"picture",parentId:"pack-"+pack.id,position:{x:24+236*i,y:30},style:{width:224,height:180},data:{label:image.slot,slot:image.slot,image:image.image,final:true,hideFinalBadge:true,copy:image.copy}}))];}
export function syncFrames(pack:FinalPack,frames:OutputFrame[],loading=false){
 const nodes:StudioNode[]=[...packNodes(pack)];
 frames.forEach((frame,index)=>{nodes.push({id:frame.id,type:"frame",position:{x:0,y:320*(index+1)},style:{width:Math.max(288,24+236*frame.jobs.length),height:260},dragHandle:".p-frame-title",data:{label:frame.name,slot:frame.name,image:"",candidateCount:frame.jobs.length,loading}});
 frame.jobs.forEach((job,i)=>nodes.push({id:job.id,type:"picture",parentId:frame.id,position:{x:24+236*i,y:30},style:{width:224,height:180},data:{label:job.variant?.name??job.site??"",slot:pack.images.find(x=>x.id===job.sourceImageId)?.slot??"",image:job.sourceImage,loading,variantColor:job.variant?.color,copy:job.copy}}));});
 usePreviewStore.setState({nodes,selected:[],contextId:null,editor:null});
}
export function currentFinalPack():FinalPack|null{
 const task=useLibraryStore.getState().task,all=usePreviewStore.getState().nodes,selected=usePreviewStore.getState().selected;
 const selectedFrames=selected.filter(id=>all.find(n=>n.id===id)?.type==="frame");
 const finals=all.filter(n=>n.type==="picture"&&n.data.final&&(!selectedFrames.length||selectedFrames.includes(n.parentId??"")));
 if(!task||!finals.length)return null;
 const known=useWorkflowStore.getState().pack;
 return{id:"current-"+task.id,sku:task.product.sku,name:task.product.name,product:structuredClone(task.product),images:finals.map(n=>({...known?.images.find(i=>i.id===n.id),id:n.id,slot:n.data.slot,image:/^(data:|blob:|\/)/.test(n.data.image)?n.data.image:"/design-preview/"+n.data.image+".webp",copy:n.data.copy,white:known?.images.find(i=>i.id===n.id)?.white??false,occupancy:known?.images.find(i=>i.id===n.id)?.occupancy??0,width:known?.images.find(i=>i.id===n.id)?.width??0,height:known?.images.find(i=>i.id===n.id)?.height??0}))};
}
