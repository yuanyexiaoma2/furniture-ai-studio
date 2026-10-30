import "server-only";
import {requestFromGenerationInput} from "./generation-references";
import {imageRouteCandidates} from "./image-models";
import { db } from "./db";
import { routeCall, candidatesFor, gatewayConfigured } from "./gateway-router";
import { databaseCircuit } from "./gateway-circuit";
import { imageProvider } from "./gateway-providers";
import { GatewayError, ImageTaskFailure,ImageResultTransferFailure, gatewayException,switchableGatewayFailure } from "./gateway-error";
import { saveGenerationResult } from "./save-generation-result";
import type { ImageGeneration, ImageRequest, ImageProvider } from "./image-provider";
import type { LogicalModel, ModelCandidate } from "./models.config";
import type { Prisma } from "@/generated/prisma/client";
import { estimateImageUsd, costFields, imageAttemptTotals } from "./gateway-cost";
import { assertUsdQuota } from "./quota";
import { ReferenceImageFailure } from "./kie-http";

export async function submitGatewayJob(id: string, factory = imageProvider) {
  const claimed = await db.generationJob.updateMany({ where: { id, status: "pending" }, data: { status: "running", startedAt: new Date(), workerInstanceId: process.env.GENERATION_WORKER_INSTANCE_ID ?? "manual-test" } });
  if (!claimed.count) return;
  await generate(id, factory);
}
async function generate(id: string, factory: (candidate: ModelCandidate) => ImageProvider, alreadyFallback = false) {
  const job = await db.generationJob.findUniqueOrThrow({ where: { id }, include: { attempts: true } });
  if (job.status !== "running") return;
  const input:Record<string,unknown> = {...job.input as Record<string, unknown>,chargeSuccessfulAttemptOnly:true};
  const request: ImageRequest = requestFromGenerationInput(input);
  const photos = await db.asset.findMany({ where: { id: { in: request.referenceImages.map(p => p.id) } }, select: { width: true, height: true } });
  let activeAttempt: string | undefined,upstreamSucceeded=false;
  try {
    const routed = await routeCall<ImageGeneration>({ logical: job.logicalModel as LogicalModel, circuit: databaseCircuit, alreadyFallback:alreadyFallback||job.attempts.some(a=>a.provider==="kie"&&a.status==="failed"), probe: typeof input.testProvider === "string", isSuccessful: result => result.kind === "done",
      previousErrors: job.attempts.filter(a => a.status === "failed" && a.error).map(a => a.error!), previousProvider: job.provider === "zenmux" ? "zenmux" : "kie",
      candidates: input.selectedCandidate ? imageRouteCandidates(input.selectedCandidate as ModelCandidate) : typeof input.testProvider === "string" ? candidatesFor("scene-main").filter(c => c.provider === input.testProvider) : undefined,
      excluded: job.attempts.map(a => `${a.provider}:${a.model}`), configured: gatewayConfigured,
      async call(candidate) {
        try{const result=await factory(candidate).generate(request);upstreamSucceeded=true;return result;}
        catch(error){if(error instanceof ReferenceImageFailure)throw new GatewayError(candidate.provider,error.message,502,true,false);throw error;}
      },
      hooks: {
        async start(candidate, fallback) {
          activeAttempt = await db.$transaction(async tx => {
            const current = await tx.generationJob.findUniqueOrThrow({ where: { id } });
            const estimate = estimateImageUsd(candidate, request.resolution, request.prompt, photos);
            const reservation = estimate;
            const failures=await tx.generationAttempt.findMany({where:{jobId:id,status:"failed"},select:{error:true}});
            await assertUsdQuota(tx, current.createdById, reservation, { jobId: id });
            const claimed = await tx.generationJob.updateMany({ where: { id, status: "running" }, data: { provider: candidate.provider, model: candidate.model, fallback, reservedUsd: reservation, externalTaskId: null, error: null, input: { ...(current.input as object), chargeSuccessfulAttemptOnly:true,submissionAttempted: true,...(fallback?{switchReason:failures.map(a=>a.error).filter(Boolean).join("；")||String(input.switchReason??"KIE调用失败，切换同款ZenMux")}:{}) } as Prisma.InputJsonValue } });
            if (!claimed.count) throw new Error("任务已结束，停止提交");
            return (await tx.generationAttempt.create({ data: { jobId: id, provider: candidate.provider, model: candidate.model, fallback, costUsd: estimate, costEstimated: true } })).id;
          });
          return activeAttempt;
        },
        async success(attemptId, result, duration) { await complete(id, activeAttempt ?? attemptId, result, duration); },
        async failure(attemptId, error, durationMs) {
          attemptId = activeAttempt ?? attemptId;
          const attempt = await db.generationAttempt.findUniqueOrThrow({ where: { id: attemptId } });
          await db.generationAttempt.update({ where: { id: attemptId }, data: { status: "failed", durationMs, error: error.message+(error.uncertain?"；原请求扣费状态未确定，保留上游审计供核对":""), completedAt: new Date(), ...costFields(error.cost, error.status < 500 && error.status !== 429 ? 0 : Number(attempt.costUsd ?? 0)), externalGenerationId: error.externalGenerationId, ...(attempt.provider === "zenmux" ? { billingState: error.externalGenerationId ? "pending" : "unavailable", nextBillingAt: error.externalGenerationId ? new Date(Date.now() + 5 * 60_000) : null } : {}) } });
          await db.generationJob.updateMany({where:{id,status:"running"},data:{reservedUsd:0,costUsd:0,costEstimated:false}});
          if (error.uncertain) { const current = await db.generationJob.findUniqueOrThrow({ where: { id } }); await db.generationJob.update({ where: { id }, data: { input: { ...(current.input as object), submissionAttempted: true, uncertainCharge: true } as Prisma.InputJsonValue } }); }
        },
      },
    });
    if (routed.fallback && routed.warnings.length) await db.generationJob.update({ where: { id }, data: { error: `已自动切换备用线路：${routed.warnings.join('；')}` } });
  } catch (error) {
    if (activeAttempt) await db.generationAttempt.updateMany({ where: { id: activeAttempt, status: "running" }, data: { status: "failed", completedAt: new Date(), error: "调用或结果转存失败，请核对网关记录" } });
    if(upstreamSucceeded){await failGatewayJob(id,new GatewayError(job.provider==="zenmux"?"zenmux":"kie","上游已接受请求或返回图片，本地保存失败；未再次付费提交",500,false,true));return;}
    const failure=gatewayException(job.provider==="zenmux"?"zenmux":"kie",error);
    if(switchableGatewayFailure(failure)&&await retryOnce(id,factory))return;
    await failGatewayJob(id, error);
  }
}
async function retryOnce(id:string,factory:(candidate:ModelCandidate)=>ImageProvider){
 const current=await db.generationJob.findUniqueOrThrow({where:{id},include:{attempts:true}}),input=current.input as Record<string,unknown>;
 const route=input.selectedCandidate?imageRouteCandidates(input.selectedCandidate as ModelCandidate):candidatesFor(current.logicalModel as LogicalModel);
 if(input.testProvider||Number(input.autoRetryCount??0)>=1||current.attempts.some(a=>a.provider==="zenmux")||!current.attempts.some(a=>a.provider==="kie"&&a.status==="failed")||!route.some(c=>c.provider==="zenmux"&&gatewayConfigured(c.provider)))return false;
 await db.generationJob.update({where:{id},data:{deadlineAt:new Date(Date.now()+10*60_000),input:{...input,autoRetryCount:1,chargeSuccessfulAttemptOnly:true} as Prisma.InputJsonValue,externalTaskId:null,error:"KIE失败，正在切换同款ZenMux一次"}});
 await generate(id,factory,true);return true;
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
  const selected=(job.input as Record<string,unknown>).selectedCandidate as ModelCandidate|undefined;
  const candidate=(selected?imageRouteCandidates(selected):candidatesFor(job.logicalModel as LogicalModel)).find(c=>c.provider===job.provider&&c.model===job.model);
  if (!candidate) { await failGatewayJob(id, new Error("任务使用的模型配置已移除")); return; }
  const attempt = job.attempts[0];
  let result: ImageGeneration;
  try { result = await factory(candidate).poll!(job.externalTaskId); }
  catch (error) {
    if(error instanceof ReferenceImageFailure){await finishFailedAttempt(attempt.id,error);if(!await retryOnce(id,factory))await failGatewayJob(id,error);return;}
    const failure = gatewayException(candidate.provider, error);
    // 已成功图片的下载/转存只重试原结果，不能再生成；网关查询故障按要求切同款一次。
    if (error instanceof ImageResultTransferFailure) { await scheduleRetry(id, "查询或下载暂时失败，正在重试原任务；10 分钟后停止等待"); return; }
    await finishFailedAttempt(attempt.id, error);
    await databaseCircuit.failure(candidate.provider);
    if (switchableGatewayFailure(failure)) {if(!await retryOnce(id,factory))await failGatewayJob(id,failure);}
    else await failGatewayJob(id, new GatewayError(candidate.provider, `${failure.message}；未自动切换`, failure.status, false));
    return;
  }
  if (result.kind === "pending") { await scheduleRetry(id); return; }
  try { await complete(id, attempt.id, result, Date.now() - attempt.createdAt.getTime()); await databaseCircuit.success(candidate.provider); }
  catch { await scheduleRetry(id, "结果转存暂时失败，正在重试原任务；不会再次提交付费生成"); }
}
async function scheduleRetry(id: string, error: string | null = null) { await db.generationJob.updateMany({ where: { id, status: "running" }, data: { nextPollAt: new Date(Date.now() + 5000), error } }); }
async function finishFailedAttempt(id: string, error: unknown) {
  const attempt = await db.generationAttempt.findUniqueOrThrow({ where: { id } });
  const cost = error instanceof ReferenceImageFailure ? error.cost : (error as { cost?: import("./image-provider").GatewayCost }).cost;
  const detail = gatewayException(attempt.provider === "zenmux" ? "zenmux" : "kie", error);
  await db.generationAttempt.update({ where: { id }, data: { status: "failed", completedAt: new Date(), durationMs: Date.now() - attempt.createdAt.getTime(), error: detail.message+(detail.uncertain?"；原请求扣费状态未确定，保留上游审计供核对":""), ...costFields(cost, attempt.externalTaskId || detail.uncertain || error instanceof ReferenceImageFailure || error instanceof ImageTaskFailure ? Number(attempt.costUsd ?? 0) : 0) } });
  const job=await db.generationJob.findUniqueOrThrow({where:{id:attempt.jobId}});
  if((job.input as Record<string,unknown>).chargeSuccessfulAttemptOnly){const attempts=await db.generationAttempt.findMany({where:{jobId:job.id}});await db.generationJob.update({where:{id:job.id},data:{reservedUsd:0,...imageAttemptTotals(job.input as Record<string,unknown>,attempts)}});}
}
async function failGatewayJob(id: string, error: unknown) {
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "GenerationJob" WHERE id = ${id} FOR UPDATE`;
    const job = await tx.generationJob.findUniqueOrThrow({ where: { id } });
    if (job.status !== "running") return;
    const detail = gatewayException(job.provider === "zenmux" ? "zenmux" : "kie", error);
    const input = job.input as Record<string, unknown>;
    if(input.chargeSuccessfulAttemptOnly){await tx.generationJob.update({where:{id},data:{status:"failed",completedAt:new Date(),reservedUsd:0,costUsd:0,credits:null,costEstimated:false,error:detail.message+"；本次生成未成功，失败预留已释放；上游尝试记录保留供审计"}});return;}
    const release = !input.uncertainCharge && !detail.uncertain;
    const sum = await tx.generationAttempt.aggregate({ where: { jobId: id }, _sum: { costUsd: true, credits: true } });
    const estimated = Boolean(await tx.generationAttempt.findFirst({ where: { jobId: id, costEstimated: true } })) || sum._sum.costUsd === null && !release;
    await tx.generationJob.update({ where: { id }, data: { status: "failed", completedAt: new Date(), reservedUsd: release || !estimated ? 0 : job.reservedUsd, costUsd: sum._sum.costUsd ?? (release ? 0 : job.reservedUsd), credits: sum._sum.credits, costEstimated: estimated, error: `${error instanceof Error ? error.message : detail.message}；${!estimated ? '实际美元消耗已记录' : release ? '美元配额预留已释放' : '扣费状态未确定，美元预估保留，请管理员核对网关账单'}` } });
  });
}
