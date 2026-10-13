import "server-only";
import { hostname } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import type { PgBoss } from "pg-boss";
import { db } from "./db";
import { WORKER_ID, SUBMIT_QUEUE, POLL_QUEUE, MAX_JOB_MS } from "./generation-queue";

export async function claimWorkerLease(instanceId: string) {
  for (let attempt = 0; attempt < 61; attempt++) {
    const accepted = await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(8121307)`;
      const old = await tx.workerHeartbeat.findUnique({ where: { id: WORKER_ID } });
      if (old && Date.now() - old.updatedAt.getTime() < 20_000 && old.instanceId !== instanceId) {
        if (!old.processId) return false; // 旧版本无进程信息，等心跳过期后接管。
        let alive = old.hostName !== hostname();
        if (!alive) try { process.kill(old.processId, 0); alive = true; } catch { alive = false; }
        if (alive) throw new Error("已有生图 worker 正在运行，请勿重复启动");
      }
      const fields = { instanceId, processId: process.pid, hostName: hostname() };
      await tx.workerHeartbeat.upsert({ where: { id: WORKER_ID }, create: { id: WORKER_ID, ...fields }, update: fields });
      return true;
    });
    if (accepted) return;
    await delay(500);
  }
  throw new Error("现有 worker 心跳仍有效，未启动重复服务");
}

export async function recoverInterruptedJobs(instanceId: string, boss: PgBoss) {
  const schema = process.env.PG_BOSS_SCHEMA || "pgboss";
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) throw new Error("队列 schema 名称无效");
  // 已取得唯一 worker 租约，旧进程已退出；取消其队列占用，马上重新接管。
  const stale = await db.$queryRawUnsafe<{ id: string; name: string }[]>(`SELECT id,name FROM "${schema}".job WHERE state='active' AND name IN ('${SUBMIT_QUEUE}','${POLL_QUEUE}')`);
  for (const queue of [SUBMIT_QUEUE, POLL_QUEUE]) { const ids = stale.filter(j => j.name === queue).map(j => j.id); if (ids.length) await boss.cancel(queue, ids); }
  const running = await db.generationJob.findMany({ where: { status: "running" } });
  for (const job of running) {
    if (job.provider === "kie" && job.externalTaskId) {
      await db.generationJob.update({ where: { id: job.id }, data: { nextPollAt: new Date(), deadlineAt: new Date(Date.now() + MAX_JOB_MS), workerInstanceId: instanceId, error: "服务恢复，已接管原 KIE 任务轮询，不重新提交" } });
      continue;
    }
    if (!job.provider && !(job.input as Record<string, unknown>).submissionAttempted) {
      await db.generationJob.update({ where: { id: job.id }, data: { status: "pending", startedAt: null, workerInstanceId: null } }); continue;
    }
    const message = job.provider === "zenmux" ? "ZenMux 同步请求因 worker 重启中断，已标记失败；可重新生成，先核对未知扣费" : "生图提交因 worker 重启中断，未获得任务编号；已标记失败，请核对网关记录后重新生成";
    await db.$transaction(async tx => {
      await tx.generationJob.update({ where: { id: job.id }, data: { status: "failed", completedAt: new Date(), costUsd: job.costUsd ?? job.reservedUsd, costEstimated: true, error: message } });
      await tx.$executeRaw`UPDATE "GenerationAttempt" SET status='failed', "completedAt"=NOW(), "durationMs"=GREATEST(0,EXTRACT(EPOCH FROM (NOW()-"createdAt"))*1000)::integer, error=${message} WHERE "jobId"=${job.id} AND status IN ('running','pending')`;
    });
  }
  const pending = await db.generationJob.findMany({ where: { status: "pending" }, select: { id: true } });
  for (const job of pending) {
    await db.generationJob.update({ where: { id: job.id }, data: { deadlineAt: new Date(Date.now() + MAX_JOB_MS) } });
    const [queued] = await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*) FROM "${schema}".job WHERE name=$1 AND data->>'jobId'=$2 AND state IN ('created','retry','active')`, SUBMIT_QUEUE, job.id);
    if (!Number(queued.count)) await boss.send(SUBMIT_QUEUE, { jobId: job.id });
  }
}
export async function expireInterruptedLlmCalls() {
  await db.$executeRaw`UPDATE "LlmCall" SET status='failed', "completedAt"=NOW(), "durationMs"=90000, "reservedUsd"=0, "costEstimated"=true, error='大语言模型请求超过90秒或服务已中断，已停止等待；可重试，先核对未知扣费' WHERE status='running' AND "createdAt"<${new Date(Date.now() - 90_000)}`;
}
