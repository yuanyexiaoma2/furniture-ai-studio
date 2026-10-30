import "server-only";
import {conversationImages} from "./generation-references";
import { db } from "./db";
import { emptyProfile, profileSchema, understanding } from "./profile-rules";
import type { Prisma } from "@/generated/prisma/client";
import { StudioError } from "./studio-error";
export function json(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)); }
export async function agentSession(productId: string, userId: string) {
  if (!await db.product.findUnique({ where: { id: productId } })) throw new StudioError("商品不存在", 404);
  const where={productId_createdById:{productId,createdById:userId}};
  try{return await db.agentSession.upsert({where,create:{productId,createdById:userId,profileDraft:emptyProfile()},update:{}});}
  catch(error){
    // 首次进入时画布、对话和商品快照会并发读取同一会话；复用已创建的记录。
    if((error as {code?:string}).code==="P2002"){const existing=await db.agentSession.findUnique({where});if(existing)return existing;}
    throw error;
  }
}
export async function agentSnapshot(productId: string, userId: string) {
  const session = await agentSession(productId, userId);
  await recoverAgentCards(session.id);
  await db.agentCard.updateMany({where:{sessionId:session.id,kind:"cost",status:"pending"},data:{status:"cancelled"}});
  if(!session.runningAt||Date.now()-session.runningAt.getTime()>300000)await db.agentToolCall.updateMany({where:{sessionId:session.id,status:"running",createdAt:{lt:new Date(Date.now()-300000)}},data:{status:"failed",error:"上次处理已中断，请核对已保存结果后继续；没有自动重试",completedAt:new Date()}});
  const [messages, cards, documents, calls, jobs, tools] = await Promise.all([
    db.chatMessage.findMany({ where: { sessionId: session.id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    db.agentCard.findMany({ where: { sessionId: session.id }, orderBy: { createdAt: "asc" } }),
    db.productDocument.findMany({ where: { productId }, orderBy: { createdAt: "asc" }, select: { id: true, filename: true, type: true, parseStatus: true, imageType: true, assetId: true, error: true } }),
    db.llmCall.findMany({ where: { sessionId: session.id }, select: { costUsd: true, reservedUsd: true, costEstimated: true, status: true } }),
    db.generationJob.findMany({ where: { sessionId: session.id }, select: { costUsd: true, reservedUsd: true, costEstimated: true, status: true } }),
    db.agentToolCall.findMany({ where: { sessionId: session.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const latest=await db.productProfile.findFirst({where:{productId},orderBy:{version:"desc"}});
  const parsed = profileSchema.safeParse(session.profileDraft), saved=profileSchema.safeParse(latest?.data);
  const profile = parsed.success&&Object.values(parsed.data).some(f=>f.value.trim()) ? parsed.data : saved.success?saved.data:emptyProfile();
  const searches=await db.searchCall.findMany({where:{sessionId:session.id}});
  const cost = (rows: typeof calls) => rows.reduce((sum, r) => sum + Number(r.costUsd ?? (["pending", "running"].includes(r.status) ? r.reservedUsd : 0)), 0);
  return { conversationImages:conversationImages(session.settings),session: { id: session.id, mode: session.mode, autoConfirm: session.autoConfirm, stopQuestions: session.stopQuestions, confirmedProfileId: session.confirmedProfileId, confirmedPack: session.confirmedPack, draftRevision: session.draftRevision, running: Boolean(session.runningAt && Date.now() - session.runningAt.getTime() < 5 * 60000) }, profile, understanding: understanding(profile), messages, cards, documents, tools, costs: { llmUsd: cost(calls), imagesUsd: cost(jobs), searchUsd:searches.reduce((n,s)=>n+Number(s.costUsd),0), estimated:searches.some(s=>s.costEstimated)|| [...calls, ...jobs].some(r => r.costEstimated || r.costUsd === null) } };
}
export type AgentSnapshot = Awaited<ReturnType<typeof agentSnapshot>>;
export async function recordBoardEvent(productId: string, userId: string, action: Record<string, unknown>) {
  const session = await agentSession(productId, userId);
  await db.chatMessage.create({ data: { productId, sessionId: session.id, role: "system", content: json({ text: `美工在看板完成操作：${JSON.stringify(action)}`, boardEvent: action }) } });
}

// 页面或服务重启后从已入队结果恢复确认回执，永远沿用原卡片幂等键。
async function recoverAgentCards(sessionId: string) {
  const cards = await db.agentCard.findMany({ where: { sessionId, kind: "cost", status: "executing" } });
  for (const card of cards) {
    const data = card.data as { startedAt?: string };
    if (!data.startedAt || Date.now() - new Date(data.startedAt).getTime() < 120000) continue;
    const [batch, job] = await Promise.all([db.generationBatch.findUnique({ where: { requestKey: card.id } }), db.generationJob.findFirst({ where: { sessionId, input: { path: ["agentCardId"], equals: card.id } } })]);
    const result = batch ? { batchId: batch.id } : job ? { jobId: job.id } : null;
    await db.$transaction(async tx => {
      const changed = await tx.agentCard.updateMany({ where: { id: card.id, status: "executing" }, data: { status: result ? "executed" : "pending", ...(result ? { result } : {}) } });
      if (changed.count && result) await tx.agentSession.update({ where: { id: sessionId }, data: { firstGenerationConfirmed: true } });
    });
  }
}
