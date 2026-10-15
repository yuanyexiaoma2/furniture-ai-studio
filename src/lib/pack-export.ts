import "server-only";
import sharp from "sharp";
import { db } from "./db";
import { readObject } from "./storage";
import { StudioError } from "./studio-error";
import { packFilename } from "./pack-rules";
import { buildZip } from "./zip";
export async function exportPack(productId: string, partial: boolean, resolution?: "2K"|"4K") {
  const pack = await db.imagePack.findFirst({ where: { productId, isCurrent: true }, include: { product: true, slots: { where: { deletedAt: null }, orderBy: { order: "asc" }, include: { finalAsset: true, jobs: { where: { status: "success" } } } } } });
  if (!pack) throw new StudioError("图包不存在", 404);
  const missing = pack.slots.filter(s => !s.finalAssetId).map(s => s.name);
  if (missing.length && !partial) throw new StudioError(`以下图位尚无终稿：${missing.join("、")}。请确认仅导出已完成部分`, 409);
  const files: { name: string; bytes: Buffer }[] = [], images = [];
  for (const [index, slot] of pack.slots.entries()) {
    if (!slot.finalAsset || slot.finalAsset.deletedAt) continue;
    const job = slot.jobs.find(j => Array.isArray(j.resultAssetIds) && j.resultAssetIds.includes(slot.finalAssetId!));
    if (!job) throw new StudioError(`图位“${slot.name}”的终稿缺少生成审计记录`);
    const { bytes } = await readObject(slot.finalAsset.storageKey), png = await (resolution?sharp(bytes).resize({width:resolution==="4K"?4096:2048,height:resolution==="4K"?4096:2048,fit:"inside",withoutEnlargement:false}):sharp(bytes)).png().toBuffer(), metadata = await sharp(png).metadata();
    const filename = packFilename(pack.product.sku, index + 1, slot.slotType);
    files.push({ name: filename, bytes: png });
    const input = job.input as Record<string, unknown>;
    images.push({ filename, slotId: slot.id, slotName: slot.name, order: index + 1, slotType: slot.slotType, goal: input.sceneIntent ?? slot.goal, assetId: slot.finalAssetId, jobId: job.id, batchId: job.batchId, provider: job.provider, model: job.model, fallback: job.fallback, width: metadata.width, height: metadata.height, costUsd: job.costUsd === null ? null : Number(job.costUsd), costEstimated: job.costEstimated, credits: job.credits === null ? null : Number(job.credits), identityVersionId: input.identityVersionId, identityTraits: input.identityTraits, identitySavedAt: input.identitySavedAt, identitySavedById: input.identitySavedById, generatedAt: job.completedAt?.toISOString() ?? job.createdAt.toISOString() });
  }
  if (!files.length) throw new StudioError("还没有可导出的终稿");
  files.push({ name: "manifest.json", bytes: Buffer.from(JSON.stringify({ sku: pack.product.sku, packId: pack.id, exportedAt: new Date().toISOString(), exportResolution:resolution??"original", resizing:resolution?"等比缩放，不改变模型原生画质":"none", missingSlots: missing, images }, null, 2)) });
  return { filename: `${pack.product.sku.replace(/[^\p{L}\p{N}_-]/gu, "_")}_finals.zip`, bytes: buildZip(files) };
}
