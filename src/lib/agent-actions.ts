import "server-only";
import {FEATURE_CASE_EXTRACTION} from "./project-features";
import { createHash } from "node:crypto";
import { db } from "./db";
import { quoteBatch, submitBatch, mutatePack } from "./image-packs";
import { configuredCandidate, monthlySpendUsd, assertUsdQuota } from "./quota";
import { prepareEditInput, enqueueImageJob } from "./scene-generation";
import { getBoss, workerIsReady } from "./generation-queue";
import { StudioError } from "./studio-error";
import { json } from "./agent-state";
import { autoApproval, profileSchema, understanding,emptyProfile } from "./profile-rules";
import {confirmVisualPlan,planToProposal} from "./visual-planning";
import {visualPlanSchema,patternSchema,composeIdentityLock,visualPlanDiff} from "./visual-plan-rules";
import {writeProductReviewSafely} from "./visual-review";
import { confirmProfile } from "./product-profile";
import { proposalSchema, agentToolSchemas } from "./agent-tool-schemas";
import { slotSchema } from "./pack-rules";
import type { Prisma } from "@/generated/prisma/client";
export type PaidAction = { operation: "generate_slot"; slotId: string; count: number } | { operation: "generate_batch" } | { operation: "edit_image"; assetId: string; instruction: string };
async function validGeneration(sessionId: string, action: PaidAction) {
  const session = await db.agentSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (!session.confirmedProfileId || !session.confirmedPack) throw new StudioError("请先在卡片上确认产品档案和图包方案", 409);
  if (session.mode === "manual" && action.operation === "generate_batch") throw new StudioError("手动模式每次只推进一个图位，请切换快速模式或选择当前图位", 409);
  if (action.operation === "generate_slot") {
    const slots = await db.imageSlot.findMany({ where: { pack: { productId: session.productId, isCurrent: true }, deletedAt: null, method: "ai_scene" }, orderBy: { order: "asc" } });
    if (!slots.some(s => s.id === action.slotId)) throw new StudioError("图位不属于当前 SKU", 404);
    if (session.mode === "manual" && slots.find(s => !s.finalAssetId)?.id !== action.slotId) throw new StudioError("请先挑好当前图位的终稿，再推进下一个图位", 409);
  }
  return session;
}
async function prepareEdit(tx: Prisma.TransactionClient, productId: string, action: Extract<PaidAction, { operation: "edit_image" }>) {
  const job = await tx.generationJob.findFirst({ where: { productId, status: "success", resultAssetIds: { array_contains: [action.assetId] } }, include: { slot: true } });
  if (!job?.slot || job.slot.deletedAt || !await tx.imagePack.findFirst({ where: { id: job.slot.packId, isCurrent: true, productId } })) throw new StudioError("请选择当前图包的有效候选图", 404);
  const candidate = await configuredCandidate("edit"), prepared = await prepareEditInput(tx, productId, action.instruction, job.slot.aspectRatio as "1:1", "2K", { sourceJobId: job.id, sourceAssetId: action.assetId }, candidate);
  return { ...prepared, slotId: job.slot.id, fingerprint: createHash("sha256").update(JSON.stringify({ ...prepared, candidate, slotId: job.slot.id })).digest("hex") };
}
export async function quoteAgentAction(sessionId: string, action: PaidAction) {
  const session = await validGeneration(sessionId, action), profile = profileSchema.parse(session.profileDraft), risk = understanding(profile);
  if (action.operation !== "edit_image") {
    const selection = action.operation === "generate_slot" ? { slotId: action.slotId, count: action.count } : {};
    const quote = await quoteBatch(session.createdById, session.productId, selection);
    const slots = await db.imageSlot.findMany({ where: { pack: { productId: session.productId, isCurrent: true }, deletedAt: null, method: "ai_scene", ...(action.operation === "generate_slot" ? { id: action.slotId } : {}) }, orderBy: { order: "asc" } });
    return { ...quote, risk, content: slots.filter(slot => slot.goal.trim()).map(slot => `${slot.name}：${slot.goal}`).join("\n") };
  }
  return db.$transaction(async tx => { const prepared = await prepareEdit(tx, session.productId, action); const user = await tx.user.findUniqueOrThrow({ where: { id: session.createdById } }), used = await monthlySpendUsd(tx, user.id); return { fingerprint: prepared.fingerprint, estimatedCostUsd: prepared.estimate, remaining: Math.max(0, Number(user.monthlyQuota) - used), shortage: Math.max(0, prepared.estimate + used - Number(user.monthlyQuota)), totalCount: 1, slotCount: 1, skipped: [], risk, content: action.instruction }; });
}
export async function createCostCard(sessionId: string, action: PaidAction) {
  const session = await validGeneration(sessionId, action), quote = await quoteAgentAction(sessionId, action);
  const data = { action, quote };
  const old = await db.agentCard.findFirst({ where: { sessionId, kind: "cost", status: "pending", data: { path: ["action"], equals: json(action) } } });
  const card = old ? await db.agentCard.update({ where: { id: old.id }, data: { data: json(data) } }) : await db.agentCard.create({ data: { sessionId, kind: "cost", data: json(data) } });
  const priorBatch = await db.agentCard.findFirst({ where: { sessionId, kind: "cost", status: "executed", data: { path: ["action", "operation"], equals: "generate_batch" } } });
  const automatic = autoApproval({ enabled: session.autoConfirm, firstConfirmed: session.firstGenerationConfirmed && (action.operation !== "generate_batch" || Boolean(priorBatch)), costUsd: quote.estimatedCostUsd, risk: !quote.risk.ready || (session.mode === "manual" && action.operation === "generate_slot") });
  if (automatic && quote.shortage <= 0) { const result = await approveAgentCard(sessionId, card.id, { acceptRisk: false }, true); return { cardId: card.id, automatic: true, result }; }
  return { cardId: card.id, waitForUser: true, quote };
}
async function applyProposal(tx: Prisma.TransactionClient, productId: string, raw: unknown,cardId:string) {
  const proposal = proposalSchema.parse(raw);
  const visualPlan=proposal.visualPlan?await confirmVisualPlan(tx,productId,proposal.visualPlan):null;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${productId}, 0))`;
  const pack = await tx.imagePack.findFirst({ where: { productId, isCurrent: true } }) ?? await tx.imagePack.create({ data: { productId } });
  const old = await tx.imageSlot.findMany({ where: { packId: pack.id }, orderBy: { order: "asc" } }); let order = Math.max(0, ...old.map(s => s.order)) + 1;
  const seen = new Set<string>();
  for (const [index,slot] of proposal.slots.entries()) {
    const match = slot.id ? old.find(s => s.id === slot.id && !s.deletedAt) : old.find(s => !s.deletedAt && s.name === slot.name && s.slotType === slot.slotType);
    if (slot.id && !match) throw new StudioError("方案图位不属于当前图包，请刷新方案", 409);
    const data = {...slotSchema.parse(slot),...(visualPlan?{visualPlan:json({plan:visualPlan,slot:visualPlan.slots[index],confirmationCardId:cardId})}:{})};
    if (match) { if (seen.has(match.id)) throw new StudioError("方案重复引用同一图位"); seen.add(match.id); await tx.imageSlot.update({ where: { id: match.id }, data }); }
    else await tx.imageSlot.create({ data: { ...data, packId: pack.id, order: order++ } });
  }
  // 不删除、归档或覆盖终稿字段；未列出的既有图位继续保留。
  await tx.imagePack.update({ where: { id: pack.id }, data: { status: "confirmed", version: { increment: 1 },...(visualPlan?{confirmedPlanId:cardId}:{}) } });
  return { packId: pack.id };
}
export async function approveAgentCard(sessionId: string, cardId: string, changes: Record<string, unknown>, automatic = false) {
  const session = await db.agentSession.findUniqueOrThrow({ where: { id: sessionId } });
  const card = await db.agentCard.findFirst({ where: { id: cardId, sessionId } });
  if (!card) throw new StudioError("确认卡不存在", 404);
  if (card.status === "executed") return card.result;
  if (card.status !== "pending") throw new StudioError("确认卡已取消或正在执行，请刷新核对", 409);
  const raw = card.data as Record<string, unknown>;
  if (card.kind === "cost") {
    const action = raw.action as PaidAction;
    const quote = await quoteAgentAction(sessionId, action), old = raw.quote as typeof quote;
    if (quote.fingerprint !== old.fingerprint) { await db.agentCard.update({ where: { id: card.id }, data: { data: json({ action, quote }) } }); throw new StudioError("图位、身份或价格变化，费用卡已更新，请重新确认", 409); }
    if (!quote.risk.ready && changes.acceptRisk !== true) throw new StudioError("产品仍有缺失或冲突，请勾选已了解风险后再生成", 409);
    if (automatic && !autoApproval({ enabled: session.autoConfirm, firstConfirmed: session.firstGenerationConfirmed, costUsd: quote.estimatedCostUsd, risk: !quote.risk.ready || (session.mode === "manual" && action.operation === "generate_slot") })) throw new StudioError("当前操作必须人工确认", 409);
    const claimed = await db.agentCard.updateMany({ where: { id: cardId, status: "pending" }, data: { status: "executing", data: json({ ...raw, startedAt: new Date().toISOString() }) } });
    if (!claimed.count) throw new StudioError("确认卡正在执行，请勿重复提交", 409);
    try {
      let result;
      if (action.operation !== "edit_image") result = { batchId: await submitBatch(session.createdById, session.productId, action.operation === "generate_slot" ? { slotId: action.slotId, count: action.count } : {}, quote.fingerprint, card.id, session.id) };
      else {
        if (!await workerIsReady()) throw new StudioError("生图 worker 未就绪", 503); await getBoss();
        result = await db.$transaction(async tx => { await tx.$queryRaw`SELECT id FROM "User" WHERE id=${session.createdById} FOR UPDATE`; const existing = await tx.generationJob.findFirst({ where: { sessionId, input: { path: ["agentCardId"], equals: card.id } } }); if (existing) return { jobId: existing.id }; const prepared = await prepareEdit(tx, session.productId, action); if (prepared.fingerprint !== quote.fingerprint) throw new StudioError("编辑输入已变化，请重新确认", 409); await assertUsdQuota(tx, session.createdById, prepared.estimate); return { jobId: await enqueueImageJob(tx, { productId: session.productId, sessionId, slotId: prepared.slotId, logicalModel: "edit", createdById: session.createdById, reservedUsd: prepared.estimate, input: json({ ...prepared.input, agentCardId: card.id }) }) }; }, { timeout: 30000 });
      }
      await db.$transaction(async tx => { await tx.agentCard.update({ where: { id: cardId }, data: { status: "executed", result: json(result) } }); await tx.agentSession.update({ where: { id: sessionId }, data: { firstGenerationConfirmed: true } }); });
      await db.chatMessage.create({ data: { productId: session.productId, sessionId, role: "system", content: json({ text: `${automatic ? "自动确认" : "美工已确认"}费用卡并入队：${JSON.stringify(result)}` }) } });
      return result;
    } catch (error) { await db.agentCard.update({ where: { id: cardId }, data: { status: "pending" } }); throw error; }
  }
  if (automatic) throw new StudioError("该卡片必须人工确认", 403);
  const confirmedResult=await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "AgentSession" WHERE id=${sessionId} FOR UPDATE`;
    const current = await tx.agentCard.findUniqueOrThrow({ where: { id: cardId } }); if (current.status === "executed") return current.result;
    if (current.status !== "pending") throw new StudioError("确认卡已取消", 409);
    let result: unknown;
    if (card.kind === "profile") {
      const fresh = await tx.agentSession.findUniqueOrThrow({ where: { id: sessionId } });
      if (raw.revision !== fresh.draftRevision) throw new StudioError("档案草稿已变化，请重新请求理解确认卡", 409);
      const submitted = json(changes.profile ?? raw.profile) as unknown as Record<string, { value: string; status: string; sources: unknown[] }>;
      for (const field of Object.values(submitted)) if (field && typeof field === "object" && field.status !== "missing" && Array.isArray(field.sources)) field.sources.push({ kind: "product", id: session.productId, quote: `美工在理解确认卡 ${cardId} 确认：${field.value}`.slice(0,2000) });
      const profile = profileSchema.parse(submitted), saved = await confirmProfile(tx, session.productId, session.createdById, profile);
      await tx.agentSession.update({ where: { id: sessionId }, data: { profileDraft: profile, confirmedProfileId: saved.id, confirmedPack: false } });
      await tx.agentCard.updateMany({ where: { sessionId, kind: { in: ["pack", "cost"] }, status: "pending" }, data: { status: "cancelled" } }); result = { profileId: saved.id, version: saved.version, identityVersionId: saved.identityVersionId };
    } else if (card.kind === "pack") {
      let proposal:unknown=changes.proposal??raw;
      if(raw.visualPlan){
        const saved=visualPlanSchema.parse(raw.visualPlan);
        const edited=changes.visualPlan?visualPlanSchema.parse(changes.visualPlan):saved;
        if(edited.slots.length!==saved.slots.length||edited.slots.some(s=>!saved.slots.some(p=>p.key===s.key)))throw new StudioError("图位列表已变化，请重新规划或刷新",409);
        // 美工只能改画面选择，不能通过确认请求替换身份、来源或产品归属。
        const plan=await confirmVisualPlan(tx,session.productId,{...saved,slots:edited.slots.map(s=>({...s,directions:saved.slots.find(p=>p.key===s.key)?.directions}))});
        const original=visualPlanSchema.parse(raw.originalVisualPlan??saved);
        await tx.agentCard.update({where:{id:cardId},data:{data:json({...raw,originalVisualPlan:original,confirmedVisualPlan:plan,planDiff:visualPlanDiff(original,plan),confirmedAt:new Date().toISOString(),confirmedById:session.createdById})}});
        proposal=planToProposal(plan);
        if(!session.confirmedProfileId){
          const profile=emptyProfile(),identity=plan.identityLock;
          for(const [key,value] of Object.entries({structureAndParts:composeIdentityLock(identity),colorsAndTextures:identity.colors+"；"+identity.materials,sellingPoints:identity.sellingPoints.map(s=>s.name).join("；")}))profile[key as keyof typeof profile]={value,status:"confirmed",sources:[{kind:"image",id:identity.referenceAssetIds[0],quote:"美工在视觉方案卡确认本次分析"}],conflicts:[]};
          const confirmed=await confirmProfile(tx,session.productId,session.createdById,profile);
          await tx.agentSession.update({where:{id:sessionId},data:{profileDraft:profile,confirmedProfileId:confirmed.id}});
        }
      }
      result = await applyProposal(tx, session.productId,proposal,card.id); await tx.agentSession.update({ where: { id: sessionId }, data: { confirmedPack: true } });
    }
    else if (card.kind === "questions") {
      const questions = (raw.questions ?? []) as { question: string; options: string[]; allowFreeText: boolean }[];
      const answers = zAnswers(changes.answers, questions);
      await tx.chatMessage.create({ data: { productId: session.productId, sessionId, role: "user", content: json({ text: questions.map((q, i) => `${q.question}：${answers[i]}`).join("\n") }) } }); result = { answered: true };
    } else if (card.kind === "final") {
      const selection = agentToolSchemas.set_final.parse(raw);
      const asset = await tx.asset.findFirst({ where: { id: selection.assetId, productId: session.productId, deletedAt: null } }), job = await tx.generationJob.findFirst({ where: { productId: session.productId, slotId: selection.slotId, status: "success", resultAssetIds: { array_contains: [selection.assetId] } } });
      const slot = await tx.imageSlot.findFirst({ where: { id: selection.slotId, deletedAt: null, pack: { productId: session.productId, isCurrent: true } } });
      if (!asset || !job || !slot) throw new StudioError("候选图或图位已失效，请重新选择", 409);
      await tx.imageSlot.update({ where: { id: selection.slotId }, data: { finalAssetId: selection.assetId } }); result = { finalAssetId: selection.assetId };
    } else if(card.kind==="library_case"){
      if(!FEATURE_CASE_EXTRACTION)throw new StudioError("案例提炼审核已暂停",403);
      const entries=(raw.entries as unknown[]).map(e=>patternSchema.parse(e));
      for(const entry of entries.filter(e=>e.type==="case")){
        const assetId=String(entry.content.originalImageRef??"");
        if(!await tx.asset.findFirst({where:{id:assetId,productId:session.productId,type:"generated",deletedAt:null}})||!await tx.imageSlot.findFirst({where:{finalAssetId:assetId,deletedAt:null,pack:{productId:session.productId,isCurrent:true}}}))throw new StudioError("原案例已不再是有效终稿，请重新选择后提炼",409);
      }
      for(const e of entries)await tx.studioLibraryEntry.create({data:{id:e.id,kind:e.type,name:e.name,data:json(e)}});
      result={entryIds:entries.map(e=>e.id)};
    } else throw new StudioError("未知确认卡");
    await tx.agentCard.update({ where: { id: cardId }, data: { status: "executed", result: json(result) } });
    await tx.chatMessage.create({ data: { productId: session.productId, sessionId, role: "system", content: json({ text: `美工确认 ${card.kind}：${JSON.stringify(result)}` }) } }); return json(result);
  }, { timeout: 20000 });
  if(card.kind==="pack")await writeProductReviewSafely(session.productId);
  return confirmedResult;
}
function zAnswers(raw: unknown, questions: { options: string[]; allowFreeText: boolean }[]) {
  if (!Array.isArray(raw) || raw.length !== questions.length || raw.some((a, i) => typeof a !== "string" || !a.trim() || a.length > 2000 || (!questions[i].allowFreeText && !questions[i].options.includes(a)))) throw new StudioError("请回答全部问题，或点击停止提问继续策划");
  return raw as string[];
}
export async function boardFinal(productId: string, slotId: string, assetId: string) { return mutatePack(productId, { action: "final", slotId, assetId }); }
