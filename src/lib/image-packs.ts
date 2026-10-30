import "server-only";
import {fitImageReferences,validateImageSelection} from "./image-model-input";
import {selectedCandidate,settingsOf} from "./studio-models";
import { createHash } from "node:crypto";
import { db } from "./db";
import type { Prisma } from "@/generated/prisma/client";
import { StudioError } from "./studio-error";
import { defaultSlots, slotSchema, eligibleSlots, batchProgress } from "./pack-rules";
import { configuredCandidate, monthlySpendUsd, assertUsdQuota } from "./quota";
import { prepareSceneInput, enqueueImageJob } from "./scene-generation";
import { workerIsReady, getBoss, expireOverdueJobs } from "./generation-queue";
import { roundUsd, estimateImageUsd } from "./gateway-cost";
import { KIE_USD_PER_CREDIT, type SceneAspectRatio } from "./models.config";
import { quotaShortage } from "./quota-math";

async function lockProduct(tx: Prisma.TransactionClient, productId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${productId}, 0))`;
  if (!await tx.product.findUnique({ where: { id: productId } })) throw new StudioError("商品不存在", 404);
}
async function currentPack(tx: Prisma.TransactionClient, productId: string) {
  await lockProduct(tx, productId);
  return await tx.imagePack.findFirst({ where: { productId, isCurrent: true } }) ?? tx.imagePack.create({ data: { productId } });
}
export async function mutatePack(productId: string, action: Record<string, unknown>) {
  return db.$transaction(async tx => {
    const pack = await currentPack(tx, productId);
    const slots = await tx.imageSlot.findMany({ where: { packId: pack.id, deletedAt: null }, orderBy: { order: "asc" } });
    const max = await tx.imageSlot.aggregate({ where: { packId: pack.id }, _max: { order: true } });
    let order = (max._max.order ?? 0) + 1;
    if (action.action === "defaults") {
      if (slots.length && action.confirmed !== true) throw new StudioError("图包已有图位，请确认套用；已有候选图和终稿会保留", 409);
      // 仅补充缺失的默认图位，不重置任何既有图位内容或结果。
      for (const s of defaultSlots) if (!slots.some(old => old.name === s.name && old.slotType === s.slotType)) await tx.imageSlot.create({ data: { ...s, packId: pack.id, order: order++, goal: "" } });
      return;
    }
    if (action.action === "add") {
      const parsed = slotSchema.safeParse(action.slot);
      if (!parsed.success) throw new StudioError("图位参数无效，请检查名称、比例和候选数量");
      if (slots.length >= 30) throw new StudioError("当前图包最多 30 个图位");
      await tx.imageSlot.create({ data: { ...parsed.data, packId: pack.id, order } }); return;
    }
    const slot = slots.find(s => s.id === action.slotId);
    if (!slot) throw new StudioError("图位不存在或已删除", 404);
    if (action.action === "save") {
      if(slot.visualPlan)throw new StudioError("该图位已冻结视觉方案，请在 Agent 方案卡中修改并重新确认",409);
      const parsed = slotSchema.safeParse(action.slot);
      if (!parsed.success) throw new StudioError("图位参数无效，请检查名称、比例和候选数量");
      await tx.imageSlot.update({ where: { id: slot.id }, data: parsed.data });
    } else if (action.action === "delete") {
      if (slot.finalAssetId && action.confirmed !== true) throw new StudioError("该图位已有终稿，请再次确认删除图位", 409);
      await tx.imageSlot.update({ where: { id: slot.id }, data: { deletedAt: new Date() } });
    } else if (action.action === "move") {
      const target = slots[slots.findIndex(s => s.id === slot.id) + (action.direction === "up" ? -1 : 1)];
      if (!target) return;
      await tx.imageSlot.update({ where: { id: slot.id }, data: { order } });
      await tx.imageSlot.update({ where: { id: target.id }, data: { order: slot.order } });
      await tx.imageSlot.update({ where: { id: slot.id }, data: { order: target.order } });
    } else if (action.action === "final" || action.action === "hide") {
      if (action.action === "final" && action.assetId === null) { await tx.imageSlot.update({ where: { id: slot.id }, data: { finalAssetId: null } }); return; }
      const assetId = String(action.assetId ?? "");
      const asset = await tx.asset.findFirst({ where: { id: assetId, productId, type: "generated", deletedAt: null } });
      const jobs = await tx.generationJob.findMany({ where: { slotId: slot.id, status: "success" }, select: { resultAssetIds: true } });
      if (!asset || !jobs.some(j => Array.isArray(j.resultAssetIds) && j.resultAssetIds.includes(assetId))) throw new StudioError("只能选择该图位已生成的候选图");
      if (action.action === "final") await tx.imageSlot.update({ where: { id: slot.id }, data: { finalAssetId: assetId } });
      else {
        if (await tx.imageSlot.count({ where: { finalAssetId: assetId } })) throw new StudioError("终稿不能直接删除，请先取消终稿", 409);
        await tx.asset.update({ where: { id: assetId }, data: { deletedAt: new Date() } });
      }
    } else throw new StudioError("不支持的图包操作");
  });
}

export type BatchSelection = { slotId?: string; retryJobId?: string; count?: number };
async function planBatch(tx: Prisma.TransactionClient, productId: string, selection: BatchSelection, userId:string) {
  await lockProduct(tx, productId);
  const session=await tx.agentSession.findUnique({where:{productId_createdById:{productId,createdById:userId}}});
  const settings=settingsOf(session?.settings);
  const candidate=settings.imageId?await selectedCandidate("image",settings):await configuredCandidate("scene-main");
  const resolution=settings.resolution==="4K"?"4K":settings.resolution==="1K"?"1K":"2K";
  const pack = await tx.imagePack.findFirst({ where: { productId, isCurrent: true }, include: { slots: { where: { deletedAt: null }, orderBy: { order: "asc" } } } });
  if (!pack) throw new StudioError("请先套用默认图包或新增图位");
  if (selection.retryJobId) {
    const old = await tx.generationJob.findUnique({ where: { id: selection.retryJobId }, include: { retriedBy: true } });
    if (!old || old.productId !== productId || !old.batchId || !old.slotId || !pack.slots.some(s => s.id === old.slotId) || old.status !== "failed" || old.retriedBy) throw new StudioError("只能重试当前图包尚未重试的失败候选图", 409);
    const raw = old.input as Record<string, Prisma.InputJsonValue>;
    const assets = await tx.asset.findMany({ where: { id: { in: raw.referenceAssetIds as string[] },productId,deletedAt:null } });
    const refs=fitImageReferences(candidate,(raw.referenceAssetIds as string[]).flatMap(id=>assets.filter(a=>a.id===id)));
    validateImageSelection(candidate,String(raw.resolution??"2K"),String(raw.aspect_ratio),String(raw.prompt),refs.length);
    const input = { ...raw, referenceAssetIds:refs.map(a=>a.id), selectedCandidate:JSON.parse(JSON.stringify(candidate)), autoRetryCount:0, submissionAttempted: false, uncertainCharge: false, referenceRetryCount: 0, image_input: [] };
    return { pack, candidate, skipped: [] as string[], entries: [{ slotId: old.slotId, count: 1, prepared: { input, estimate: estimateImageUsd(candidate,(raw.resolution??"2K") as "1K"|"2K"|"4K", String(raw.prompt), refs) } }], old };
  }
  const activeSlots=pack.confirmedPlanId?pack.slots.filter(s=>(s.visualPlan as {confirmationCardId?:string}|null)?.confirmationCardId===pack.confirmedPlanId):pack.slots;
  const selected = selection.slotId ? activeSlots.filter(s => s.id === selection.slotId) : activeSlots;
  if (selection.slotId && !selected.length) throw new StudioError("图位不存在", 404);
  const skipped = selected.filter(s => s.method === "ai_scene" && !s.goal.trim()).map(s => s.name);
  const entries = [];
  for (const s of eligibleSlots(selected)) entries.push({ slotId: s.id, count: selection.count ?? s.candidateCount, prepared: await prepareSceneInput(tx, productId, s.goal, s.aspectRatio as SceneAspectRatio, candidate,resolution,s.visualPlan) });
  if (!entries.length) throw new StudioError(`没有可生成的图位${skipped.length ? `，以下图位 goal 为空，已跳过：${skipped.join("、")}` : "；人工上传图位本阶段暂不自动生成"}`);
  return { pack, candidate, skipped, entries, old: null };
}
function summarizePlan(plan: Awaited<ReturnType<typeof planBatch>>) {
  const totalCount = plan.entries.reduce((n, e) => n + e.count, 0), estimatedCostUsd = roundUsd(plan.entries.reduce((n, e) => n + e.count * e.prepared.estimate, 0));
  return { slotCount: plan.entries.length, totalCount, estimatedCostUsd, estimatedCredits: roundUsd(estimatedCostUsd / KIE_USD_PER_CREDIT), creditEquivalent: plan.candidate.provider !== "kie", provider: plan.candidate.provider, skipped: plan.skipped, fingerprint: createHash("sha256").update(JSON.stringify({ entries: plan.entries, candidate: plan.candidate, retry: plan.old?.id })).digest("hex") };
}
export async function quoteBatch(userId: string, productId: string, selection: BatchSelection) {
  return db.$transaction(async tx => {
    const plan = await planBatch(tx, productId, selection, userId), quote = summarizePlan(plan);
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } }), used = await monthlySpendUsd(tx, userId);
    return { ...quote, remaining: Math.max(0, Number(user.monthlyQuota) - used), shortage: quotaShortage(Number(user.monthlyQuota), used, quote.estimatedCostUsd) };
  }, { timeout: 20000 });
}
export async function submitBatch(userId: string, productId: string, selection: BatchSelection, fingerprint: string, requestKey: string, sessionId?: string) {
  if (!await workerIsReady()) throw new StudioError("生图 worker 未启动或已离线，请启动后重试", 503);
  await getBoss();
  await expireOverdueJobs();
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
    const existing = await tx.generationBatch.findUnique({ where: { requestKey } });
    if (existing) { if (existing.createdById !== userId || (await tx.imagePack.findUniqueOrThrow({ where: { id: existing.packId } })).productId !== productId) throw new StudioError("提交编号冲突", 409); return existing.id; }
    const retried = await tx.generationJob.findFirst({ where: { productId, createdById: userId, input: { path: ["batchRequestKey"], equals: requestKey } } });
    if (retried?.batchId) return retried.batchId;
    const plan = await planBatch(tx, productId, selection, userId), quote = summarizePlan(plan);
    if (fingerprint !== quote.fingerprint) throw new StudioError("图位、身份特征或价格已变化，请重试生成", 409);
    await assertUsdQuota(tx, userId, quote.estimatedCostUsd);
    const batch = plan.old ? await tx.generationBatch.findUniqueOrThrow({ where: { id: plan.old.batchId! } }) : await tx.generationBatch.create({ data: { packId: plan.pack.id, createdById: userId, slotCount: quote.slotCount, totalCount: quote.totalCount, estimatedCostUsd: quote.estimatedCostUsd, requestKey } });
    for (const entry of plan.entries) for (let n = 0; n < entry.count; n++) await enqueueImageJob(tx, { productId, sessionId, slotId: entry.slotId, batchId: batch.id, retryOfId: plan.old?.id, logicalModel: "scene-main", createdById: userId, input: { ...entry.prepared.input, selectedCandidate:JSON.parse(JSON.stringify(plan.candidate)), batchRequestKey: requestKey }, reservedUsd: entry.prepared.estimate });
    return batch.id;
  }, { timeout: 30000 });
}

// 费用只展示：报价后直接交给原有提交事务，额度预留、指纹和队列逻辑不变。
const immediateBatchDependencies={
 quote:quoteBatch,submit:submitBatch,
 replay:async(userId:string,productId:string,requestKey:string)=>{
  const jobs=await db.generationJob.findMany({where:{productId,createdById:userId,input:{path:["batchRequestKey"],equals:requestKey}},select:{batchId:true,reservedUsd:true}});
  return jobs[0]?.batchId?{batchId:jobs[0].batchId,estimatedCostUsd:roundUsd(jobs.reduce((sum,j)=>sum+Number(j.reservedUsd),0))}:null;
 }
};
export async function submitImmediateBatch(userId:string,productId:string,selection:BatchSelection,requestKey:string,sessionId?:string,deps=immediateBatchDependencies){
 const previous=await deps.replay(userId,productId,requestKey);if(previous)return {...previous,submitted:true as const};
 let quote=await deps.quote(userId,productId,selection),batchId:string;
 try{batchId=await deps.submit(userId,productId,selection,quote.fingerprint,requestKey,sessionId);}
 catch(error){
  // 指纹变化发生在扣款/入队前；刷新一次报价仍使用同一请求号，不增加人工费用确认。
  if(!(error instanceof StudioError)||error.status!==409||!error.message.startsWith("图位、身份特征或价格已变化"))throw error;
  quote=await deps.quote(userId,productId,selection);batchId=await deps.submit(userId,productId,selection,quote.fingerprint,requestKey,sessionId);
 }
 return {batchId,estimatedCostUsd:quote.estimatedCostUsd,submitted:true as const};
}

export async function packSnapshot(productId: string) {
  await expireOverdueJobs();
  const product = await db.product.findUnique({ where: { id: productId }, include: { assets: { where: { type: "photo", deletedAt: null }, select: { id: true } }, identityVersions: { orderBy: [{ savedAt: "desc" }, { id: "desc" }], take: 1 } } });
  if (!product) throw new StudioError("商品不存在", 404);
  const pack = await db.imagePack.findFirst({ where: { productId, isCurrent: true }, include: { slots: { where: { deletedAt: null }, orderBy: { order: "asc" }, include: { jobs: { orderBy: { createdAt: "desc" }, include: { retriedBy: { select: { id: true } } } } } }, batches: { orderBy: { createdAt: "desc" }, include: { jobs: { select: { status: true, retriedBy: { select: { id: true } }, costUsd: true, costEstimated: true, completedAt: true } } } } } });
  const assets = await db.asset.findMany({ where: { productId, type: "generated", deletedAt: null }, select: { id: true, width: true, height: true } });
  return { productId, sku: product.sku, name: product.name, photoCount: product.assets.length, identityVersionId: product.identityVersions[0]?.id ?? null, packId: pack?.id ?? null,
    slots: (pack?.slots ?? []).map(s => ({ id: s.id, name: s.name, order: s.order, slotType: s.slotType, goal: s.goal, method: s.method, candidateCount: s.candidateCount, aspectRatio: s.aspectRatio, finalAssetId: s.finalAssetId, jobs: s.jobs.map(j => ({ id: j.id, batchId: j.batchId, retriedById: j.retriedBy?.id ?? null, status: j.status, provider: j.provider, model: j.model, fallback: j.fallback, error: j.error, input: j.input as Record<string, unknown>, costUsd: j.costUsd === null ? null : Number(j.costUsd), reservedUsd: Number(j.reservedUsd), costEstimated: j.costEstimated, credits: j.credits === null ? null : Number(j.credits), createdAt: j.createdAt.toISOString(), durationMs: j.completedAt ? j.completedAt.getTime() - j.createdAt.getTime() : null, assets: assets.filter(a => Array.isArray(j.resultAssetIds) && j.resultAssetIds.includes(a.id)) })) })),
    batches: (pack?.batches ?? []).map(b => ({ id: b.id, createdAt: b.createdAt.toISOString(), ...batchProgress(b.jobs), costUsd: roundUsd(b.jobs.reduce((sum, j) => sum + Number(j.costUsd ?? 0), 0)), costEstimated: b.jobs.some(j => j.costEstimated || j.costUsd === null) })) };
}
export type PackSnapshot = Awaited<ReturnType<typeof packSnapshot>>;
export type BatchQuote = Awaited<ReturnType<typeof quoteBatch>>;
