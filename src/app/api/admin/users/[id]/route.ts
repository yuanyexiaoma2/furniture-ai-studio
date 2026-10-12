import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { updateUserSchema } from "@/lib/validation";
import { Prisma } from "@/generated/prisma/client";

class UserError extends Error { constructor(message: string, public status: number) { super(message); } }

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "仅管理员可以操作" }, { status: 403 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "请求来源不被允许" }, { status: 403 });
  const parsed = updateUserSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "表单无效" }, { status: 400 });
  const { id } = await params;
  const action = parsed.data;
  try {
    const passwordHash = action.action === "password" ? await bcrypt.hash(action.password, 12) : undefined;
    const user = await db.$transaction(async (tx) => {
      const actor = await tx.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
      if (actor?.role !== "admin") throw new UserError("管理员权限已变更，请重新登录", 403);
      const target = await tx.user.findUnique({ where: { id }, select: { role: true } });
      if (!target) throw new UserError("用户不存在", 404);
      if (action.action === "role" && action.role !== "admin") {
        if (id === session.user.id) throw new UserError("不能降低自己的管理员权限", 400);
        if (target.role === "admin" && await tx.user.count({ where: { role: "admin" } }) <= 1) throw new UserError("至少保留一名管理员", 400);
      }
      return tx.user.update({ where: { id }, data: { ...(action.action === "role" ? { role: action.role } : { passwordHash }), authVersion: { increment: 1 } }, select: { id: true, name: true, email: true, role: true, department: true, monthlyQuota: true } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof UserError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "其他管理员同时修改了数据，请重试" }, { status: 409 });
    return NextResponse.json({ error: "修改失败，请稍后重试" }, { status: 500 });
  }
}
