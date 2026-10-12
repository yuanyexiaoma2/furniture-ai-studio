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
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return studioError(error, "读取图片失败，请检查文件存储服务"); }
}
