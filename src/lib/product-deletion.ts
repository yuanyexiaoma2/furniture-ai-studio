import "server-only";
import {db} from "./db";
import {StudioError} from "./studio-error";
import type {Prisma} from "@/generated/prisma/client";

export const DELETED_PRODUCT_KIND="deleted_product";
const markerId=(productId:string)=>"deleted-product:"+productId;
type Store=Pick<Prisma.TransactionClient,"studioLibraryEntry">;
export async function assertProductActive(store:Store,productId:string){
 if(await store.studioLibraryEntry.findUnique({where:{id:markerId(productId)},select:{id:true}}))throw new StudioError("该项目已删除",404);
}
export async function deletedProductIds(){
 const rows=await db.studioLibraryEntry.findMany({where:{kind:DELETED_PRODUCT_KIND},select:{id:true}});
 return rows.map(row=>row.id.slice("deleted-product:".length));
}
export async function setProductDeleted(productId:string,actor:{id:string;role:string},deleted:boolean,confirmationSku?:string){
 if(actor.role==="viewer")throw new StudioError("只读成员不能删除或恢复项目",403);
 return db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${productId}, 0))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`identity:${productId}`}, 0))`;
  const product=await tx.product.findUnique({where:{id:productId},select:{id:true,sku:true,name:true,createdById:true}});
  if(!product)throw new StudioError("项目不存在",404);
  if(actor.role!=="admin"&&product.createdById!==actor.id)throw new StudioError("只能删除或恢复自己创建的项目",403);
  if(deleted){
   if(confirmationSku!==product.sku)throw new StudioError("项目信息已变化，请刷新后重新选择删除",409);
   const busy=await tx.generationJob.count({where:{productId,status:{in:["pending","running"]}}})+await tx.llmCall.count({where:{productId,status:"running"}})+await tx.agentSession.count({where:{productId,runningAt:{gt:new Date(Date.now()-300000)}}});
   if(busy)throw new StudioError("项目有正在执行的生成或识别任务，请等待完成后再删除",409);
   await tx.studioLibraryEntry.upsert({where:{id:markerId(productId)},create:{id:markerId(productId),kind:DELETED_PRODUCT_KIND,name:product.name,data:{productId,deletedById:actor.id,deletedAt:new Date().toISOString()}},update:{}});
  }else await tx.studioLibraryEntry.deleteMany({where:{id:markerId(productId),kind:DELETED_PRODUCT_KIND}});
  return {id:productId,deleted};
 });
}
