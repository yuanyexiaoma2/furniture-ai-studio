import "server-only";
import { PgBoss } from "pg-boss";
import { db } from "@/lib/db";

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
  await db.generationJob.updateMany({
    where: { provider: "kie", status: { in: ["pending", "running"] }, createdAt: { lt: new Date(Date.now() - MAX_JOB_MS) } },
    data: { status: "failed", error: "任务超过 10 分钟未完成，已停止等待。若已提交到 KIE，请检查账户任务记录；可重新发起生成。", completedAt: new Date() },
  });
}
