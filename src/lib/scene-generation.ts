import "server-only";
import { fromPrisma } from "pg-boss";
import { db } from "@/lib/db";
import { getBoss, SUBMIT_QUEUE, workerIsReady, expireOverdueJobs, MAX_JOB_MS } from "@/lib/generation-queue";
import { IMAGE_DEFAULTS, sceneAspectRatios, sceneResolutions, type SceneAspectRatio, type SceneResolution } from "@/lib/models.config";
import { estimateImageUsd } from "./gateway-cost";
import { configuredCandidate, assertUsdQuota, monthlySpendUsd } from "./quota";
export { quotaMonth } from "./quota";
import { candidatesFor, gatewayConfigured } from "./gateway-router";
import { buildScenePrompt } from "@/prompts/scene";
import { buildEditPrompt } from "@/prompts/edit";
import { StudioError } from "@/lib/studio-error";
import type { Prisma } from "@/generated/prisma/client";
import type { ModelCandidate } from "./models.config";

// 单张与图包共用身份冻结、参考图和事务入队，批次负责一次性校验总配额。
export async function prepareSceneInput(tx: Prisma.TransactionClient, productId: string, intent: string, aspectRatio: SceneAspectRatio, candidate: ModelCandidate, resolution: SceneResolution = "2K") {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${productId}, 0))`;
  const product = await tx.product.findUnique({ where: { id: productId }, include: { assets: { where: { type: "photo", deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }], take: 3 } } });
  if (!product) throw new StudioError("商品不存在", 404);
  if (!product.identityTraits?.trim()) throw new StudioError("请先填写并保存产品身份特征");
  if (product.assets.length < 2) throw new StudioError("生成需要同一商品至少 2 张不同角度实拍图");
  const prompt = buildScenePrompt(product.identityTraits, intent);
  if (prompt.length > 20000) throw new StudioError("组合后的提示词不能超过 20000 字符");
  const version = await tx.productIdentityVersion.findFirst({ where: { productId }, orderBy: [{ savedAt: "desc" }, { id: "desc" }] });
  return { estimate: estimateImageUsd(candidate, resolution, prompt, product.assets), input: { prompt, sceneIntent: intent, identityTraits: product.identityTraits, identityVersionId: version?.id ?? null, identitySavedById: version?.savedById ?? null, identitySavedAt: version && !version.historical ? version.savedAt.toISOString() : null, referenceAssetIds: product.assets.map(a => a.id), image_input: [], aspect_ratio: aspectRatio, resolution, output_format: IMAGE_DEFAULTS.output_format, submissionAttempted: false } };
}
export async function enqueueImageJob(tx: Prisma.TransactionClient, data: Prisma.GenerationJobUncheckedCreateInput) {
  const boss = await getBoss();
  const createdAt = new Date();
  const job = await tx.generationJob.create({ data: { createdAt, deadlineAt: new Date(createdAt.getTime() + MAX_JOB_MS), ...data } });
  if (!await boss.send(SUBMIT_QUEUE, { jobId: job.id }, { db: fromPrisma(tx) })) throw new StudioError("任务未能入队，美元配额未预留，请稍后重试", 503);
  return job.id;
}

export async function generationAvailability(userId: string) {
  const [user, used, ready, candidate] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { monthlyQuota: true } }),
    monthlySpendUsd(db, userId),
    workerIsReady(),
    configuredCandidate("scene-main").catch(() => null),
  ]);
  return { quota: Number(user.monthlyQuota), used, remaining: Math.max(0, Number(user.monthlyQuota) - used), workerReady: ready, configured: candidatesFor("scene-main").some(c => gatewayConfigured(c.provider)), estimates: { "2K": candidate ? estimateImageUsd(candidate, "2K") : 0, "4K": candidate ? estimateImageUsd(candidate, "4K") : 0 }, estimateProvider: candidate?.provider ?? null };
}
export type GenerationAvailability = Awaited<ReturnType<typeof generationAvailability>>;

type EditSource = { sourceJobId: string; sourceAssetId: string };
export async function createSceneJob(userId: string, productId: string, sceneIntent: string, aspectRatio: SceneAspectRatio, resolution: SceneResolution = "2K") {
  return createImageJob(userId, productId, sceneIntent, aspectRatio, resolution);
}
export async function createEditJob(userId: string, productId: string, editIntent: string, aspectRatio: SceneAspectRatio, resolution: SceneResolution, source: EditSource) {
  return createImageJob(userId, productId, editIntent, aspectRatio, resolution, source);
}
async function createImageJob(userId: string, productId: string, intent: string, aspectRatio: SceneAspectRatio, resolution: SceneResolution, source?: EditSource) {
  if (!sceneAspectRatios.includes(aspectRatio) || !sceneResolutions.includes(resolution)) throw new StudioError("不支持该比例或分辨率");
  if (!candidatesFor("scene-main").some(c => gatewayConfigured(c.provider))) throw new StudioError("没有已配置的生图网关，请管理员填写 API Key 并重启网页与 worker", 503);
  if (!await workerIsReady()) throw new StudioError("生图 worker 未启动或已离线，请运行 npm run worker 后重试", 503);
  await expireOverdueJobs();
  const logicalModel = source ? "edit" : "scene-main";
  const candidate = await configuredCandidate(logicalModel);
  await getBoss();
  return db.$transaction(async (tx) => {
    // 与预留在同一事务锁定用户；两个并发请求不能使用同一份剩余额度。
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.role === "viewer") throw new StudioError("只读成员不能生成图片", 403);
    if (!source) {
      const prepared = await prepareSceneInput(tx, productId, intent, aspectRatio, candidate, resolution);
      await assertUsdQuota(tx, userId, prepared.estimate);
      return enqueueImageJob(tx, { productId, logicalModel, createdById: userId, reservedUsd: prepared.estimate, input: prepared.input });
    }
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${productId}, 0))`;
    const product = await tx.product.findUnique({ where: { id: productId }, include: { assets: { where: { type: "photo", deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }] } } });
    if (!product) throw new StudioError("商品不存在", 404);
    if (!product.identityTraits?.trim()) throw new StudioError("请先填写并保存产品身份特征");
    if (product.assets.length < 2 || product.assets.length > 3) throw new StudioError("生成需要同一商品 2～3 张不同角度实拍图");
    if (source) {
      const [originalJob, originalAsset] = await Promise.all([
        tx.generationJob.findUnique({ where: { id: source.sourceJobId } }),
        tx.asset.findUnique({ where: { id: source.sourceAssetId } }),
      ]);
      if (!originalJob || originalJob.productId !== productId || originalJob.status !== "success" || !Array.isArray(originalJob.resultAssetIds) || !originalJob.resultAssetIds.includes(source.sourceAssetId) || !originalAsset || originalAsset.productId !== productId || originalAsset.type !== "generated" || originalAsset.deletedAt) throw new StudioError("请选择当前商品已完成的生成图片进行编辑", 400);
    }
    const createdAt = new Date();
    const prompt = buildEditPrompt(product.identityTraits, intent);
    if (prompt.length > 20000) throw new StudioError("组合后的提示词不能超过 20000 字符");
    const estimate = estimateImageUsd(candidate, resolution, prompt, product.assets);
    await assertUsdQuota(tx, userId, estimate);
    const version = await tx.productIdentityVersion.findFirst({ where: { productId }, orderBy: { savedAt: "desc" } });
    return enqueueImageJob(tx, {
      productId, logicalModel, reservedUsd: estimate, createdById: userId, createdAt, deadlineAt: new Date(createdAt.getTime() + MAX_JOB_MS),
      input: { prompt, ...(source ? { ...source, editIntent: intent } : { sceneIntent: intent }), identityTraits: product.identityTraits, identityVersionId: version?.id ?? null, identitySavedById: version?.savedById ?? null, identitySavedAt: version && !version.historical ? version.savedAt.toISOString() : null, referenceAssetIds: [...(source ? [source.sourceAssetId] : []), ...product.assets.map((asset) => asset.id)], image_input: [], aspect_ratio: aspectRatio, resolution, output_format: IMAGE_DEFAULTS.output_format, submissionAttempted: false },
    });
  }, { timeout: 15000 });
}
