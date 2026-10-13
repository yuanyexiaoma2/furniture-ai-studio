import { NextResponse } from "next/server";
import { editSchema } from "@/lib/product-validation";
import { createEditJob } from "@/lib/scene-generation";
import { StudioError, studioUser, studioError } from "@/lib/studio-api";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await studioUser(request, true);
    const parsed = editSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new StudioError(parsed.error.issues[0]?.message || "编辑参数无效");
    const { editIntent, aspectRatio, resolution, sourceJobId, sourceAssetId } = parsed.data;
    const jobId = await createEditJob(user.id, (await context.params).id, editIntent, aspectRatio, resolution, { sourceJobId, sourceAssetId });
    return NextResponse.json({ jobId }, { status: 202 });
  } catch (error) { return studioError(error, "编辑任务创建失败，请稍后重试"); }
}
