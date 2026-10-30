import "server-only";
import {db} from "./db";
import {json} from "./agent-state";
import {conversationImages,conversationImageSchema,type SlotReference} from "./generation-references";
import {StudioError} from "./studio-error";

export async function conversationImageState(sessionId:string){
 const session=await db.agentSession.findUniqueOrThrow({where:{id:sessionId}});
 const messages=await db.chatMessage.findMany({where:{sessionId,role:"user"},orderBy:[{createdAt:"asc"},{id:"asc"}],select:{content:true}});
 const ids=[...new Set(messages.flatMap(m=>{const c=m.content as {referenceAssetIds?:string[];referenceAssetId?:string};return [...c.referenceAssetIds??[],...c.referenceAssetId?[c.referenceAssetId]:[]];}))];
 const assets=await db.asset.findMany({where:{productId:session.productId,id:{in:ids},type:{not:"mask"},deletedAt:null},select:{id:true}});
 const valid=new Set(assets.map(a=>a.id)),images=conversationImages(session.settings).filter(i=>valid.has(i.assetId));
 return {images,assetIds:ids.filter(id=>valid.has(id)),unresolved:ids.filter(id=>valid.has(id)&&!images.some(i=>i.assetId===id))};
}
export async function requireResolvedImages(sessionId:string,ignoreIds:string[]=[],read=conversationImageState){
 const state=await read(sessionId);
 if(state.unresolved.some(id=>!ignoreIds.includes(id)))throw new StudioError("这张图是产品图还是参考图？如果是参考图，请告诉我要参考光线、构图、场景、色调或道具中的哪些方面。",409);
 return state;
}
export async function saveConversationImages(sessionId:string,raw:unknown){
 const items=conversationImageSchema.array().min(1).max(10).parse(raw),state=await conversationImageState(sessionId);
 if(items.some(i=>!state.assetIds.includes(i.assetId)))throw new StudioError("只能指定当前对话中已引用图片的用途",404);
 if(new Set(items.map(i=>i.assetId)).size!==items.length)throw new StudioError("图片用途重复，请每张图片只指定一种用途");
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "AgentSession" WHERE id=${sessionId} FOR UPDATE`;
  const session=await tx.agentSession.findUniqueOrThrow({where:{id:sessionId}}),settings=session.settings as Record<string,unknown>;
  const merged=new Map(conversationImages(settings).map(i=>[i.assetId,i]));
  for(const item of items){
   const asset=await tx.asset.findFirst({where:{id:item.assetId,productId:session.productId,deletedAt:null,type:{not:"mask"}}});
   if(!asset)throw new StudioError("图片已删除或不属于本产品",404);
   if(item.role==="product"&&asset.type!=="generated"){
    await tx.asset.update({where:{id:asset.id},data:{type:"photo"}});
    await tx.productDocument.updateMany({where:{productId:session.productId,assetId:asset.id},data:{imageType:"photo"}});
   }
   if(item.role==="product"&&asset.type==="generated")throw new StudioError("生成候选可作为参考图或编辑原图；请用产品实拍锁定产品身份");
   merged.set(item.assetId,item);
  }
  const images=[...merged.values()];
  await tx.agentSession.update({where:{id:sessionId},data:{settings:json({...settings,conversationImages:images})}});
  return {images,instruction:"图片用途已保存。参考图只使用purpose指定方面；用途不明确时用一句话追问，不创建确认卡。"};
 });
}
export async function currentEditReferences(sessionId:string,sourceAssetId:string,explicit?:SlotReference[],deps={read:requireResolvedImages,save:saveConversationImages}){
 const state=await deps.read(sessionId,[sourceAssetId]);
 if(state.unresolved.includes(sourceAssetId))await deps.save(sessionId,[{assetId:sourceAssetId,role:"source",purpose:"待编辑原图"}]);
 if(explicit?.some(r=>!state.images.some(i=>i.role==="reference"&&i.assetId===r.assetId)))throw new StudioError("新参考图必须先在当前对话说明用途",409);
 return explicit;
}
