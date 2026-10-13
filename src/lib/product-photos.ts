import "server-only";
import { db } from "@/lib/db";
import { StudioError } from "@/lib/studio-error";

export async function reorderProductPhotos(productId: string, photoIds: string[]) {
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${productId}, 0))`;
    if (!await tx.product.findUnique({ where: { id: productId }, select: { id: true } })) throw new StudioError("商品不存在", 404);
    const current = await tx.asset.findMany({ where: { productId, type: "photo", deletedAt: null }, select: { id: true } });
    if (new Set(photoIds).size !== photoIds.length || current.length !== photoIds.length || current.some((photo) => !photoIds.includes(photo.id))) throw new StudioError("参考图已变更，请刷新列表后重新排序", 409);
    for (const [sortOrder, id] of photoIds.entries()) await tx.asset.update({ where: { id }, data: { sortOrder } });
  });
}

export async function removeProductPhoto(productId: string, assetId: string) {
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${productId}, 0))`;
    const removed = await tx.asset.updateMany({ where: { id: assetId, productId, type: "photo", deletedAt: null }, data: { deletedAt: new Date() } });
    if (!removed.count) throw new StudioError("实拍图不存在或已经删除", 404);
    // 隐藏当前参考，保留文件供排队任务和历史编辑使用；不会使既有任务失去素材。
  });
}
