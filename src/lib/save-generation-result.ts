import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { inspectPhoto, putObject, deleteObject,readObject } from "@/lib/storage";
import {compositeMaskedEdit} from "./masked-edit";
import type { GatewayCost, TokenUsage } from "./image-provider";
import {writeProductReviewSafely} from "./visual-review";
import { costFields } from "./gateway-cost";

// 同步 / 异步网关共享：先保存文件，再在同一事务写 Asset 和成功状态。
export async function saveGenerationResult(jobId: string, images: Buffer[], meta?: { attemptId: string; durationMs: number; cost?: GatewayCost; estimateUsd: number; usage?: TokenUsage; externalGenerationId?: string }) {
  if (!images.length) throw new Error("生图未返回结果图片");
  const job = await db.generationJob.findUniqueOrThrow({ where: { id: jobId } });
  const stored: { key: string; width: number; height: number }[] = [];
  try {
    for (const image of images) {
      let bytes=image;
      const input=job.input as Record<string,unknown>;
      if(input.editMode==="masked"){
        const original=await db.asset.findFirstOrThrow({where:{id:String(input.sourceAssetId),productId:job.productId}});
        const mask=await db.asset.findFirstOrThrow({where:{id:String(input.maskAssetId),productId:job.productId,type:"mask"}});
        bytes=await compositeMaskedEdit((await readObject(original.storageKey)).bytes,bytes,(await readObject(mask.storageKey)).bytes);
      }
      const photo = await inspectPhoto(bytes);
      const key = `products/${job.productId ?? "gateway-tests"}/generated/${jobId}-${randomUUID()}.${photo.extension}`;
      await putObject(key, bytes, photo.mime); stored.push({ key, width: photo.width, height: photo.height });
    }
    const ids = await db.$transaction(async (tx) => {
      const failures = job.fallback ? await tx.generationAttempt.findMany({ where: { jobId, status: "failed" }, select: { error: true } }) : [];
      const explanation = failures.map(a => a.error).filter(Boolean).join('；');
      const claimed = await tx.generationJob.updateMany({ where: { id: jobId, status: "running" }, data: { status: "success", completedAt: new Date(), error: job.fallback && explanation ? `已自动切换备用线路：${explanation}` : null } });
      if (!claimed.count) throw new Error("任务已经结束，停止转存");
      const ids: string[] = [];
      for (const file of stored) {
        const asset = await tx.asset.create({ data: { productId: job.productId, type: "generated", storageKey: file.key, width: file.width, height: file.height, createdById: job.createdById } }); ids.push(asset.id);
      }
      await tx.generationJob.update({ where: { id: jobId }, data: { resultAssetIds: ids } });
      if (meta) {
        const money = costFields(meta.cost, meta.estimateUsd);
        await tx.generationAttempt.update({ where: { id: meta.attemptId }, data: { status: "success", completedAt: new Date(), durationMs: meta.durationMs, ...money, usage: meta.usage, externalGenerationId: meta.externalGenerationId, ...(job.provider === "zenmux" ? { billingState: meta.externalGenerationId ? "pending" : "unavailable", nextBillingAt: meta.externalGenerationId ? new Date(Date.now() + 5 * 60_000) : null } : {}) } });
        const attempts = await tx.generationAttempt.findMany({ where: { jobId } });
        await tx.generationJob.update({ where: { id: jobId }, data: { costUsd: attempts.reduce((sum, a) => sum + Number(a.costUsd ?? 0), 0), credits: attempts.some(a => a.credits !== null) ? attempts.reduce((sum, a) => sum + Number(a.credits ?? 0), 0) : null, costEstimated: attempts.some(a => a.costEstimated), reservedUsd: 0 } });
      }
      return ids;
    });
    stored.length = 0;
    if(job.productId)await writeProductReviewSafely(job.productId);
    return ids;
  } finally { for (const file of stored) await deleteObject(file.key).catch(() => undefined); }
}
