import { NextResponse } from "next/server";
import { z } from "zod";
import { studioUser, studioError, StudioError } from "@/lib/studio-api";
import { db } from "@/lib/db";
import { agentSession, agentSnapshot, json } from "@/lib/agent-state";
import {canvasSelectionSchema} from "@/lib/canvas-rules";
import { runAgentTurn } from "@/lib/planning-agent";
import { approveAgentCard } from "@/lib/agent-actions";
export const runtime = "nodejs";
export const maxDuration = 300;
const messageSchema = z.object({ text: z.string().trim().min(1).max(20000), requestKey: z.string().uuid(), referenceAssetId: z.string().optional(),canvas:canvasSelectionSchema.optional() });
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await studioUser(request); return NextResponse.json(await agentSnapshot((await context.params).id, user.id)); } catch (error) { return studioError(error, "读取 Agent 会话失败"); }
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await studioUser(request, true), { id } = await context.params;
    const parsed = messageSchema.safeParse(await request.json()); if (!parsed.success) throw new StudioError("消息内容无效");
    const encoder = new TextEncoder();
    const stream = new ReadableStream({ start(controller) {
      const emit = (event: unknown) => { try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); } catch {} };
      void runAgentTurn(id, user.id, parsed.data.text, parsed.data.requestKey, emit, parsed.data.referenceAssetId,undefined,parsed.data.canvas).catch(error => emit({ type: "error", text: error instanceof Error ? error.message : "请求失败" })).finally(() => { try { controller.close(); } catch {} });
    } });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
  } catch (error) { return studioError(error, "Agent 请求失败"); }
}
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await studioUser(request, true), productId = (await context.params).id, session = await agentSession(productId, user.id), body = await request.json();
    if (body.action === "settings") {
      const data = z.object({ mode: z.enum(["quick", "manual"]).optional(), autoConfirm: z.boolean().optional() }).strict().parse(body.settings);
      await db.agentSession.update({ where: { id: session.id }, data });
      await db.chatMessage.create({ data: { productId, sessionId: session.id, role: "system", content: json({ text: `美工更新生成方式或自动确认：${JSON.stringify(data)}` }) } });
    } else if (body.action === "approve") {
      const parsed = z.object({ cardId: z.string(), changes: z.record(z.string(), z.unknown()).optional() }).parse(body);
      await approveAgentCard(session.id, parsed.cardId, parsed.changes ?? {});
    } else if (body.action === "cancel") {
      const cardId = z.string().parse(body.cardId);
      const updated = await db.agentCard.updateMany({ where: { id: cardId, sessionId: session.id, status: "pending" }, data: { status: "cancelled" } });
      if (!updated.count) throw new StudioError("卡片不存在或已执行", 409);
      await db.chatMessage.create({ data: { productId, sessionId: session.id, role: "system", content: { text: `美工取消确认卡 ${cardId}；不可执行这项操作。` } } });
    } else throw new StudioError("不支持的会话操作");
    return NextResponse.json(await agentSnapshot(productId, user.id));
  } catch (error) { return studioError(error, "保存或确认失败，请刷新核对"); }
}
