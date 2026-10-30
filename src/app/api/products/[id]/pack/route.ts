import { NextResponse } from "next/server";
import { studioUser, studioError, StudioError } from "@/lib/studio-api";
import { packSnapshot, mutatePack, quoteBatch, submitImmediateBatch } from "@/lib/image-packs";
import { agentSession, recordBoardEvent } from "@/lib/agent-state";
import { z } from "zod";
export const runtime = "nodejs";
const selectionSchema = z.object({ slotId: z.string().optional(), retryJobId: z.string().optional() });
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try { await studioUser(request); return NextResponse.json(await packSnapshot((await context.params).id)); }
  catch (error) { return studioError(error, "读取图包失败"); }
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await studioUser(request, true), { id } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body.action !== "string") throw new StudioError("图包操作参数无效");
    if (body.action === "quote" || body.action === "generate") {
      const selection = selectionSchema.safeParse(body.selection ?? {});
      if (!selection.success) throw new StudioError("生成范围参数无效");
      if (body.action === "quote") return NextResponse.json(await quoteBatch(user.id, id, selection.data));
      if (!z.string().uuid().safeParse(body.requestKey).success) throw new StudioError("提交编号无效，请重试");
      const {batchId,estimatedCostUsd}=await submitImmediateBatch(user.id,id,selection.data,body.requestKey,(await agentSession(id,user.id)).id);
      await recordBoardEvent(id, user.id, { action: "generate", selection: selection.data, batchId });
      return NextResponse.json({ batchId,estimatedCostUsd }, { status: 202 });
    }
    await mutatePack(id, body);
    await recordBoardEvent(id, user.id, body);
    return NextResponse.json({ ok: true });
  } catch (error) { return studioError(error, "图包操作失败，请刷新后重试"); }
}
