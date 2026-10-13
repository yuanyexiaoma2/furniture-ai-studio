import "dotenv/config";
import bcrypt from "bcrypt";
import { ZodError } from "zod";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { emailSchema, passwordSchema } from "../src/lib/validation";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("请填写 DATABASE_URL");
  const email = emailSchema.parse(process.env.ADMIN_EMAIL);
  const password = passwordSchema.parse(process.env.ADMIN_PASSWORD);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const existing = await db.user.findUnique({ where: { email }, select: { role: true } });
    if (existing) {
      if (existing.role !== "admin") throw new Error("该邮箱已有非管理员账号，请更换 ADMIN_EMAIL，种子不会提升现有账号权限");
      console.log("管理员已存在，未改动密码与用户配置");
      return;
    }
    await db.user.create({ data: {
      name: process.env.ADMIN_NAME?.trim() || "管理员",
      email, passwordHash: await bcrypt.hash(password, 12), role: "admin", monthlyQuota: 0.5,
    } });
    console.log("管理员创建成功，密码已使用 bcrypt 哈希保存");
  } finally { await db.$disconnect(); }
}

main().catch((error) => {
  if (error instanceof ZodError) console.error("管理员配置校验失败：请填写有效 ADMIN_EMAIL，并确保 ADMIN_PASSWORD 至少 12 个字符、最多 72 字节");
  else if (error instanceof Prisma.PrismaClientKnownRequestError) console.error(`数据库写入失败，Prisma 错误码：${error.code}`);
  else console.error(`种子执行失败，错误类型：${error instanceof Error ? error.name : "未知"}；请检查数据库连通性与管理员邮箱是否被普通用户占用`);
  process.exitCode = 1;
});
