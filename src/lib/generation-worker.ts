import "server-only";
import { db } from "@/lib/db";
import { downloadResultImage } from "@/lib/remote-image";
import { saveGenerationResult } from "@/lib/save-generation-result";
import { KieError, safeKieMessage } from "@/lib/kie-http";
import type { ImageInput, LegacyImageProvider } from "@/lib/image-provider";
import type { Prisma } from "@/generated/prisma/client";
import { submitGatewayJob, pollGatewayJob } from "./image-router";

async function fail(id: string, error: unknown) {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "GenerationJob" WHERE id = ${id} FOR UPDATE`;
    const job = await tx.generationJob.findUnique({ where: { id } });
    if (!job || !["pending", "running"].includes(job.status)) return;
    const attempted = (job.input as Record<string, unknown>).submissionAttempted === true;
    const rejected = error instanceof KieError && [400, 401, 402, 403, 422, 429].includes(error.code);
    const release = !job.externalTaskId && (!attempted || rejected);
    await tx.generationJob.update({ where: { id }, data: { status: "failed", ...(release ? { cost: 0 } : {}), error: safeKieMessage(error instanceof Error ? error.message : "生图任务失败，请稍后重试") + (release ? "；积分预留已释放" : "；积分预留保留，请核对 KIE 扣费记录"), completedAt: new Date() } });
  });
}

export async function submitSceneJob(id: string, provider?: LegacyImageProvider) {
  if (!provider) return submitGatewayJob(id);
  const claimed = await db.generationJob.updateMany({ where: { id, status: "pending" }, data: { status: "running", startedAt: new Date() } });
  if (!claimed.count) return;
  try {
    const job = await db.generationJob.findUniqueOrThrow({ where: { id } });
    const input = job.input as unknown as ImageInput & { referenceAssetIds: string[] };
    const urls: string[] = [];
    for (const assetId of input.referenceAssetIds) urls.push(await provider.uploadFile(assetId));
    const requestInput: ImageInput = { prompt: input.prompt, image_input: urls, aspect_ratio: input.aspect_ratio, resolution: input.resolution, output_format: input.output_format };
    const marked = await db.generationJob.updateMany({ where: { id, status: "running" }, data: { input: { ...input, ...requestInput, submissionAttempted: true } as unknown as Prisma.InputJsonValue } });
    if (!marked.count) return;
    const taskId = await provider.submit(job.model!, requestInput);
    // 即使超时监测刚将任务置为失败，也记录外部 taskId 供追溯，避免自动重发付费任务。
    await db.generationJob.update({ where: { id }, data: { externalTaskId: taskId, nextPollAt: new Date(Date.now() + 5000) } });
  } catch (error) { await fail(id, error); }
}

export async function pollSceneJob(id: string, provider?: LegacyImageProvider, download: (address: string) => Promise<Buffer> = downloadResultImage) {
  if (!provider) return pollGatewayJob(id);
  const job = await db.generationJob.findUnique({ where: { id } });
  if (!job || job.status !== "running" || !job.externalTaskId) return;
  try {
    const result = await provider.getResult(job.externalTaskId);
    if (result.status === "failed") { await fail(id, new Error(result.error)); return; }
    if (result.status === "pending") { await db.generationJob.updateMany({ where: { id, status: "running" }, data: { nextPollAt: new Date(Date.now() + 5000), error: null } }); return; }
    // 单张场景图任务：完整下载后创建 Asset 与成功记录，同一事务提交。
    const bytes = await download(result.urls[0]);
    await saveGenerationResult(id, [bytes]);
  } catch (error) {
    if (error instanceof KieError && error.code < 500) await fail(id, error);
    else await db.generationJob.updateMany({ where: { id, status: "running" }, data: { nextPollAt: new Date(Date.now() + 5000), error: "查询或结果转存暂时失败，正在重试；10 分钟后停止等待" } });
  }
}
