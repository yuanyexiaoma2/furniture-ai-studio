import "server-only";
import {ZodError} from "zod";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { StudioError } from "@/lib/studio-error";
import { GatewayError } from "./gateway-error";
import {db} from "./db";
import {assertProductActive} from "./product-deletion";
import {StudioRequestError} from "./studio-requests";
export { StudioError } from "@/lib/studio-error";

export async function studioUser(request: Request, write = false, allowDeleted = false) {
  const session = await auth();
  if (!session?.user) throw new StudioError("请先登录", 401);
  if (write && session.user.role === "viewer") throw new StudioError("只读成员不能修改商品或生成图片", 403);
  if (write && request.headers.get("origin") !== new URL(request.url).origin) throw new StudioError("请求来源不被允许", 403);
  if(!allowDeleted){
    const match=/^\/api\/(products|studio)\/([^/]+)/.exec(new URL(request.url).pathname);
    if(match&&(match[1]==="products"||!["models","library","saved-references","direct"].includes(match[2])))await assertProductActive(db,match[2]);
  }
  return session.user;
}
export function studioError(error: unknown, fallback: string) {
  if(error instanceof StudioRequestError)return NextResponse.json({error:error.message,requestState:error.requestState},{status:error.status});
  if(error instanceof ZodError)return NextResponse.json({error:"提交的选项或资料格式不正确，请刷新后重新选择；原有数据已保留"},{status:400});
  return NextResponse.json({ error: error instanceof StudioError || error instanceof GatewayError ? error.message : fallback }, { status: error instanceof StudioError || error instanceof GatewayError ? Math.min(599, Math.max(400, error.status)) : 500 });
}
