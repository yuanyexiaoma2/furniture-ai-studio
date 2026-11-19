import "server-only";
import {createHash} from "node:crypto";
import {db} from "./db";
import {agentSession,json} from "./agent-state";
import {readObject,putObject} from "./storage";
import {StudioError} from "./studio-error";
import {conversationImages} from "./generation-references";
import {savedReferenceInput,savedReferenceSchema,savedGenerationSnapshot,templateUpdateSchema,templatePrompt} from "./saved-reference-rules";
import {assertProductActive} from "./product-deletion";

const savedReferenceIO={db,session:agentSession,storage:{read:readObject,write:putObject}};
const kind="saved_reference";
const key=(...parts:string[])=>createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0,40);
export async function listSavedReferences(userId:string,{db}=savedReferenceIO){
 const rows=await db.studioLibraryEntry.findMany({where:{kind,data:{path:["ownerId"],equals:userId}},orderBy:{updatedAt:"desc"}});
 return rows.flatMap(row=>{const parsed=savedReferenceSchema.safeParse(row.data);return parsed.success&&parsed.data.ownerId===userId?[{...parsed.data,id:row.id}]:[];});
}
export async function templateDraft(productId:string,assetId:string){
 await assertProductActive(db,productId);
 const asset=await db.asset.findFirst({where:{id:assetId,productId,type:"generated",deletedAt:null}});
 const job=asset&&await db.generationJob.findFirst({where:{productId,status:"success",resultAssetIds:{array_contains:[assetId]}},orderBy:{createdAt:"desc"}});
 if(!job)throw new StudioError("请选择已完成的生成图片",404);
 const product=await db.product.findUniqueOrThrow({where:{id:productId}}),input=job.input as Record<string,unknown>;
 const slot=(input.visualPlan as {slot?:{scene?:string}}|undefined)?.slot;
 return {category:product.category,scene:slot?.scene??"",reusablePrompt:typeof input.basePrompt==="string"?input.basePrompt:typeof input.prompt==="string"?input.prompt:""};
}
export async function saveReference(userId:string,raw:unknown,{db}=savedReferenceIO){
 const input=savedReferenceInput.parse(raw);
 const asset=await db.asset.findFirst({where:{id:input.assetId,productId:input.productId,type:"generated",deletedAt:null}});
 const job=asset&&await db.generationJob.findFirst({where:{productId:input.productId,status:"success",resultAssetIds:{array_contains:[input.assetId]}},orderBy:{createdAt:"desc"}});
 if(!asset||!job)throw new StudioError("请选择已完成的生成图片再收藏",404);
 const id="saved-"+key(userId,input.assetId),data=savedReferenceSchema.parse({version:1,ownerId:userId,...input,jobId:job.id,createdAt:new Date().toISOString(),...savedGenerationSnapshot(job.input as Record<string,unknown>),model:job.model??job.logicalModel});
 await db.studioLibraryEntry.upsert({where:{id},create:{id,kind,name:input.name,data:json(data)},update:{name:input.name,data:json(data)}});
 return {...data,id};
}
export async function updateSavedTemplate(userId:string,id:string,raw:unknown){
 const fields=templateUpdateSchema.parse(raw);
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "StudioLibraryEntry" WHERE id=${id} FOR UPDATE`;
  const row=await tx.studioLibraryEntry.findFirst({where:{id,kind,data:{path:["ownerId"],equals:userId}}});
  const saved=savedReferenceSchema.safeParse(row?.data);if(!saved.success||saved.data.ownerId!==userId)throw new StudioError("模板不存在或不属于当前账号",404);
  const data=savedReferenceSchema.parse({...saved.data,...fields});await tx.studioLibraryEntry.update({where:{id},data:{name:data.name,data:json(data)}});return {...data,id};
 });
}
export async function reuseReference(userId:string,id:string,productId:string,{db,session:loadSession,storage}=savedReferenceIO,options:{attach?:boolean;withPrompt?:boolean}={}){
 const row=await db.studioLibraryEntry.findFirst({where:{id,kind,data:{path:["ownerId"],equals:userId}}});
 const saved=savedReferenceSchema.safeParse(row?.data);
 if(!saved.success||saved.data.ownerId!==userId)throw new StudioError("收藏不存在或不属于当前账号",404);
 const source=await db.asset.findFirst({where:{id:saved.data.assetId,productId:saved.data.productId,deletedAt:null}});
 if(!source)throw new StudioError("收藏原图已不可用，原有记录仍保留",409);
 if(options.attach===false)await assertProductActive(db,productId);
 const session=await loadSession(productId,userId);
 // 参考复制到当前产品，沿用原有归属校验；不借此放开跨产品图片访问或直接使用旧产品提示词。
 const assetId="savedref-"+key(userId,id,productId),storageKey="products/"+productId+"/references/"+assetId;
 const existing=await db.asset.findUnique({where:{id:assetId}});
 if(!existing){const object=await storage.read(source.storageKey);await storage.write(storageKey,object.bytes,object.mime);}
 await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "AgentSession" WHERE id=${session.id} FOR UPDATE`;
  await tx.asset.upsert({where:{id:assetId},create:{id:assetId,productId,createdById:userId,type:"style_ref",storageKey,width:source.width,height:source.height},update:{deletedAt:null}});
  // 直接使用模板仅复制参考图；是否传图由本次生成面板决定，不改变对话参考用途。
  if(options.attach===false)return;
  const current=await tx.agentSession.findUniqueOrThrow({where:{id:session.id}}),settings=current.settings as Record<string,unknown>;
  const images=new Map(conversationImages(settings).map(image=>[image.assetId,image]));
  images.set(assetId,{assetId,role:"reference",purpose:saved.data.purpose,mode:"prompt_only"});
  await tx.agentSession.update({where:{id:session.id},data:{settings:json({...settings,conversationImages:[...images.values()]})}});
  const text="选用收藏参考「"+saved.data.name+"」。只借鉴："+saved.data.purpose+"。产品身份仍以当前产品实拍为准。"+(options.withPrompt?"\n请适配以下模板提示词，替换旧产品结构、颜色、材质，借鉴场景与画面表达，不直接照搬：\n"+templatePrompt(saved.data):"");
  await tx.chatMessage.upsert({where:{requestKey:"saved-use-"+key(userId,id,productId)},create:{requestKey:"saved-use-"+key(userId,id,productId),productId,sessionId:session.id,role:"user",content:json({text,referenceAssetIds:[assetId]})},update:{content:json({text,referenceAssetIds:[assetId]})}});
 });
 return {assetId,purpose:saved.data.purpose};
}
