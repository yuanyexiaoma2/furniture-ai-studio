import "server-only";
import { PgBoss,fromPrisma } from "pg-boss";
import {imageRouteCandidates} from "./image-models";
import {gatewayConfigured} from "./gateway-router";
import {models,type ModelCandidate} from "./models.config";
import type {Prisma} from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { databaseCircuit } from "./gateway-circuit";

export const SUBMIT_QUEUE = "kie-scene-submit";
export const POLL_QUEUE = "kie-scene-poll";
export const MAX_JOB_MS = 10 * 60 * 1000;
export const WORKER_ID = "kie-scene";
const globalQueue = globalThis as unknown as { kieBoss?: Promise<PgBoss> };

export function getBoss() {
  return globalQueue.kieBoss ??= (async () => {
    const boss = new PgBoss({ connectionString: process.env.DATABASE_URL, schema: process.env.PG_BOSS_SCHEMA || "pgboss" });
    boss.on("error", () => console.error("任务队列连接异常，请检查本地 PostgreSQL 服务"));
    await boss.start();
    // 全局串行提交，不按 jobId 扩展 singleton；poll 使用 jobId 去重。
    await boss.createQueue(SUBMIT_QUEUE, { policy: "singleton", retryLimit: 0, expireInSeconds: 600 });
    await boss.createQueue(POLL_QUEUE, { policy: "exclusive", retryLimit: 0, expireInSeconds: 180 });
    return boss;
  })().catch((error) => { globalQueue.kieBoss = undefined; throw error; });
}

export async function workerIsReady() {
  const worker = await db.workerHeartbeat.findUnique({ where: { id: WORKER_ID } });
  return Boolean(worker && Date.now() - worker.updatedAt.getTime() < 20000);
}

export async function expireOverdueJobs() {
  // 沿用原GenerationJob和提交队列；KIE已提交任务超时，只给同款ZenMux一次机会。
  const timedOut=await db.generationJob.findMany({where:{status:"running",provider:"kie",deadlineAt:{lt:new Date()},input:{path:["chargeSuccessfulAttemptOnly"],equals:true}},include:{attempts:true},take:100});
  for(const job of timedOut){
    const input=job.input as Record<string,unknown>,route=imageRouteCandidates((input.selectedCandidate as ModelCandidate|undefined)??models["scene-main"][0]);
    if(input.testProvider||Number(input.autoRetryCount??0)>=1||job.attempts.some(a=>a.provider==="zenmux")||!route.some(c=>c.provider==="zenmux"&&gatewayConfigured(c.provider)))continue;
    const boss=await getBoss();
    await db.$transaction(async tx=>{
      const changed=await tx.generationJob.updateMany({where:{id:job.id,status:"running",deadlineAt:job.deadlineAt},data:{status:"pending",fallback:true,deadlineAt:new Date(Date.now()+MAX_JOB_MS),externalTaskId:null,nextPollAt:null,reservedUsd:0,costUsd:0,costEstimated:false,input:{...input,autoRetryCount:1,switchReason:"KIE任务超过10分钟，原请求状态未确定；切换同款ZenMux一次"} as Prisma.InputJsonValue}});
      if(!changed.count)return;
      await tx.generationAttempt.updateMany({where:{jobId:job.id,status:{in:["running","pending"]}},data:{status:"failed",completedAt:new Date(),error:"KIE任务超过10分钟，原请求状态未确定，失败预留已释放"}});
      if(!await boss.send(SUBMIT_QUEUE,{jobId:job.id},{db:fromPrisma(tx)}))throw Error("同款备用任务未能入队");
    });
  }
  // 单条 SQL 锁住状态与预留，防止超时监测与提交标记交错后错误退款。
  const expired = await db.$queryRaw<{ provider: string | null; attempted: boolean }[]>`UPDATE "GenerationJob" SET status = 'failed', "completedAt" = NOW(), "updatedAt" = NOW(),
    "reservedUsd" = CASE WHEN input->>'chargeSuccessfulAttemptOnly'='true' THEN 0 WHEN input->>'submissionAttempted' = 'true' OR "externalTaskId" IS NOT NULL THEN "reservedUsd" ELSE 0 END,
    "costUsd" = CASE WHEN input->>'chargeSuccessfulAttemptOnly'='true' THEN 0 WHEN input->>'submissionAttempted' = 'true' OR "externalTaskId" IS NOT NULL THEN COALESCE("costUsd","reservedUsd") ELSE 0 END,
    "costEstimated" = CASE WHEN input->>'chargeSuccessfulAttemptOnly'='true' THEN false ELSE true END,
    error = CASE WHEN input->>'chargeSuccessfulAttemptOnly'='true' THEN '任务超时未成功，失败预留已释放；上游尝试记录保留供审计。' WHEN input->>'submissionAttempted' = 'true' OR "externalTaskId" IS NOT NULL
      THEN '任务超过 10 分钟未完成，已停止等待。扣费状态未确定，美元预估保留，请核对网关任务记录。'
      ELSE '任务超过 10 分钟未提交，已停止等待并释放美元配额预留，请检查 worker 后重新生成。' END
    WHERE status IN ('pending', 'running') AND COALESCE("deadlineAt","createdAt" + INTERVAL '10 minutes') < NOW() RETURNING provider, (input->>'submissionAttempted' = 'true' OR "externalTaskId" IS NOT NULL) AS attempted`;
  for (const job of expired) if (job.attempted && (job.provider === "kie" || job.provider === "zenmux")) await databaseCircuit.failure(job.provider);
  await db.$executeRaw`UPDATE "GenerationAttempt" a SET status = 'failed', "completedAt" = NOW(), "durationMs" = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - a."createdAt"))*1000)::integer, error = j.error FROM "GenerationJob" j WHERE a."jobId" = j.id AND j.status = 'failed' AND a.status IN ('running', 'pending')`;
}
