import { db } from "@/lib/db";
import { readObject } from "@/lib/storage";
import { StudioError, studioUser, studioError } from "@/lib/studio-api";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await studioUser(request);
    const asset = await db.asset.findUnique({ where: { id: (await context.params).id } });
    if (!asset) throw new StudioError("图片不存在", 404);
    const { bytes, mime } = await readObject(asset.storageKey);
    const extension = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", ...(new URL(request.url).searchParams.get("download") === "1" ? { "Content-Disposition": `attachment; filename="${asset.id}.${extension}"` } : {}) } });
  } catch (error) { return studioError(error, "读取图片失败，请检查文件存储服务"); }
}
