import "server-only";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { StudioError } from "@/lib/studio-error";
export { StudioError } from "@/lib/studio-error";

export async function studioUser(request: Request, write = false) {
  const session = await auth();
  if (!session?.user) throw new StudioError("请先登录", 401);
  if (write && session.user.role === "viewer") throw new StudioError("只读成员不能修改商品或生成图片", 403);
  if (write && request.headers.get("origin") !== new URL(request.url).origin) throw new StudioError("请求来源不被允许", 403);
  return session.user;
}
export function studioError(error: unknown, fallback: string) {
  return NextResponse.json({ error: error instanceof StudioError ? error.message : fallback }, { status: error instanceof StudioError ? error.status : 500 });
}
