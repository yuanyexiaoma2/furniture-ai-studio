import { NextResponse } from "next/server";
import { removeProductPhoto } from "@/lib/product-photos";
import { studioUser, studioError } from "@/lib/studio-api";

export async function DELETE(request: Request, context: { params: Promise<{ id: string; assetId: string }> }) {
  try {
    await studioUser(request, true);
    const { id, assetId } = await context.params;
    await removeProductPhoto(id, assetId);
    return NextResponse.json({ message: "实拍图已删除，历史任务不受影响" });
  } catch (error) { return studioError(error, "删除实拍图失败，请刷新后重试"); }
}
