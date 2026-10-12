import "dotenv/config";
import { z } from "zod";

const required = ["POSTGRES_PASSWORD", "DATABASE_URL", "AUTH_SECRET", "ADMIN_EMAIL", "ADMIN_PASSWORD", "MINIO_ROOT_USER", "MINIO_ROOT_PASSWORD", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) {
  console.log(`仍需填写：${missing.join("、")}`);
  process.exitCode = 1;
} else {
  const issues = [];
  if (!z.string().trim().toLowerCase().email().safeParse(process.env.ADMIN_EMAIL).success) issues.push("ADMIN_EMAIL 必须是有效邮箱地址");
  if (process.env.AUTH_SECRET.length < 32) issues.push("AUTH_SECRET 长度不足");
  if (process.env.ADMIN_PASSWORD.length < 12 || Buffer.byteLength(process.env.ADMIN_PASSWORD, "utf8") > 72) issues.push("ADMIN_PASSWORD 长度不符合要求");
  if (process.env.MINIO_ROOT_PASSWORD.length < 8) issues.push("MINIO_ROOT_PASSWORD 长度不足");
  if (process.env.S3_ACCESS_KEY_ID !== process.env.MINIO_ROOT_USER || process.env.S3_SECRET_ACCESS_KEY !== process.env.MINIO_ROOT_PASSWORD) issues.push("本地 S3 凭据需与 MinIO 账户一致");
  try {
    const url = new URL(process.env.DATABASE_URL);
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) issues.push("本地验收要求数据库位于 localhost");
    if (decodeURIComponent(url.password) !== process.env.POSTGRES_PASSWORD) issues.push("DATABASE_URL 密码与 POSTGRES_PASSWORD 不一致");
  } catch { issues.push("DATABASE_URL 格式不正确"); }
  if (issues.length) { console.log(issues.join("；")); process.exitCode = 1; }
  else console.log("本地 .env 必填项已配置，未输出任何密码或密钥");
}
