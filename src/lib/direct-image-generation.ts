import "server-only";
import {createHash,randomUUID} from "node:crypto";
import {db} from "./db";
import {json} from "./agent-state";
import {directImageSchema,directReferencePrompt,directReferenceSnapshot,type DirectImageSelection} from "./direct-image-rules";
import {selectedCandidate} from "./studio-models";
import {validateImageSelection} from "./image-model-input";
import {estimateImageUsd} from "./gateway-cost";
import {assertUsdQuota} from "./quota";
import {workerIsReady,getBoss} from "./generation-queue";
import {enqueueImageJob,prepareEditInput} from "./scene-generation";
import {StudioError} from "./studio-error";
import type {Prisma} from "@/generated/prisma/client";
import type {ModelCandidate} from "./models.config";
import {uploadProductDocuments} from "./product-documents";
import {uploadIssue} from "./studio-rules";
import {assertProductActive} from "./product-deletion";
import {runStudioRequest,studioRequestFingerprint} from "./studio-requests";
import {candidatesFor} from "./gateway-router";

export async function uploadDirectImages(userId:string,productId:string|undefined,files:File[],requestKey?:string){
 const issue=uploadIssue(files);
 if(!files.length||files.length>2||files.some(f=>!["image/jpeg","image/png","image/webp"].includes(f.type))||issue)throw new StudioError(issue??"请上传1至2张JPG、PNG或WEBP参考图");
 if(productId&&!await db.product.findUnique({where:{id:productId}}))throw new StudioError("商品不存在",404);
 if(productId)await assertProductActive(db,productId);
 return runStudioRequest(userId,"direct_upload",requestKey,await studioRequestFingerprint({productId:productId??null},files),async({checkpoint})=>{
 const id=productId??(await db.$transaction(async tx=>{
  const product=await tx.product.create({data:{sku:"DIRECT-"+randomUUID(),name:"自由生图",category:"自由创作",dimensions:"",materials:"",colors:"",sellingPoints:[],createdById:userId}});
  await checkpoint({productId:product.id,results:files.map(f=>({filename:f.name,error:"上传未完成，请在当前项目重新上传"}))},tx);
  return product;
 })).id;
 await db.agentSession.upsert({where:{productId_createdById:{productId:id,createdById:userId}},create:{productId:id,createdById:userId},update:{}});
 const results=await uploadProductDocuments(id,userId,files,"direct");
 await checkpoint({productId:id,results});
 return {productId:id,results};
 });
}

export async function prepareDirectImage(tx:Prisma.TransactionClient,raw:DirectImageSelection,selected?:ModelCandidate,readSize?:Parameters<typeof prepareEditInput>[11]){
 const selection=directImageSchema.parse(raw);
 if(selection.productId&&!await tx.product.findUnique({where:{id:selection.productId}}))throw new StudioError("商品不存在",404);
 if(selection.productId)await assertProductActive(tx,selection.productId);
 if(selection.referenceAssetIds.length&&!selection.productId)throw new StudioError("请先把参考图上传到当前工作台");
 const candidate=selected??await selectedCandidate("image",{auto:false,imageId:selection.modelId});
 if(selection.edit){
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${selection.productId!}, 0))`;
  await assertProductActive(tx,selection.productId!);
  const edit=selection.edit;
  const prepared=await prepareEditInput(tx,selection.productId!,selection.prompt,selection.aspectRatio,selection.resolution,{sourceAssetId:edit.sourceAssetId},candidate,[],undefined,edit.tool==="expand"?edit.expansion:undefined,edit.tool==="recolor"?edit.appearanceChange:undefined,readSize);
  const input={...prepared.input,selectedCandidate:candidate,tool:edit.tool};
  const assets=await tx.asset.findMany({where:{id:{in:input.referenceAssetIds},productId:selection.productId,deletedAt:null}});
  const fingerprint=createHash("sha256").update(JSON.stringify({selection,input,estimate:prepared.estimate,assets:input.referenceAssetIds.map(id=>{const a=assets.find(a=>a.id===id);return [id,a?.storageKey,a?.width,a?.height];})})).digest("hex");
  return {input,candidate,estimate:prepared.estimate,fingerprint};
 }
 const productIds=selection.productAssetIds??[],ids=[...productIds,...selection.referenceAssetIds];
 if(ids.length&&!selection.productId)throw new StudioError("请先选择当前产品");
 const assets=ids.length?await tx.asset.findMany({where:{id:{in:ids},productId:selection.productId,deletedAt:null,type:{in:["photo","style_ref","white_bg","generated"]}}}):[];
 if(assets.length!==ids.length)throw new StudioError("实拍或参考图已删除或不属于当前工作台",404);
 if(productIds.some(id=>assets.find(a=>a.id===id)?.type!=="photo"))throw new StudioError("产品身份必须使用当前产品实拍");
 const ordered=ids.map(id=>assets.find(a=>a.id===id)!);
 const references=directReferenceSnapshot(candidate,ordered.map(a=>({assetId:a.id,role:productIds.includes(a.id)?"product":"reference",purpose:productIds.includes(a.id)?"当前产品实拍，严格保持其结构、比例、颜色和材质；模板图片或旧提示词中的其他产品不得替换它":selection.referencePurpose?"仅借鉴"+selection.referencePurpose+"；不复制模板中的产品身份":"生成参考图，具体借鉴内容以本次提示词为准"})));
 const prompt=selection.prompt+directReferencePrompt(references.referenceUsage);
 validateImageSelection(candidate,selection.resolution,selection.aspectRatio,prompt,ordered.length);
 const input={generationMode:"direct",prompt,basePrompt:selection.prompt,sceneIntent:selection.prompt,identityTraits:"保持待修改原图的主体形态和未要求修改的画面内容；只执行本次明确的修改要求。",...references,resolution:selection.resolution,aspect_ratio:selection.aspectRatio,output_format:"png",image_input:[],submissionAttempted:false,selectedCandidate:candidate};
 const estimate=estimateImageUsd(candidate,selection.resolution,prompt,ordered);
 const fingerprint=createHash("sha256").update(JSON.stringify({selection,input,estimate,assets:ordered.map(a=>[a.id,a.storageKey,a.width,a.height])})).digest("hex");
 return {input,candidate,estimate,fingerprint};
}
export async function quoteDirectImage(selection:DirectImageSelection){
 const prepared=await db.$transaction(tx=>prepareDirectImage(tx,selection));
 return {fingerprint:prepared.fingerprint,estimatedCostUsd:prepared.estimate};
}
export async function submitDirectImage(userId:string,selection:DirectImageSelection,fingerprint:string,requestKey:string,deps={db,ready:workerIsReady,boss:getBoss,prepare:prepareDirectImage,enqueue:enqueueImageJob}){
 if(!await deps.ready())throw new StudioError("生成服务尚未启动，请管理员运行 npm run worker 后重试",503);
 await deps.boss();
 return deps.db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
  const existing=await tx.generationJob.findFirst({where:{createdById:userId,input:{path:["directRequestKey"],equals:requestKey}}});
  if(existing)return {jobId:existing.id,productId:existing.productId,estimatedCostUsd:Number(existing.reservedUsd)};
  const prepared=await deps.prepare(tx,selection);
  if(prepared.fingerprint!==fingerprint)throw new StudioError("提示词、模型或参考图已变化，请重新提交",409);
  await assertUsdQuota(tx,userId,prepared.estimate);
  const productId=selection.productId??(await tx.product.create({data:{sku:"DIRECT-"+randomUUID(),name:"自由生图",category:"自由创作",dimensions:"",materials:"",colors:"",sellingPoints:[],createdById:userId}})).id;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${productId}, 0))`;
  const session=await tx.agentSession.upsert({where:{productId_createdById:{productId,createdById:userId}},create:{productId,createdById:userId},update:{}});
  const pack=await tx.imagePack.findFirst({where:{productId,isCurrent:true}})??await tx.imagePack.create({data:{productId}});
  const order=(await tx.imageSlot.aggregate({where:{packId:pack.id},_max:{order:true}}))._max.order??0;
  // 独立图位不参加Agent整套生成，不更改原方案及确认状态。
  const title=selection.edit?{recolor:"同款换色",expand:"智能扩图",cutout:"产品抠图"}[selection.edit.tool]:"单张生图";
  const slot=await tx.imageSlot.create({data:{packId:pack.id,name:title+" "+(order+1),order:order+1,slotType:"scene",method:"manual_upload",candidateCount:1,goal:selection.prompt,aspectRatio:prepared.input.aspect_ratio}});
  const jobId=await deps.enqueue(tx,{productId,sessionId:session.id,slotId:slot.id,createdById:userId,logicalModel:"scene-main",reservedUsd:prepared.estimate,input:json({...prepared.input,directRequestKey:requestKey})});
  return {jobId,productId,estimatedCostUsd:prepared.estimate};
 },{timeout:30000});
}

export async function retryDirectImage(userId:string,productId:string,jobId:string,requestKey:string,deps={db,ready:workerIsReady,boss:getBoss,enqueue:enqueueImageJob}){
 if(!await deps.ready())throw new StudioError("生成服务尚未启动，请管理员运行 npm run worker 后重试",503);
 await deps.boss();
 return deps.db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${productId}, 0))`;
  await assertProductActive(tx,productId);
  const old=await tx.generationJob.findUnique({where:{id:jobId},include:{slot:true,retriedBy:true}});
  if(!old||old.productId!==productId||!old.slot||old.slot.deletedAt||old.status!=="failed")throw new StudioError("只能重试当前工作台已失败的单张生图或改图任务",409);
  const input=old.input as Record<string,unknown>;
  if(input.generationMode!=="direct"&&old.logicalModel!=="edit")throw new StudioError("该任务不是单张生图或图片修改",409);
  const session=await tx.agentSession.upsert({where:{productId_createdById:{productId,createdById:userId}},create:{productId,createdById:userId},update:{}});
  if(input.generationMode!=="direct"&&(!session.confirmedProfileId||!session.confirmedPack))throw new StudioError("档案或方案已变化，请重新确认后再试",409);
  const pack=await tx.imagePack.findFirst({where:{productId,isCurrent:true}});
  if(pack?.id!==old.slot.packId)throw new StudioError("该图位已不在当前工作台",409);
  if(old.retriedBy)return {jobId:old.retriedBy.id,productId};
  const candidate=(input.selectedCandidate as ModelCandidate|undefined)??candidatesFor("edit")[0];
  if(!Array.isArray(input.referenceAssetIds)||!candidate)throw new StudioError("原任务缺少完整编辑参数，请重新打开原图修改",409);
  const ids=input.referenceAssetIds as string[];
  const assets=await tx.asset.findMany({where:{id:{in:ids},productId,deletedAt:null}});
  if(assets.length!==ids.length)throw new StudioError("原任务参考图已删除，不能重试",409);
  validateImageSelection(candidate,String(input.resolution),String(input.aspect_ratio),String(input.prompt),ids.length);
  const expansion=input.expansion as {width:number;height:number}|undefined;
  const estimate=estimateImageUsd(candidate,input.resolution as "1K"|"2K"|"4K",String(input.prompt),assets.map(a=>expansion&&a.id===input.sourceAssetId?{...a,width:expansion.width,height:expansion.height}:a));
  await assertUsdQuota(tx,userId,estimate);
  const id=await deps.enqueue(tx,{productId,sessionId:session.id,slotId:old.slotId,retryOfId:old.id,createdById:userId,logicalModel:old.logicalModel,reservedUsd:estimate,input:json({...input,selectedCandidate:candidate,directRequestKey:requestKey,submissionAttempted:false,uncertainCharge:false,autoRetryCount:0,referenceRetryCount:0,image_input:[],switchReason:null})});
  return {jobId:id,productId};
 },{timeout:30000});
}
