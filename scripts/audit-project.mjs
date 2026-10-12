import "dotenv/config";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import pg from "pg";

const gitFiles = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
if (gitFiles.some((file) => /(^|\/)\.env(?:$|\.)/.test(file) && file !== ".env.example")) throw new Error("真实环境文件被列入待提交文件");
const secrets = ["AUTH_SECRET", "ADMIN_PASSWORD", "POSTGRES_PASSWORD", "MINIO_ROOT_PASSWORD", "S3_SECRET_ACCESS_KEY", "ZENMUX_API_KEY", "KIE_API_KEY"].map((key) => process.env[key]).filter((value) => value && value.length >= 8);
for (const file of gitFiles) {
  if (secrets.some((value) => readFileSync(file).includes(Buffer.from(value)))) throw new Error(`文件包含本地密钥，请移除：${file}`);
}
console.log("提交候选文件中仅有 .env.example，未检出本地密码或密钥");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
try {
  const users = await pool.query('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE role = \'admin\')::int AS admins, COUNT(*) FILTER (WHERE email LIKE \'e2e-%@example.invalid\')::int AS temporary FROM "User"');
  if (!users.rows[0].admins || users.rows[0].temporary !== 0) throw new Error("管理员或临时账号清理检查失败");
  const tables = await pool.query("SELECT COUNT(*)::int AS total FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)", [["User", "Product", "Asset", "ImagePack", "ImageSlot", "Template", "GenerationJob", "ChatMessage"]]);
  if (tables.rows[0].total !== 8) throw new Error("业务模型迁移未完成");
  console.log("八个业务模型迁移完成；管理员保留，验收临时账号已清理");
} finally { await pool.end(); }
