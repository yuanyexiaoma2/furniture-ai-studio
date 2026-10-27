import {NextResponse} from "next/server";
import {z} from "zod";
import {randomUUID} from "node:crypto";
import {studioUser,studioError,StudioError} from "@/lib/studio-api";
import {db} from "@/lib/db";
import {studioSnapshot,inspectStudioProduct,confirmStudioCategory,studioShooting,studioProfileCard,planStudioTask,updateStudioSettings,studioEdit,quoteStudioEdit} from "@/lib/studio-main";
import {agentSession,json} from "@/lib/agent-state";
import {approveAgentCard,createCostCard} from "@/lib/agent-actions";
import {inspectPhoto,putObject} from "@/lib/storage";
import {quoteBatch,submitBatch} from "@/lib/image-packs";
export const runtime="nodejs";export const maxDuration=300;
type Ctx={params:Promise<{id:string}>};
export async function GET(request:Request,context:Ctx){try{const user=await studioUser(request);return NextResponse.json(await studioSnapshot((await context.params).id,user.id));}catch(e){return studioError(e,"读取工作台失败，请检查服务后刷新");}}
export async function POST(request:Request,context:Ctx){
 try{
 const user=await studioUser(request,true),productId=(await context.params).id;
 if(request.headers.get("content-type")?.startsWith("multipart/form-data")){
 const form=await request.formData(),file=form.get("mask");if(!(file instanceof File)||file.size>10*1024*1024)throw new StudioError("蒙版必须为10MB以内的PNG，请重新涂抹");
 const bytes=Buffer.from(await file.arrayBuffer()),photo=await inspectPhoto(bytes),storageKey="products/"+productId+"/masks/"+randomUUID()+".png";
 if(!await db.product.findUnique({where:{id:productId}}))throw new StudioError("SKU不存在",404);
 await putObject(storageKey,bytes,photo.mime);const asset=await db.asset.create({data:{productId,createdById:user.id,type:"mask",storageKey,width:photo.width,height:photo.height}});return NextResponse.json({assetId:asset.id});
 }
 const body=z.object({action:z.string(),data:z.record(z.string(),z.unknown()).default({})}).strict().parse(await request.json()),data=body.data;
 const session=await agentSession(productId,user.id);
 if(body.action==="inspect")await lockedOperation(session.id,"inspect_product",()=>inspectStudioProduct(productId,user.id));
 else if(body.action==="settings")await updateStudioSettings(productId,user.id,data);
 else if(body.action==="category")await confirmStudioCategory(productId,user.id,z.string().parse(data.categoryId));
 else if(body.action==="shooting")await studioShooting(productId,user.id,z.enum(["quick","strict"]).parse(data.mode),data.skip===true);
 else if(body.action==="profile")await studioProfileCard(productId,user.id);
 else if(body.action==="plan")await lockedOperation(session.id,"plan_image_pack",()=>planStudioTask(productId,user.id));
 else if(body.action==="generate")await createCostCard(session.id,{operation:"generate_batch"});
 else if(body.action==="approve")await approveAgentCard(session.id,z.string().parse(data.cardId),(data.changes??{}) as Record<string,unknown>);
 else if(body.action==="edit_quote"){const a=z.object({assetId:z.string(),instruction:z.string().trim().min(1).max(8000),maskAssetId:z.string().optional(),expansion:z.object({width:z.number(),height:z.number(),offsetX:z.number(),offsetY:z.number()}).optional()}).strict().parse(data);const quote=await quoteStudioEdit(productId,user.id,a.assetId,a.instruction,a);await db.chatMessage.create({data:{sessionId:session.id,productId,role:"system",content:{text:"本次修改预计 $"+quote.estimatedCostUsd.toFixed(2)+"（估），确认后开始。"+(quote.warning??"")}}});return NextResponse.json(quote);}
 else if(body.action==="edit"){
 const a=z.object({assetId:z.string(),instruction:z.string().trim().min(1).max(8000),maskAssetId:z.string().optional(),expansion:z.object({width:z.number().int().min(1).max(16000),height:z.number().int().min(1).max(16000),offsetX:z.number().int().min(-16000).max(16000),offsetY:z.number().int().min(-16000).max(16000)}).optional(),requestKey:z.string().uuid(),fingerprint:z.string().min(1)}).strict().parse(data);
 const result=await studioEdit(productId,user.id,a.assetId,a.instruction,a);await db.chatMessage.create({data:{sessionId:session.id,productId,role:"system",content:json({text:result.warning??"已按要求提交修改，原图与原始实拍均已保留",jobId:result.jobId})}});return NextResponse.json(result);
 }else if(body.action==="retry"){
 const jobId=z.string().parse(data.jobId),quote=await quoteBatch(user.id,productId,{retryJobId:jobId});if(!session.confirmedProfileId||!session.confirmedPack)throw new StudioError("档案或方案已变化，请重新确认后再试",409);return NextResponse.json({batchId:await submitBatch(user.id,productId,{retryJobId:jobId},quote.fingerprint,z.string().uuid().parse(data.requestKey),session.id)});
 }else throw new StudioError("不支持此操作，请刷新工作台",400);
 return NextResponse.json(await studioSnapshot(productId,user.id));
 }catch(e){return studioError(e,"操作未完成，已执行记录保留；请刷新核对后重试");}
}

async function lockedOperation<T>(sessionId:string,name:string,run:()=>Promise<T>){
 const claim=await db.agentSession.updateMany({where:{id:sessionId,OR:[{runningAt:null},{runningAt:{lt:new Date(Date.now()-300000)}}]},data:{runningAt:new Date()}});
 if(!claim.count)throw new StudioError("当前资料正在识别或规划，请等待完成后再试",409);
 let toolId:string|undefined;
 try{
  toolId=(await db.agentToolCall.create({data:{sessionId,callId:"studio-"+randomUUID(),name,arguments:{},status:"running"}})).id;
  const result=await run();await db.agentToolCall.update({where:{id:toolId},data:{status:"success",result:{completed:true},completedAt:new Date()}});return result;
 }catch(e){if(toolId)await db.agentToolCall.update({where:{id:toolId},data:{status:"failed",error:e instanceof Error?e.message:"本次操作未完成",completedAt:new Date()}});throw e;}
 finally{await db.agentSession.update({where:{id:sessionId},data:{runningAt:null}});}
}
