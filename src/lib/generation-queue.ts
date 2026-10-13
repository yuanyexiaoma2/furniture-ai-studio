import "server-only";
import { PgBoss } from "pg-boss";
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
  // 单条 SQL 锁住状态与预留，防止超时监测与提交标记交错后错误退款。
  const expired = await db.$queryRaw<{ provider: string | null; attempted: boolean }[]>`UPDATE "GenerationJob" SET status = 'failed', "completedAt" = NOW(), "updatedAt" = NOW(),
    "reservedCredits" = CASE WHEN input->>'submissionAttempted' = 'true' OR "externalTaskId" IS NOT NULL THEN "reservedCredits" ELSE 0 END,
    error = CASE WHEN input->>'submissionAttempted' = 'true' OR "externalTaskId" IS NOT NULL
      THEN '任务超过 10 分钟未完成，已停止等待。扣费状态未确定，积分预留保留，请核对网关任务记录。'
      ELSE '任务超过 10 分钟未提交，已停止等待并释放积分预留，请检查 worker 后重新生成。' END
    WHERE status IN ('pending', 'running') AND "createdAt" < ${new Date(Date.now() - MAX_JOB_MS)} RETURNING provider, (input->>'submissionAttempted' = 'true' OR "externalTaskId" IS NOT NULL) AS attempted`;
  for (const job of expired) if (job.attempted && (job.provider === "kie" || job.provider === "zenmux")) await databaseCircuit.failure(job.provider);
  await db.$executeRaw`UPDATE "GenerationAttempt" a SET status = 'failed', "completedAt" = NOW(), "durationMs" = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - a."createdAt"))*1000)::integer, error = j.error FROM "GenerationJob" j WHERE a."jobId" = j.id AND j.status = 'failed' AND a.status IN ('running', 'pending')`;
}
