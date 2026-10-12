import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { readObject, inspectPhoto } from "@/lib/storage";
import { KieError, kieRequest, safeKieMessage } from "@/lib/kie-http";
import type { ImageInput, ImageProvider, ImageResult } from "@/lib/image-provider";

export class KieProvider implements ImageProvider {
  private baseUrl = process.env.KIE_BASE_URL?.trim() || "https://api.kie.ai";
  private uploadBaseUrl = process.env.KIE_UPLOAD_BASE_URL?.trim() || "https://kieai.redpandaai.co";

  async uploadFile(assetId: string) {
    const key = process.env.KIE_API_KEY?.trim();
    if (!key) throw new KieError("尚未配置 KIE_API_KEY，请联系管理员", 401);
    const asset = await db.asset.findUniqueOrThrow({ where: { id: assetId } });
    const { bytes } = await readObject(asset.storageKey);
    const photo = await inspectPhoto(bytes);
    const contentHash = createHash("sha256").update(bytes).digest("hex");
    const account = createHash("sha256").update(key + this.uploadBaseUrl).digest("hex");
    const id = `${account}:${contentHash}`;
    // 事务级锁避免多个 worker 同时上传同一个文件，跨进程缓存持久化到 Postgres。
    return db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;
      const cached = await tx.kieUpload.findUnique({ where: { id } });
      if (cached && cached.expiresAt.getTime() > Date.now()) return cached.url;
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(bytes)], { type: photo.mime }), `${contentHash}.${photo.extension}`);
      form.append("uploadPath", "furniture-ai-studio/references");
      form.append("fileName", `${contentHash}.${photo.extension}`);
      const response = await kieRequest(`${this.uploadBaseUrl}/api/file-stream-upload`, { method: "POST", body: form });
      if (response.success !== true || typeof response.data?.downloadUrl !== "string") throw new KieError("KIE 参考图上传失败：未返回可用文件地址");
      const url = response.data.downloadUrl as string;
      if (!/^https:\/\//.test(url)) throw new KieError("KIE 参考图上传返回了不安全的地址");
      await tx.kieUpload.upsert({ where: { id }, create: { id, url, expiresAt: new Date(Date.now() + 23 * 3600000) }, update: { url, expiresAt: new Date(Date.now() + 23 * 3600000) } });
      return url;
    }, { timeout: 180000, maxWait: 180000 });
  }

  async submit(model: string, input: ImageInput) {
    const callBackUrl = process.env.KIE_CALLBACK_URL?.trim();
    const response = await kieRequest(`${this.baseUrl}/api/v1/jobs/createTask`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input, ...(callBackUrl ? { callBackUrl } : {}) }),
    });
    if (typeof response.data?.taskId !== "string" || !response.data.taskId) throw new KieError("KIE 未返回任务编号，请检查账户任务记录后再试");
    return response.data.taskId as string;
  }

  async getResult(taskId: string): Promise<ImageResult> {
    const response = await kieRequest(`${this.baseUrl}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, { method: "GET" });
    const data = response.data;
    if (["waiting", "queuing", "generating"].includes(data?.state)) return { status: "pending" };
    if (data?.state === "fail") return { status: "failed", error: `KIE 生图失败${data.failCode ? `（${safeKieMessage(data.failCode)}）` : ""}：${safeKieMessage(data.failMsg)}` };
    if (data?.state === "success") {
      let result;
      try { result = JSON.parse(data.resultJson); } catch { throw new KieError("KIE 结果数据无法解析，未获得图片地址"); }
      if (!Array.isArray(result.resultUrls) || !result.resultUrls.length || result.resultUrls.some((url: unknown) => typeof url !== "string" || !url.startsWith("https://"))) throw new KieError("KIE 已完成任务但未返回有效图片地址");
      return { status: "success", urls: result.resultUrls };
    }
    throw new KieError("KIE 返回了未知任务状态，请检查账户任务记录");
  }
}
