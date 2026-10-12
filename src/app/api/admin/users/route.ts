import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createUserSchema } from "@/lib/validation";
import { Prisma } from "@/generated/prisma/client";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "仅管理员可以操作" }, { status: 403 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "请求来源不被允许" }, { status: 403 });
  const parsed = createUserSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "表单无效" }, { status: 400 });
  try {
    const { password, ...data } = parsed.data;
    const user = await db.user.create({ data: { ...data, department: data.department || null, passwordHash: await bcrypt.hash(password, 12) }, select: { id: true, name: true, email: true, role: true, department: true, monthlyQuota: true } });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "该邮箱已存在" }, { status: 409 });
    return NextResponse.json({ error: "新增失败，请稍后重试" }, { status: 500 });
  }
}
