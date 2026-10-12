import "server-only";
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

export const MAX_PHOTO_BYTES = 30 * 1024 * 1024;
const formats = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;
let client: S3Client;

function storage() {
  if (!process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) throw new Error("文件存储未配置，请联系管理员");
  return client ??= new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "us-east-1",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
    requestHandler: { requestTimeout: 30000, connectionTimeout: 5000 },
  });
}

function bucket() {
  if (process.env.S3_BUCKET && process.env.S3_BUCKET !== "assets") throw new Error("本项目文件 bucket 必须为 assets");
  return "assets";
}

export async function inspectPhoto(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) throw new Error("图片不能为空，单张大小不能超过 30MB");
  try {
    const meta = await sharp(bytes, { limitInputPixels: 100_000_000 }).metadata();
    if (!meta.format || !(meta.format in formats) || !meta.width || !meta.height || (meta.pages ?? 1) > 1) throw new Error();
    // 完整解码防止只有头部合法的损坏图片进入生图任务。
    await sharp(bytes, { limitInputPixels: 100_000_000 }).stats();
    return { width: meta.width, height: meta.height, mime: formats[meta.format as keyof typeof formats], extension: meta.format === "jpeg" ? "jpg" : meta.format };
  } catch { throw new Error("请上传有效的静态 JPEG、PNG 或 WEBP 图片"); }
}

export async function putObject(key: string, bytes: Buffer, mime: string) {
  await storage().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: bytes, ContentType: mime }));
}
export async function readObject(key: string) {
  const object = await storage().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!object.Body) throw new Error("未找到参考图文件");
  return { bytes: Buffer.from(await object.Body.transformToByteArray()), mime: object.ContentType || "application/octet-stream" };
}
export async function deleteObject(key: string) {
  await storage().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
