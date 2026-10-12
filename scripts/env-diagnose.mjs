import { readFileSync } from "node:fs";
import { parse } from "dotenv";

const raw = readFileSync(".env", "utf8");
const env = parse(raw);
console.log(`AUTH_SECRET 字符数：${env.AUTH_SECRET?.length ?? 0}`);
console.log(`AUTH_SECRET 重复定义：${(raw.match(/^\s*AUTH_SECRET\s*=/gm) || []).length > 1}`);
console.log(`DATABASE_URL 使用 PostgreSQL 协议：${/^postgres(?:ql)?:\/\//.test(env.DATABASE_URL || "")}`);
console.log(`DATABASE_URL 包含未替换的中文提示：${/[\u4e00-\u9fff]/.test(env.DATABASE_URL || "")}`);
console.log(`DATABASE_URL 重复定义：${(raw.match(/^\s*DATABASE_URL\s*=/gm) || []).length > 1}`);
console.log(`DATABASE_URL 包含空格：${/\s/.test(env.DATABASE_URL || "")}`);
console.log(`DATABASE_URL 包含占位符：${/[<>＜＞]/.test(env.DATABASE_URL || "")}`);
try {
  const url = new URL(env.DATABASE_URL);
  console.log("DATABASE_URL 地址可解析：true");
  console.log(`DATABASE_URL 主机为本机：${["localhost", "127.0.0.1"].includes(url.hostname)}`);
  console.log(`DATABASE_URL 包含片段标记：${Boolean(url.hash)}`);
  try { console.log(`DATABASE_URL 密码与 POSTGRES_PASSWORD 相同：${decodeURIComponent(url.password) === env.POSTGRES_PASSWORD}`); }
  catch { console.log("DATABASE_URL 密码包含无效的百分号编码：true"); }
} catch { console.log("DATABASE_URL 地址可解析：false"); }
