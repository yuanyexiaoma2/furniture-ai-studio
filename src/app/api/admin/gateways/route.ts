import { NextResponse } from "next/server";
import { studioUser, studioError, StudioError } from "@/lib/studio-api";
import { gatewayStatus } from "@/lib/gateway-status";
export async function GET(request: Request) {
  try { const user = await studioUser(request); if (user.role !== "admin") throw new StudioError("只有管理员可以查看网关状态", 403); return NextResponse.json(await gatewayStatus()); }
  catch (error) { return studioError(error, "读取网关状态失败，请稍后刷新"); }
}
