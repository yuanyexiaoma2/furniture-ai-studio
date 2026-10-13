import "server-only";
import { db } from "./db";
import { routeCall, candidatesFor, gatewayConfigured } from "./gateway-router";
import { databaseCircuit } from "./gateway-circuit";
import { imageProvider } from "./gateway-providers";
import { GatewayError, ImageTaskFailure, gatewayException } from "./gateway-error";
import { saveGenerationResult } from "./save-generation-result";
import type { ImageGeneration, ImageRequest, ImageProvider } from "./image-provider";
import type { LogicalModel, ModelCandidate } from "./models.config";
import type { Prisma } from "@/generated/prisma/client";
import { estimateImageUsd, costFields, roundUsd } from "./gateway-cost";
import { assertUsdQuota } from "./quota";
import { ReferenceImageFailure, KieError } from "./kie-http";

export async function submitGatewayJob(id: string, factory = imageProvider) {
  const claimed = await db.generationJob.updateMany({ where: { id, status: "pending" }, data: { status: "running", startedAt: new Date(), workerInstanceId: process.env.GENERATION_WORKER_INSTANCE_ID ?? "manual-test" } });
  if (!claimed.count) return;
  await generate(id, factory);
}
async function generate(id: string, factory: (candidate: ModelCandidate) => ImageProvider, alreadyFallback = false) {
  const job = await db.generationJob.findUniqueOrThrow({ where: { id }, include: { attempts: true } });
  if (job.status !== "running") return;
  const input = job.input as Record<string, unknown>;
  const request: ImageRequest = { prompt: String(input.prompt), referenceImages: (input.referenceAssetIds as string[]).map(id => ({ id })), aspectRatio: String(input.aspect_ratio), resolution: input.resolution as ImageRequest["resolution"], outputFormat: input.output_format as ImageRequest["outputFormat"] };
  const photos = await db.asset.findMany({ where: { id: { in: request.referenceImages.map(p => p.id) } }, select: { width: true, height: true } });
  let activeAttempt: string | undefined;
  try {
    const routed = await routeCall<ImageGeneration>({ logical: job.logicalModel as LogicalModel, circuit: databaseCircuit, alreadyFallback, probe: typeof input.testProvider === "string", isSuccessful: result => result.kind === "done",
      previousErrors: job.attempts.filter(a => a.status === "failed" && a.error).map(a => a.error!), previousProvider: job.provider === "zenmux" ? "zenmux" : "kie",
      candidates: typeof input.testProvider === "string" ? candidatesFor("scene-main").filter(c => c.provider === input.testProvider) : undefined,
      excluded: job.attempts.map(a => `${a.provider}:${a.model}`), configured: gatewayConfigured,
      async call(candidate) {
        try { return await factory(candidate).generate(request); }
        catch (error) {
          if (!(error instanceof ReferenceImageFailure) || !request.referenceImages.length || Number(input.referenceRetryCount ?? 0) >= 1) throw error;
          if (activeAttempt) await db.generationAttempt.update({ where: { id: activeAttempt }, data: { status: "failed", completedAt: new Date(), ...costFields(error.cost, 0), error: error.message } });
          await markReferenceRetry(id);
          const estimate = estimateImageUsd(candidate, request.resolution, request.prompt, photos);
          activeAttempt = await db.$transaction(async tx => { const prior = await tx.generationAttempt.aggregate({ where: { jobId: id }, _sum: { costUsd: true } }); const reservation = estimate + Number(prior._sum.costUsd ?? 0); await assertUsdQuota(tx, job.createdById, reservation, { jobId: id }); const current = await tx.generationJob.update({ where: { id }, data: { reservedUsd: reservation } }); return (await tx.generationAttempt.create({ data: { jobId: id, provider: candidate.provider, model: candidate.model, fallback: current.fallback, costUsd: estimate, costEstimated: true } })).id; });
          try { return await factory(candidate).generate({ ...request, forceReferenceUpload: true }); }
          catch (failure) { const detail = gatewayException(candidate.provider, failure); throw new GatewayError(candidate.provider, `参考图重传后重试仍失败：${detail.message}`, detail.status, false, detail.uncertain); }
        }
      },
      hooks: {
        async start(candidate, fallback) {
          activeAttempt = await db.$transaction(async tx => {
            const current = await tx.generationJob.findUniqueOrThrow({ where: { id } });
            const prior = await tx.generationAttempt.aggregate({ where: { jobId: id }, _sum: { costUsd: true } });
            const estimate = estimateImageUsd(candidate, request.resolution, request.prompt, photos);
            const reservation = roundUsd(Number(prior._sum.costUsd ?? 0) + estimate);
            await assertUsdQuota(tx, current.createdById, reservation, { jobId: id });
            const claimed = await tx.generationJob.updateMany({ where: { id, status: "running" }, data: { provider: candidate.provider, model: candidate.model, fallback, reservedUsd: reservation, externalTaskId: null, error: null, input: { ...(current.input as object), submissionAttempted: true } as Prisma.InputJsonValue } });
            if (!claimed.count) throw new Error("任务已结束，停止提交");
            return (await tx.generationAttempt.create({ data: { jobId: id, provider: candidate.provider, model: candidate.model, fallback, costUsd: estimate, costEstimated: true } })).id;
          });
          return activeAttempt;
        },
        async success(attemptId, result, duration) { await complete(id, activeAttempt ?? attemptId, result, duration); },
        async failure(attemptId, error, durationMs) {
          attemptId = activeAttempt ?? attemptId;
          const attempt = await db.generationAttempt.findUniqueOrThrow({ where: { id: attemptId } });
          await db.generationAttempt.update({ where: { id: attemptId }, data: { status: "failed", durationMs, error: error.message, completedAt: new Date(), ...costFields(error.cost, error.status < 500 && error.status !== 429 ? 0 : Number(attempt.costUsd ?? 0)), externalGenerationId: error.externalGenerationId, ...(attempt.provider === "zenmux" ? { billingState: error.externalGenerationId ? "pending" : "unavailable", nextBillingAt: error.externalGenerationId ? new Date(Date.now() + 5 * 60_000) : null } : {}) } });
          if (error.uncertain) { const current = await db.generationJob.findUniqueOrThrow({ where: { id } }); await db.generationJob.update({ where: { id }, data: { input: { ...(current.input as object), submissionAttempted: true, uncertainCharge: true } as Prisma.InputJsonValue } }); }
        },
      },
    });
    if (routed.fallback && routed.warnings.length) await db.generationJob.update({ where: { id }, data: { error: `已自动切换备用线路：${routed.warnings.join('；')}` } });
  } catch (error) {
    if (activeAttempt) await db.generationAttempt.updateMany({ where: { id: activeAttempt, status: "running" }, data: { status: "failed", completedAt: new Date(), error: "调用或结果转存失败，请核对网关记录" } });
    await failGatewayJob(id, error);
  }
}
async function complete(jobId: string, attemptId: string, result: ImageGeneration, duration: number) {
  if (result.kind === "pending") {
    await db.generationAttempt.update({ where: { id: attemptId }, data: { status: "pending", externalTaskId: result.taskId, durationMs: duration } });
    const job = await db.generationJob.findUniqueOrThrow({ where: { id: jobId } });
    await db.generationJob.update({ where: { id: jobId }, data: { externalTaskId: result.taskId, nextPollAt: new Date(Date.now() + 5000), input: { ...(job.input as object), ...result.requestInput, uncertainCharge: true } as Prisma.InputJsonValue } });
    return;
  }
  const attempt = await db.generationAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  const job = await db.generationJob.findUniqueOrThrow({ where: { id: jobId } });
  await db.generationJob.update({ where: { id: jobId }, data: { input: { ...(job.input as object), uncertainCharge: true } as Prisma.InputJsonValue } });
  await saveGenerationResult(jobId, result.images, { attemptId, durationMs: attempt.status === "pending" ? Date.now() - attempt.createdAt.getTime() : duration, cost: result.cost, estimateUsd: Number(attempt.costUsd ?? job.reservedUsd), usage: result.usage, externalGenerationId: result.externalGenerationId });
}
export async function pollGatewayJob(id: string, factory = imageProvider) {
  const job = await db.generationJob.findUnique({ where: { id }, include: { attempts: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!job || job.status !== "running" || !job.externalTaskId) return;
  const candidate = candidatesFor(job.logicalModel as LogicalModel).find(c => c.provider === job.provider && c.model === job.model);
  if (!candidate) { await failGatewayJob(id, new Error("任务使用的模型配置已移除")); return; }
  const attempt = job.attempts[0];
  let result: ImageGeneration;
  try { result = await factory(candidate).poll!(job.externalTaskId); }
  catch (error) {
    if (error instanceof ReferenceImageFailure) {
      const input = job.input as Record<string, unknown>;
      if (Number(input.referenceRetryCount ?? 0) >= 1 || !(input.referenceAssetIds as string[])?.length) { await finishFailedAttempt(attempt.id, error); await failGatewayJob(id, error); return; }
      await finishFailedAttempt(attempt.id, error);
      await markReferenceRetry(id);
      // 同一家重传，单独记录第二次实际提交，不标记为备用，不经过网关切换。
      const candidateProvider = factory(candidate);
      try {
        const request: ImageRequest = { prompt: String(input.prompt), referenceImages: (input.referenceAssetIds as string[]).map(id => ({ id })), aspectRatio: String(input.aspect_ratio), resolution: input.resolution as ImageRequest["resolution"], outputFormat: input.output_format as ImageRequest["outputFormat"], forceReferenceUpload: true };
        const photos = await db.asset.findMany({ where: { id: { in: request.referenceImages.map(a => a.id) } }, select: { width: true, height: true } });
        const estimate = estimateImageUsd(candidate, request.resolution, request.prompt, photos);
        const retry = await db.$transaction(async tx => { const sum = await tx.generationAttempt.aggregate({ where: { jobId: id }, _sum: { costUsd: true } }); const reservation = Number(sum._sum.costUsd ?? 0) + estimate; await assertUsdQuota(tx, job.createdById, reservation, { jobId: id }); await tx.generationJob.update({ where: { id }, data: { externalTaskId: null, reservedUsd: reservation } }); return tx.generationAttempt.create({ data: { jobId: id, provider: candidate.provider, model: candidate.model, fallback: job.fallback, costUsd: estimate, costEstimated: true } }); });
        const started = Date.now();
        try { await complete(id, retry.id, await candidateProvider.generate(request), Date.now() - started); }
        catch (failure) { await finishFailedAttempt(retry.id, failure); await failGatewayJob(id, failure); }
      } catch (failure) { await failGatewayJob(id, failure); }
      return;
    }
    const failure = gatewayException(candidate.provider, error);
    // 查询网络故障或下载故障重试原任务，不再重复付费提交。
    if (failure.uncertain || !(error instanceof ImageTaskFailure) && !(error instanceof KieError && error.businessFailure) && failure.retryable) { await scheduleRetry(id, "查询或下载暂时失败，正在重试原任务；10 分钟后停止等待"); return; }
    await finishFailedAttempt(attempt.id, error);
    await databaseCircuit.failure(candidate.provider);
    if (failure.retryable) await generate(id, factory, true);
    else await failGatewayJob(id, new GatewayError(candidate.provider, `${failure.message}；未自动切换`, failure.status, false));
    return;
  }
  if (result.kind === "pending") { await scheduleRetry(id); return; }
  try { await complete(id, attempt.id, result, Date.now() - attempt.createdAt.getTime()); await databaseCircuit.success(candidate.provider); }
  catch { await scheduleRetry(id, "结果转存暂时失败，正在重试原任务；不会再次提交付费生成"); }
}
async function scheduleRetry(id: string, error: string | null = null) { await db.generationJob.updateMany({ where: { id, status: "running" }, data: { nextPollAt: new Date(Date.now() + 5000), error } }); }
async function markReferenceRetry(id: string) { const current = await db.generationJob.findUniqueOrThrow({ where: { id } }); await db.generationJob.update({ where: { id }, data: { input: { ...(current.input as object), referenceRetryCount: 1 } as Prisma.InputJsonValue, error: "参考图链接无法访问，正在重新上传并重试一次（仍使用 KIE）" } }); }
async function finishFailedAttempt(id: string, error: unknown) {
  const attempt = await db.generationAttempt.findUniqueOrThrow({ where: { id } });
  const cost = error instanceof ReferenceImageFailure ? error.cost : (error as { cost?: import("./image-provider").GatewayCost }).cost;
  const detail = gatewayException(attempt.provider === "zenmux" ? "zenmux" : "kie", error);
  await db.generationAttempt.update({ where: { id }, data: { status: "failed", completedAt: new Date(), durationMs: Date.now() - attempt.createdAt.getTime(), error: detail.message, ...costFields(cost, attempt.externalTaskId || detail.uncertain || error instanceof ReferenceImageFailure || error instanceof ImageTaskFailure ? Number(attempt.costUsd ?? 0) : 0) } });
}
async function failGatewayJob(id: string, error: unknown) {
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "GenerationJob" WHERE id = ${id} FOR UPDATE`;
    const job = await tx.generationJob.findUniqueOrThrow({ where: { id } });
    if (job.status !== "running") return;
    const detail = gatewayException(job.provider === "zenmux" ? "zenmux" : "kie", error);
    const input = job.input as Record<string, unknown>;
    const release = !input.uncertainCharge && !detail.uncertain;
    const sum = await tx.generationAttempt.aggregate({ where: { jobId: id }, _sum: { costUsd: true, credits: true } });
    const estimated = Boolean(await tx.generationAttempt.findFirst({ where: { jobId: id, costEstimated: true } })) || sum._sum.costUsd === null && !release;
    await tx.generationJob.update({ where: { id }, data: { status: "failed", completedAt: new Date(), reservedUsd: release || !estimated ? 0 : job.reservedUsd, costUsd: sum._sum.costUsd ?? (release ? 0 : job.reservedUsd), credits: sum._sum.credits, costEstimated: estimated, error: `${error instanceof Error ? error.message : detail.message}；${!estimated ? '实际美元消耗已记录' : release ? '美元配额预留已释放' : '扣费状态未确定，美元预估保留，请管理员核对网关账单'}` } });
  });
}
