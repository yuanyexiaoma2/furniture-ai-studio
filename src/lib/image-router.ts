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

export async function submitGatewayJob(id: string, factory = imageProvider) {
  const claimed = await db.generationJob.updateMany({ where: { id, status: "pending" }, data: { status: "running", startedAt: new Date() } });
  if (!claimed.count) return;
  await generate(id, factory);
}
async function generate(id: string, factory: (candidate: ModelCandidate) => ImageProvider, alreadyFallback = false) {
  const job = await db.generationJob.findUniqueOrThrow({ where: { id }, include: { attempts: true } });
  if (job.status !== "running") return;
  const input = job.input as Record<string, unknown>;
  const request: ImageRequest = { prompt: String(input.prompt), referenceImages: (input.referenceAssetIds as string[]).map(id => ({ id })), aspectRatio: String(input.aspect_ratio), resolution: input.resolution as ImageRequest["resolution"], outputFormat: input.output_format as ImageRequest["outputFormat"] };
  let activeAttempt: string | undefined;
  try {
    const routed = await routeCall<ImageGeneration>({ logical: job.logicalModel as LogicalModel, circuit: databaseCircuit, alreadyFallback, probe: typeof input.testProvider === "string", isSuccessful: result => result.kind === "done",
      previousErrors: job.attempts.filter(a => a.status === "failed" && a.error).map(a => a.error!), previousProvider: job.provider === "zenmux" ? "zenmux" : "kie",
      candidates: typeof input.testProvider === "string" ? candidatesFor("scene-main").filter(c => c.provider === input.testProvider) : undefined,
      excluded: job.attempts.map(a => `${a.provider}:${a.model}`), configured: gatewayConfigured,
      async call(candidate) { return factory(candidate).generate(request); },
      hooks: {
        async start(candidate, fallback) {
          activeAttempt = await db.$transaction(async tx => {
            const current = await tx.generationJob.findUniqueOrThrow({ where: { id } });
            const claimed = await tx.generationJob.updateMany({ where: { id, status: "running" }, data: { provider: candidate.provider, model: candidate.model, fallback, externalTaskId: null, error: null, input: { ...(current.input as object), submissionAttempted: true } as Prisma.InputJsonValue } });
            if (!claimed.count) throw new Error("任务已结束，停止提交");
            return (await tx.generationAttempt.create({ data: { jobId: id, provider: candidate.provider, model: candidate.model, fallback } })).id;
          });
          return activeAttempt;
        },
        async success(attemptId, result, duration) { await complete(id, attemptId, result, duration); },
        async failure(attemptId, error, durationMs) {
          await db.generationAttempt.update({ where: { id: attemptId }, data: { status: "failed", durationMs, error: error.message, completedAt: new Date() } });
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
  const resolution = (job.input as Record<string, unknown>).resolution as "1K" | "2K" | "4K";
  const candidate = candidatesFor(job.logicalModel as LogicalModel).find(c => c.provider === attempt.provider && c.model === attempt.model);
  const estimate = candidate?.pricing.images?.[resolution];
  const cost = result.cost ?? (estimate === undefined ? undefined : { amount: estimate, currency: candidate!.pricing.currency, estimated: true });
  await saveGenerationResult(jobId, result.images, { attemptId, durationMs: attempt.status === "pending" ? Date.now() - attempt.createdAt.getTime() : duration, cost, usage: result.usage });
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
    const failure = gatewayException(candidate.provider, error);
    // 查询网络故障或下载故障重试原任务，不再重复付费提交。
    if (failure.uncertain || !(error instanceof ImageTaskFailure) && failure.retryable) { await scheduleRetry(id, "查询或下载暂时失败，正在重试原任务；10 分钟后停止等待"); return; }
    await db.generationAttempt.update({ where: { id: attempt.id }, data: { status: "failed", completedAt: new Date(), durationMs: Date.now() - attempt.createdAt.getTime(), error: failure.message } });
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
async function failGatewayJob(id: string, error: unknown) {
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "GenerationJob" WHERE id = ${id} FOR UPDATE`;
    const job = await tx.generationJob.findUniqueOrThrow({ where: { id } });
    if (job.status !== "running") return;
    const detail = gatewayException(job.provider === "zenmux" ? "zenmux" : "kie", error);
    const input = job.input as Record<string, unknown>;
    const release = !input.uncertainCharge && !detail.uncertain;
    await tx.generationJob.update({ where: { id }, data: { status: "failed", completedAt: new Date(), reservedCredits: release ? 0 : job.reservedCredits, error: `${detail.message}；${release ? '配额预留已释放' : '扣费状态未确定，配额预留保留，请管理员核对网关账单'}` } });
  });
}
