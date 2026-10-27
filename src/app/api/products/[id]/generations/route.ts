import { NextResponse } from "next/server";
import { sceneSchema } from "@/lib/product-validation";
import { generationAvailability } from "@/lib/scene-generation";
import {proposeVisualPlan} from "@/lib/visual-planning";
import {db} from "@/lib/db";
import {agentSession,json} from "@/lib/agent-state";
import { productSnapshot } from "@/lib/product-data";
import { StudioError, studioUser, studioError } from "@/lib/studio-api";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await studioUser(request, true);
    const parsed = sceneSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new StudioError(parsed.error.issues[0]?.message || "场景参数无效");
    const { id } = await context.params;
    const session=await agentSession(id,user.id);
    await db.agentSession.update({where:{id:session.id},data:{settings:json({...session.settings as object,resolution:parsed.data.resolution})}});
    const plan = await proposeVisualPlan(id,user.id,{singleIntent:parsed.data.sceneIntent,aspectRatio:parsed.data.aspectRatio});
    // 返回提交编号即可；避免入队成功后的读取失败使客户端误以为需要重发。
    return NextResponse.json({cardId:plan.cardId,workspaceUrl:"/workspace?sku="+id,waitForUser:true}, { status: 202 });
  } catch (error) { return studioError(error, "生成任务创建失败，请稍后重试"); }
}
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await studioUser(request);
    const product = await productSnapshot((await context.params).id);
    if (!product) throw new StudioError("商品不存在", 404);
    return NextResponse.json({ product, availability: await generationAvailability(user.id) });
  } catch (error) { return studioError(error, "读取生成记录失败，请稍后重试"); }
}
