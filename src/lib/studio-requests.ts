import "server-only";
import {createHash} from "node:crypto";
import {z} from "zod";
import {db} from "./db";
import type {Prisma} from "@/generated/prisma/client";
import {StudioError} from "./studio-error";
import {safeGatewayMessage,GatewayError} from "./gateway-error";

export const STUDIO_REQUEST_KIND="studio_request";
type RequestState="running"|"success"|"failed";
type RecordData={ownerId:string;operation:string;fingerprint:string;state:RequestState;startedAt:string;result?:unknown;error?:string;status?:number};
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export class StudioRequestError extends StudioError{
 constructor(message:string,status:number,public requestState:"running"|"failed"|"mismatch"){super(message,status);}
}
export async function studioRequestFingerprint(fields:unknown,files:File[]){
 const hash=createHash("sha256").update(JSON.stringify(fields));
 for(const file of files)hash.update(JSON.stringify([file.name,file.type,file.size])).update(Buffer.from(await file.arrayBuffer()));
 return hash.digest("hex");
}
type Context={checkpoint:(result:unknown,tx?:Prisma.TransactionClient)=>Promise<void>};

// 复用现有记录表；同次未知响应只读取结果，不重建项目或重发模型。
export async function runStudioRequest<T>(userId:string,operation:string,requestKey:string|undefined,fingerprint:string,run:(context:Context)=>Promise<T>):Promise<T>{
 if(!requestKey)return run({checkpoint:async()=>{}}); // 兼容旧脚本的单次调用。
 if(!z.string().uuid().safeParse(requestKey).success)throw new StudioError("提交编号无效，请重新选择资料",400);
 const id="studio-request:"+createHash("sha256").update(JSON.stringify([userId,operation,requestKey])).digest("hex");
 const initial:RecordData={ownerId:userId,operation,fingerprint,state:"running",startedAt:new Date().toISOString()};
 const claim=await db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id},0))`;
  const previous=await tx.studioLibraryEntry.findUnique({where:{id}});
  if(previous){
   const data=previous.data as unknown as RecordData;
   if(data.fingerprint!==fingerprint)throw new StudioRequestError("提交内容已变化，请重新提交",409,"mismatch");
   if(data.state==="success"||data.state==="failed"&&data.result!==undefined)return {replay:true,result:data.result as T};
   if(data.state==="failed")throw new StudioRequestError(data.error??"上次提交未完成，请核对记录后重新提交",data.status??503,"failed");
   // 已创建项目遇到进程中断时，返回保留的项目，仍不重新上传或自动识别。
   if(["create_project","direct_upload"].includes(operation)&&data.result!==undefined&&Date.now()-Date.parse(data.startedAt)>10*60_000)return {replay:true,result:data.result as T};
   throw new StudioRequestError("同一次提交仍在处理或等待结果，请稍后重试，不会重复提交",409,"running");
  }
  await tx.studioLibraryEntry.create({data:{id,kind:STUDIO_REQUEST_KIND,name:operation,data:json(initial)}});
  return {replay:false,result:undefined};
 });
 if(claim.replay)return claim.result!;
 try{
  const result=await run({checkpoint:async(value,tx)=>{await (tx??db).studioLibraryEntry.update({where:{id},data:{data:json({...initial,result:value})}});}});
  await db.studioLibraryEntry.update({where:{id},data:{data:json({...initial,state:"success",result})}});
  return result;
 }catch(error){
  const message=safeGatewayMessage(error instanceof Error?error.message:"提交未完成"),status=error instanceof StudioError||error instanceof GatewayError?error.status:503;
  // 若结果写入已成功而响应丢失，不把成功记录覆盖成失败。
  const previous=await db.studioLibraryEntry.findUnique({where:{id}}).catch(()=>null);
  const data=previous?.data as unknown as RecordData|undefined;
  if(data?.state==="success")return data.result as T;
  const checkpoint=data?.result;
  await db.studioLibraryEntry.update({where:{id},data:{data:json({...initial,state:"failed",error:message,status,...(checkpoint!==undefined?{result:checkpoint}:{})})}}).catch(()=>undefined);
  if(checkpoint!==undefined)return checkpoint as T;
  throw new StudioRequestError(message,status,"failed");
 }
}
