import { NextResponse } from "next/server";
import { studioUser, studioError } from "@/lib/studio-api";
import { analyzeProductIdentity } from "@/lib/identity-analysis";
export const maxDuration = 60;
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await studioUser(request, true); return NextResponse.json(await analyzeProductIdentity(user.id, (await context.params).id)); }
  catch (error) { return studioError(error, "AI 提炼失败，请稍后重试；原有身份特征已保留"); }
}
