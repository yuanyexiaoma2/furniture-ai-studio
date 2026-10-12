import "dotenv/config";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { KieProvider } from "../src/lib/kie-provider";
import { getBoss, SUBMIT_QUEUE, POLL_QUEUE, WORKER_ID, expireOverdueJobs } from "../src/lib/generation-queue";
import { downloadResultImage } from "../src/lib/remote-image";
import { putObject, inspectPhoto, deleteObject } from "../src/lib/storage";
import { safeKieMessage } from "../src/lib/kie-http";
import type { ImageInput } from "../src/lib/image-provider";
import type { Prisma } from "../src/generated/prisma/client";

const instanceId = randomUUID();
const provider = new KieProvider();
const boss = await getBoss();
let shuttingDown = false;
let reconciling = false;

async function fail(id: string, error: unknown) {
  await db.generationJob.updateMany({ where: { id, status: { in: ["pending", "running"] } }, data: { status: "failed", error: safeKieMessage(error instanceof Error ? error.message : "生图任务失败，请稍后重试"), completedAt: new Date() } });
}

await boss.work<{ jobId: string }>(SUBMIT_QUEUE, { localConcurrency: 1, batchSize: 1, pollingIntervalSeconds: 0.5 }, async ([queueJob]) => {
  const id = queueJob.data.jobId;
  const claimed = await db.generationJob.updateMany({ where: { id, status: "pending" }, data: { status: "running", startedAt: new Date() } });
  if (!claimed.count) return;
  try {
    const job = await db.generationJob.findUniqueOrThrow({ where: { id } });
    const input = job.input as unknown as ImageInput & { referenceAssetIds: string[] };
    const urls: string[] = [];
    for (const assetId of input.referenceAssetIds) urls.push(await provider.uploadFile(assetId));
    const requestInput: ImageInput = { prompt: input.prompt, image_input: urls, aspect_ratio: input.aspect_ratio, resolution: input.resolution, output_format: input.output_format };
    await db.generationJob.update({ where: { id }, data: { input: { ...input, ...requestInput } as unknown as Prisma.InputJsonValue } });
    const current = await db.generationJob.findUniqueOrThrow({ where: { id } });
    if (current.status !== "running") return;
    const taskId = await provider.submit(job.model!, requestInput);
    // 即使超时监测刚将任务置为失败，也记录外部 taskId 供追溯，避免自动重发付费任务。
    await db.generationJob.update({ where: { id }, data: { externalTaskId: taskId, nextPollAt: new Date(Date.now() + 5000) } });
  } catch (error) { await fail(id, error); }
});

await boss.work<{ jobId: string }>(POLL_QUEUE, { localConcurrency: 4, batchSize: 1, pollingIntervalSeconds: 0.5 }, async ([queueJob]) => {
  const id = queueJob.data.jobId;
  const job = await db.generationJob.findUnique({ where: { id } });
  if (!job || job.status !== "running" || !job.externalTaskId) return;
  const storedKeys: string[] = [];
  try {
    const result = await provider.getResult(job.externalTaskId);
    if (result.status === "failed") { await fail(id, new Error(result.error)); return; }
    if (result.status === "pending") { await db.generationJob.update({ where: { id }, data: { nextPollAt: new Date(Date.now() + 5000) } }); return; }
    // 单张场景图任务：完整下载后创建 Asset 与成功记录，同一事务提交。
    const bytes = await downloadResultImage(result.urls[0]);
    const photo = await inspectPhoto(bytes);
    const storageKey = `products/${job.productId}/generated/${id}.${photo.extension}`;
    await putObject(storageKey, bytes, photo.mime);
    storedKeys.push(storageKey);
    await db.$transaction(async (tx) => {
      const claimed = await tx.generationJob.updateMany({ where: { id, status: "running" }, data: { status: "success", completedAt: new Date(), error: null } });
      if (!claimed.count) throw new Error("任务已经结束，停止转存");
      const asset = await tx.asset.create({ data: { productId: job.productId, type: "generated", storageKey, width: photo.width, height: photo.height, createdById: job.createdById } });
      await tx.generationJob.update({ where: { id }, data: { resultAssetIds: [asset.id] } });
    });
    storedKeys.length = 0;
  } catch (error) {
    await fail(id, error instanceof Error ? error : new Error("KIE 结果转存失败，请检查 MinIO 服务"));
  } finally {
    for (const key of storedKeys) await deleteObject(key).catch(() => undefined);
  }
});

async function reconcile() {
  if (reconciling || shuttingDown) return;
  reconciling = true;
  try {
    await db.workerHeartbeat.upsert({ where: { id: WORKER_ID }, create: { id: WORKER_ID, instanceId }, update: { instanceId } });
    await expireOverdueJobs();
    const due = await db.generationJob.findMany({ where: { provider: "kie", status: "running", externalTaskId: { not: null }, nextPollAt: { lte: new Date() } }, select: { id: true }, take: 100, orderBy: { nextPollAt: "asc" } });
    for (const job of due) await boss.send(POLL_QUEUE, { jobId: job.id }, { singletonKey: job.id });
  } catch { console.error("轮询调度暂时失败，将在下一轮重试；超时任务会停止等待"); }
  finally { reconciling = false; }
}

await reconcile();
// 每 0.5 秒调度已到期的 5 秒轮询，避免固定扫描导致轮询间隔变成 10 秒。
const timer = setInterval(() => void reconcile(), 500);
console.log("KIE worker 已启动：串行提交、5 秒轮询、10 分钟超时");

async function stop() {
  if (shuttingDown) return;
  shuttingDown = true; clearInterval(timer);
  await boss.stop({ graceful: true, timeout: 45000 });
  await db.workerHeartbeat.deleteMany({ where: { id: WORKER_ID, instanceId } });
  await db.$disconnect();
  process.exit(0);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
