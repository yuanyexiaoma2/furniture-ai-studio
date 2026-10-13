import { studioUser, studioError } from "@/lib/studio-api";
import { exportPack } from "@/lib/pack-export";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await studioUser(request);
    const result = await exportPack((await context.params).id, new URL(request.url).searchParams.get("partial") === "1");
    return new Response(new Uint8Array(result.bytes), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`, "Cache-Control": "private, no-store" } });
  } catch (error) { return studioError(error, "终稿导出失败，请稍后重试"); }
}
