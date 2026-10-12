import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
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
      email, passwordHash: await bcrypt.hash(password, 12), role: "admin", monthlyQuota: 100,
    } });
    console.log("管理员创建成功，密码已使用 bcrypt 哈希保存");
  } finally { await db.$disconnect(); }
}

main().catch(() => { console.error("种子执行失败：请核对数据库、ADMIN_EMAIL 与 ADMIN_PASSWORD（至少 12 个字符且最多 72 字节），并确认邮箱没有被非管理员占用"); process.exitCode = 1; });
