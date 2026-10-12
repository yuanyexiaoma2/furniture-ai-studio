import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

const filename = fileURLToPath(new URL("../.env", import.meta.url));
let source = readFileSync(filename, "utf8");
const env = parse(source);
if (!env.POSTGRES_PASSWORD) {
  console.error("请先在 .env 填写 POSTGRES_PASSWORD，本脚本不会选择你的数据库密码");
  process.exitCode = 1;
} else {
  const username = encodeURIComponent(env.POSTGRES_USER || "furniture");
  const database = encodeURIComponent(env.POSTGRES_DB || "furniture_ai_studio");
  const databaseUrl = `postgresql://${username}:${encodeURIComponent(env.POSTGRES_PASSWORD)}@localhost:5432/${database}`;
  const databaseOnly = process.argv.includes("--database-only");
  const updates = databaseOnly ? { DATABASE_URL: databaseUrl } : { AUTH_SECRET: randomBytes(32).toString("base64url"), DATABASE_URL: databaseUrl };
  for (const [key, value] of Object.entries(updates)) {
    const pattern = new RegExp(`^\\s*${key}\\s*=.*$`, "gm");
    let replaced = false;
    source = source.replace(pattern, () => {
      if (replaced) return "";
      replaced = true;
      return `${key}=${value}`;
    });
    if (!replaced) source += `\n${key}=${value}\n`;
  }
  writeFileSync(filename, source, "utf8");
  console.log(`仅更新本地 .env 的 ${Object.keys(updates).join(" 和 ")}，其余已填写内容保留；未输出任何密钥或密码`);
}
