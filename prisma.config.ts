import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  // 生成类型不需要连接数据库；迁移与运行仍然要求填写 DATABASE_URL。
  datasource: { url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/furniture_ai_studio" },
});
