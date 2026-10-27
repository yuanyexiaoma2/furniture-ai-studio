import "server-only";
import {db} from "./db";
import {agentSession,json} from "./agent-state";
import {StudioError} from "./studio-error";
import {canvasLayoutSchema,canvasSelectionSchema,emptyCanvasLayout,reconcileCanvasLayout,sameCanvasLayout,summarizeCanvas,type CanvasElement,type CanvasSelection,type CanvasLayout} from "./canvas-rules";

export async function canvasRegistry(productId:string):Promise<CanvasElement[]>{
 const [photos,pack]=await Promise.all([
  db.asset.findMany({where:{productId,deletedAt:null,type:"photo"},orderBy:[{sortOrder:"asc"},{id:"asc"}],select:{id:true,type:true}}),
  db.imagePack.findFirst({where:{productId,isCurrent:true},include:{slots:{where:{deletedAt:null},orderBy:{order:"asc"},include:{jobs:{where:{retriedBy:null},orderBy:[{createdAt:"asc"},{id:"asc"}]}}}}}),
 ]);
 const elements:CanvasElement[]=[];
 if(photos.length){elements.push({id:"reference-frame",type:"frame",label:"产品实拍与风格参考",x:-620,y:0,width:540,height:Math.max(280,Math.ceil(photos.length/2)*250+50)});photos.forEach((p,i)=>elements.push({id:p.id,type:"picture",assetId:p.id,label:(p.type==="photo"?"原始实拍 ":"风格参考 ")+(i+1),parentId:"reference-frame",x:24+(i%2)*260,y:30+Math.floor(i/2)*250,width:240,height:220}));}
 for(const [i,slot]of(pack?.slots??[]).entries()){
  const parentId="slot-"+slot.id,children:CanvasElement[]=[];
  for(const job of slot.jobs){const assets=Array.isArray(job.resultAssetIds)?job.resultAssetIds.filter((id):id is string=>typeof id==="string"):[];
   if(assets.length)for(const assetId of assets)children.push({id:assetId,type:"picture",assetId,slotId:slot.id,parentId,label:slot.name+" · 候选 "+(children.length+1),final:assetId===slot.finalAssetId,x:24+children.length*260,y:30,width:240,height:220});
   else children.push({id:"job-"+job.id,type:"picture",slotId:slot.id,parentId,label:slot.name+" · "+(job.status==="failed"?"生成失败":"生成任务"),x:24+children.length*260,y:30,width:240,height:220});
  }
  elements.push({id:parentId,type:"frame",slotId:slot.id,label:slot.name,x:0,y:i*340,width:Math.max(540,children.length*260+48),height:280},...children);
 }
 // 不把已删除资源暴露给模型，即使历史任务仍保留旧ID。
 const assetIds=elements.flatMap(e=>e.assetId?[e.assetId]:[]),valid=new Set((await db.asset.findMany({where:{id:{in:assetIds},productId,deletedAt:null},select:{id:true}})).map(a=>a.id));
 let alias=0;return elements.filter(e=>!e.assetId||valid.has(e.assetId)).map(e=>({...e,...(e.assetId?{alias:"C"+(++alias)}:{})}));
}
async function reconcileCurrentLayout(productId:string,layout:CanvasLayout){
 const allowed=new Set((await canvasRegistry(productId)).map(e=>e.id)),outdated=[...new Set([...layout.nodes.map(n=>n.id),...layout.hiddenIds])].filter(id=>!allowed.has(id));
 if(!outdated.length)return layout;
 const [assets,jobs,slots]=await Promise.all([
  db.asset.findMany({where:{id:{in:outdated},productId},select:{id:true}}),
  db.generationJob.findMany({where:{id:{in:outdated.filter(id=>id.startsWith("job-")).map(id=>id.slice(4))},productId},select:{id:true,resultAssetIds:true}}),
  db.imageSlot.findMany({where:{id:{in:outdated.filter(id=>id.startsWith("slot-")).map(id=>id.slice(5))},pack:{productId}},select:{id:true}}),
 ]);
 const replacements=new Map<string,string[]>([...assets.map(a=>[a.id,[]] as [string,string[]]),...slots.map(s=>["slot-"+s.id,[]] as [string,string[]])]);
 if(outdated.includes("reference-frame"))replacements.set("reference-frame",[]);
 for(const job of jobs)replacements.set("job-"+job.id,Array.isArray(job.resultAssetIds)?job.resultAssetIds.filter((id):id is string=>typeof id==="string"&&allowed.has(id)):[]);
 // 外商品或伪造ID仍拒绝，只有已确认归属的失效元素可以自动整理。
 if(outdated.some(id=>!replacements.has(id)))throw new StudioError("画布包含不属于当前SKU的元素，请重新打开当前商品",400);
 return reconcileCanvasLayout(layout,replacements);
}
export async function loadCanvasState(productId:string,userId:string){
 const session=await agentSession(productId,userId),parsed=canvasLayoutSchema.safeParse(session.canvasLayout);
 return {revision:session.canvasRevision,layout:await reconcileCurrentLayout(productId,parsed.success?parsed.data:emptyCanvasLayout())};
}
export async function saveCanvasState(productId:string,userId:string,revision:number,raw:unknown){
 const session=await agentSession(productId,userId),layout=await reconcileCurrentLayout(productId,canvasLayoutSchema.parse(raw));
 const saved=await db.agentSession.updateMany({where:{id:session.id,canvasRevision:revision},data:{canvasLayout:json(layout),canvasRevision:{increment:1}}});
 if(!saved.count){
  const current=await loadCanvasState(productId,userId);
  if(sameCanvasLayout(current.layout,layout))return current;
  throw new StudioError("其他窗口保存了不同的画布布局；当前未保存的修改仍保留",409);
 }
 return {revision:revision+1,layout};
}
export async function canvasContext(productId:string,userId:string,raw:Partial<CanvasSelection>={}){
 const selection=canvasSelectionSchema.parse(raw),[state,registry]=await Promise.all([loadCanvasState(productId,userId),canvasRegistry(productId)]),hidden=new Set(state.layout.hiddenIds),placements=new Map(state.layout.nodes.map(n=>[n.id,n]));
 const visible=registry.filter(e=>!hidden.has(e.id)&&!hidden.has(e.parentId??""));
 const notes:CanvasElement[]=state.layout.notes.map(n=>({id:n.id,type:"note",label:n.text,x:n.x,y:n.y,width:n.width??220,height:n.height??160}));
 const elements=[...visible.map(e=>({...e,...placements.get(e.id)})),...notes];
 for(const id of selection.selectedIds)if(!elements.some(e=>e.id===id))throw new StudioError("选中的图片或便签已不在当前画布，请重新选择",409);
 const references=[...new Set([...selection.referenceAssetIds,...elements.filter(e=>selection.selectedIds.includes(e.id)&&e.assetId).map(e=>e.assetId!)])];
 if(references.length>6)throw new StudioError("一次最多引用6张图片，请减少选择");
 for(const id of references)if(!registry.some(e=>e.assetId===id))throw new StudioError("引用图片不属于当前SKU或已删除",404);
 const absolute=elements.map(e=>{const p=elements.find(p=>p.id===e.parentId);return {...e,x:e.x+(p?.x??0),y:e.y+(p?.y??0)};});
 return {summary:summarizeCanvas(absolute,selection.selectedIds,state.layout.viewport),elements:absolute,referenceAssetIds:references,selection,registry};
}
