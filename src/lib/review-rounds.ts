import "server-only";
import {db} from "./db";
import {json} from "./agent-state";
import {StudioError} from "./studio-error";
import {readReviewSource} from "./review-source";
import {reviewActionSchema,reviewSnapshotSchema,type ReviewRoundView,type SummaryRow} from "./review-scoring-rules";
import type {ReviewRound,ReviewRating} from "@/generated/prisma/client";
export function roundView(row:ReviewRound&{ratings:ReviewRating[]}):ReviewRoundView{return {id:row.id,number:row.number,planVersion:row.planVersion,libraryEntryCount:row.libraryEntryCount,libraryEligibleCount:row.libraryEligibleCount,createdByName:row.createdByName,createdAt:row.createdAt.toISOString(),ratings:row.ratings.map(r=>({...r,createdAt:r.createdAt.toISOString()}))} as ReviewRoundView;}
export async function reviewRounds(productId:string){return db.reviewRound.findMany({where:{productId},orderBy:{number:"asc"},include:{ratings:{orderBy:[{createdAt:"asc"},{id:"asc"}]}}});}
export async function reviewSummaryRows():Promise<SummaryRow[]>{const rows=await db.reviewRound.findMany({orderBy:[{productId:"asc"},{number:"asc"}],include:{ratings:{orderBy:[{createdAt:"asc"},{id:"asc"}]}}});return rows.map(row=>{const s=reviewSnapshotSchema.parse(row.snapshot);return {...roundView(row),productId:row.productId,sku:s.sku,name:s.name,slotKeys:s.plan.slots.map(s=>s.key)};});}
export async function applyReviewAction(productId:string,user:{id:string;name?:string|null},raw:unknown){
 const action=reviewActionSchema.parse(raw),reviewerName=user.name?.trim()||"未命名成员";
 if(action.action==="start"){
  const source=await readReviewSource(productId);
  if(!source.plan)throw new StudioError("请先生成视觉方案再开始评分",409);
  if(action.planVersion!==source.planVersion)throw new StudioError("方案、样图或经验库已变化，请刷新后开始本轮",409);
  return db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"review:"+productId},0))`;
   const existing=await tx.reviewRound.findUnique({where:{productId_number:{productId,number:action.nextRound}}});
   if(existing){if(existing.planVersion!==source.planVersion)throw new StudioError("本轮已由其他人开始，请刷新",409);return existing;}
   const latest=await tx.reviewRound.findFirst({where:{productId},orderBy:{number:"desc"}});
   if(action.nextRound!==(latest?.number??0)+1)throw new StudioError("评分轮次已变化，请刷新",409);
   return tx.reviewRound.create({data:{productId,number:action.nextRound,planVersion:source.planVersion,libraryEntryCount:source.libraryEntryCount,libraryEligibleCount:source.libraryEligibleCount,snapshot:json({sku:source.sku,name:source.name,plan:source.plan,images:source.images,diff:source.diff,generatedAt:source.generatedAt}),createdById:user.id,createdByName:reviewerName}});
  });
 }
 return db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"review-score:"+action.roundId},0))`;
  const round=await tx.reviewRound.findFirst({where:{id:action.roundId,productId}});
  if(!round)throw new StudioError("评分轮次不属于本产品",404);
  const snapshot=reviewSnapshotSchema.parse(round.snapshot);
  if(!snapshot.plan.slots.some(s=>s.key===action.slotKey))throw new StudioError("图位不属于本轮方案",400);
  const latest=await tx.reviewRating.findFirst({where:{roundId:round.id,slotKey:action.slotKey},orderBy:[{createdAt:"desc"},{id:"desc"}]});
  if(!latest||latest.decision!==action.decision||latest.reason!==action.reason||latest.reviewerId!==user.id)await tx.reviewRating.create({data:{roundId:round.id,slotKey:action.slotKey,decision:action.decision,reason:action.reason,reviewerId:user.id,reviewerName}});
  return round;
 });
}
