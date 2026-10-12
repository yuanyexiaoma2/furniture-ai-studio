import "dotenv/config";
import { S3Client, HeadBucketCommand, GetBucketPolicyCommand } from "@aws-sdk/client-s3";
import pg from "pg";

const s3 = new S3Client({ endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION || "us-east-1", forcePathStyle: true,
  credentials: { accessKeyId: process.env.MINIO_ROOT_USER || "", secretAccessKey: process.env.MINIO_ROOT_PASSWORD || "" } });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
try {
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { await pool.query("SELECT 1"); await s3.send(new HeadBucketCommand({ Bucket: "assets" })); ready = true; break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 2000)); }
  }
  if (!ready) throw new Error("基础服务未就绪");
  try { await s3.send(new GetBucketPolicyCommand({ Bucket: "assets" })); throw new Error("assets bucket 存在策略，需检查匿名访问配置"); }
  catch (error) { if (error.name !== "NoSuchBucketPolicy") throw error; }
  console.log("PostgreSQL 已就绪；MinIO assets bucket 已创建且未设置匿名访问策略");
} catch { console.error("基础服务检查失败，请检查 Docker 状态和本地 .env 配置"); process.exitCode = 1; }
finally { await pool.end(); s3.destroy(); }
