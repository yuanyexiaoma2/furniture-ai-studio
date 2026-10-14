import "server-only";
import { db } from "./db";
import { emptyProfile, profileSchema, understanding } from "./profile-rules";
import type { Prisma } from "@/generated/prisma/client";
import { StudioError } from "./studio-error";
export function json(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)); }
export async function agentSession(productId: string, userId: string) {
  if (!await db.product.findUnique({ where: { id: productId } })) throw new StudioError("商品不存在", 404);
  return db.agentSession.upsert({ where: { productId_createdById: { productId, createdById: userId } }, create: { productId, createdById: userId, profileDraft: emptyProfile() }, update: {} });
}
export async function agentSnapshot(productId: string, userId: string) {
  const session = await agentSession(productId, userId);
  const [messages, cards, documents, calls, jobs, tools] = await Promise.all([
    db.chatMessage.findMany({ where: { sessionId: session.id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    db.agentCard.findMany({ where: { sessionId: session.id }, orderBy: { createdAt: "asc" } }),
    db.productDocument.findMany({ where: { productId }, orderBy: { createdAt: "asc" }, select: { id: true, filename: true, type: true, parseStatus: true, imageType: true, assetId: true, error: true } }),
    db.llmCall.findMany({ where: { sessionId: session.id }, select: { costUsd: true, reservedUsd: true, costEstimated: true, status: true } }),
    db.generationJob.findMany({ where: { sessionId: session.id }, select: { costUsd: true, reservedUsd: true, costEstimated: true, status: true } }),
    db.agentToolCall.findMany({ where: { sessionId: session.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const parsed = profileSchema.safeParse(session.profileDraft), profile = parsed.success ? parsed.data : emptyProfile();
  const cost = (rows: typeof calls) => rows.reduce((sum, r) => sum + Number(r.costUsd ?? (["pending", "running"].includes(r.status) ? r.reservedUsd : 0)), 0);
  return { session: { id: session.id, mode: session.mode, autoConfirm: session.autoConfirm, stopQuestions: session.stopQuestions, confirmedProfileId: session.confirmedProfileId, confirmedPack: session.confirmedPack, draftRevision: session.draftRevision, running: Boolean(session.runningAt && Date.now() - session.runningAt.getTime() < 5 * 60000) }, profile, understanding: understanding(profile), messages, cards, documents, tools, costs: { llmUsd: cost(calls), imagesUsd: cost(jobs), estimated: [...calls, ...jobs].some(r => r.costEstimated || r.costUsd === null) } };
}
export type AgentSnapshot = Awaited<ReturnType<typeof agentSnapshot>>;
export async function recordBoardEvent(productId: string, userId: string, action: Record<string, unknown>) {
  const session = await agentSession(productId, userId);
  await db.chatMessage.create({ data: { productId, sessionId: session.id, role: "system", content: json({ text: `美工在看板完成操作：${JSON.stringify(action)}`, boardEvent: action }) } });
}
