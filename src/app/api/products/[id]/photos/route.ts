import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { inspectPhoto, putObject, deleteObject, MAX_PHOTO_BYTES } from "@/lib/storage";
import { StudioError, studioUser, studioError } from "@/lib/studio-api";
import { photoOrderSchema } from "@/lib/product-validation";
import { reorderProductPhotos } from "@/lib/product-photos";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const storedKeys: string[] = [];
  try {
    const user = await studioUser(request, true);
    const { id } = await context.params;
    if (!await db.product.findUnique({ where: { id }, select: { id: true } })) throw new StudioError("商品不存在", 404);
    if (Number(request.headers.get("content-length") || 0) > 3 * MAX_PHOTO_BYTES + 1024 * 1024) throw new StudioError("上传总大小超过限制");
    const form = await request.formData();
    const files = form.getAll("photos");
    if (!files.length || files.length > 3 || files.some((file) => !(file instanceof File))) throw new StudioError("每次请选择 1 到 3 张实拍图，生成需要共 2 到 3 张");
    const photos: (Awaited<ReturnType<typeof inspectPhoto>> & { bytes: Buffer; storageKey: string })[] = [];
    for (const entry of files) {
      const file = entry as File;
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new StudioError("只支持 JPEG、PNG、WEBP 图片");
      if (!file.size || file.size > MAX_PHOTO_BYTES) throw new StudioError("单张图片大小必须在 0 到 30MB 之间");
      const bytes = Buffer.from(await file.arrayBuffer());
      let photo;
      try { photo = await inspectPhoto(bytes); } catch (error) { throw new StudioError(error instanceof Error ? error.message : "图片无效"); }
      if (photo.mime !== file.type) throw new StudioError("文件内容与图片格式不一致，请重新导出图片");
      photos.push({ bytes, ...photo, storageKey: `products/${id}/photos/${randomUUID()}.${photo.extension}` });
    }
    for (const photo of photos) { await putObject(photo.storageKey, photo.bytes, photo.mime); storedKeys.push(photo.storageKey); }
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;
      const existing = await tx.asset.findMany({ where: { productId: id, type: "photo", deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }], select: { id: true } });
      const count = existing.length;
      if (count + photos.length > 3) throw new StudioError("每件商品最多保存 3 张实拍参考图");
      for (const [sortOrder, asset] of existing.entries()) await tx.asset.update({ where: { id: asset.id }, data: { sortOrder } });
      for (const [index, photo] of photos.entries()) await tx.asset.create({ data: { productId: id, type: "photo", storageKey: photo.storageKey, width: photo.width, height: photo.height, createdById: user.id, sortOrder: count + index } });
    });
    storedKeys.length = 0;
    return NextResponse.json({ message: "实拍图已保存" }, { status: 201 });
  } catch (error) { return studioError(error, "参考图上传失败，请检查 MinIO 服务后重试"); }
  finally { for (const key of storedKeys) await deleteObject(key).catch(() => undefined); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await studioUser(request, true);
    const parsed = photoOrderSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new StudioError("请提交完整且不重复的实拍图片排序");
    await reorderProductPhotos((await context.params).id, parsed.data.photoIds);
    return NextResponse.json({ message: "参考图顺序已保存" });
  } catch (error) { return studioError(error, "保存图片排序失败，请刷新后重试"); }
}
