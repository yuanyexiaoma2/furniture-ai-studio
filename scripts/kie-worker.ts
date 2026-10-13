import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { db } from "../src/lib/db";
import { getBoss, SUBMIT_QUEUE, POLL_QUEUE, WORKER_ID, expireOverdueJobs } from "../src/lib/generation-queue";
import { submitSceneJob, pollSceneJob } from "../src/lib/generation-worker";
import { claimWorkerLease, recoverInterruptedJobs, expireInterruptedLlmCalls } from "../src/lib/worker-recovery";
import { reconcileZenMuxCosts } from "../src/lib/zenmux-billing";

const instanceId = randomUUID();
process.env.GENERATION_WORKER_INSTANCE_ID = instanceId;
await claimWorkerLease(instanceId);
const boss = await getBoss();
await recoverInterruptedJobs(instanceId, boss);
let shuttingDown = false;
let reconciling = false;

await boss.work<{ jobId: string }>(SUBMIT_QUEUE, { localConcurrency: 1, batchSize: 1, pollingIntervalSeconds: 0.5 }, async ([queueJob]) => { await submitSceneJob(queueJob.data.jobId); });
await boss.work<{ jobId: string }>(POLL_QUEUE, { localConcurrency: 4, batchSize: 1, pollingIntervalSeconds: 0.5 }, async ([queueJob]) => { await pollSceneJob(queueJob.data.jobId); });

async function reconcile() {
  if (reconciling || shuttingDown) return;
  reconciling = true;
  try {
    const heartbeat = { instanceId, processId: process.pid, hostName: hostname() };
    await db.workerHeartbeat.upsert({ where: { id: WORKER_ID }, create: { id: WORKER_ID, ...heartbeat }, update: heartbeat });
    await expireOverdueJobs();
    await expireInterruptedLlmCalls();
    const due = await db.generationJob.findMany({ where: { status: "running", externalTaskId: { not: null }, nextPollAt: { lte: new Date() } }, select: { id: true }, take: 100, orderBy: { nextPollAt: "asc" } });
    for (const job of due) await boss.send(POLL_QUEUE, { jobId: job.id }, { singletonKey: job.id });
  } catch { console.error("轮询调度暂时失败，将在下一轮重试；超时任务会停止等待"); }
  finally { reconciling = false; }
}

await reconcile();
// 每 0.5 秒调度已到期的 5 秒轮询，避免固定扫描导致轮询间隔变成 10 秒。
const timer = setInterval(() => void reconcile(), 500);
let billing = false;
const billingTimer = setInterval(() => { if (billing || shuttingDown) return; billing = true; void reconcileZenMuxCosts().finally(() => { billing = false; }); }, 60_000);
console.log("双网关 worker 已启动：串行提交、5 秒轮询、10 分钟超时");

async function stop() {
  if (shuttingDown) return;
  shuttingDown = true; clearInterval(timer); clearInterval(billingTimer);
  await boss.stop({ graceful: true, timeout: 45000 });
  await db.workerHeartbeat.deleteMany({ where: { id: WORKER_ID, instanceId } });
  await db.$disconnect();
  process.exit(0);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
