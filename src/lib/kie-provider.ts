import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { readObject, inspectPhoto } from "@/lib/storage";
import { KieError, kieRequest, kieFailure, ReferenceImageFailure, referenceImageUnavailable } from "@/lib/kie-http";
import { models } from "./models.config";
import { kieCreditCost } from "./gateway-cost";
import type { ImageInput, ImageProvider, ImageResult, ImageRequest, ImageGeneration } from "@/lib/image-provider";
import { ImageTaskFailure } from "@/lib/gateway-error";
import { downloadResultImage } from "@/lib/remote-image";

export class KieProvider implements ImageProvider {
  constructor(private model = models["scene-main"].find(c => c.provider === "kie")!.model, private download: (url: string) => Promise<Buffer> = downloadResultImage) {}
  isConfigured() { return Boolean(process.env.KIE_API_KEY?.trim()); }
  async generate(input: ImageRequest): Promise<ImageGeneration> {
    const urls: string[] = [];
    for (const asset of input.referenceImages) urls.push(await this.uploadFile(asset.id, input.forceReferenceUpload));
    const requestInput: ImageInput = { prompt: input.prompt, image_input: urls, aspect_ratio: input.aspectRatio, resolution: input.resolution, output_format: input.outputFormat };
    const taskId = await this.submit(this.model, requestInput);
    return { kind: "pending", taskId, requestInput };
  }
  async poll(taskId: string): Promise<ImageGeneration> {
    const result = await this.getResult(taskId);
    if (result.status === "pending") return { kind: "pending", taskId };
    if (result.status === "failed") { if (result.referenceUnavailable) throw new ReferenceImageFailure(result.error, result.cost); const status = result.code && result.code >= 400 && result.code <= 599 ? result.code : 500; const error = new ImageTaskFailure("kie", result.error, status, status === 429 || status >= 500); Object.assign(error, { cost: result.cost }); throw error; }
    return { kind: "done", images: await Promise.all(result.urls.map((url) => this.download(url))), cost: result.cost };
  }
  private baseUrl = process.env.KIE_BASE_URL?.trim() || "https://api.kie.ai";
  private uploadBaseUrl = process.env.KIE_UPLOAD_BASE_URL?.trim() || "https://kieai.redpandaai.co";

  async uploadFile(assetId: string, force = false) {
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
      if (!force && cached && cached.expiresAt.getTime() > Date.now() && Date.now() - cached.uploadedAt.getTime() < 23 * 3600000) return cached.url;
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(bytes)], { type: photo.mime }), `${contentHash}.${photo.extension}`);
      form.append("uploadPath", "furniture-ai-studio/references");
      form.append("fileName", `${contentHash}.${photo.extension}`);
      const response = await kieRequest(`${this.uploadBaseUrl}/api/file-stream-upload`, { method: "POST", body: form });
      if (response.success !== true || typeof response.data?.downloadUrl !== "string") throw new KieError("KIE 参考图上传失败：未返回可用文件地址");
      const url = response.data.downloadUrl as string;
      if (!/^https:\/\//.test(url)) throw new KieError("KIE 参考图上传返回了不安全的地址");
      const uploadedAt = new Date(), expiresAt = new Date(uploadedAt.getTime() + 23 * 3600000);
      await tx.kieUpload.upsert({ where: { id }, create: { id, url, uploadedAt, expiresAt }, update: { url, uploadedAt, expiresAt } });
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
    if (data?.state === "fail") { const failure = kieFailureForTask(data.failCode, data.failMsg); return { status: "failed", code: failure.status, referenceUnavailable: referenceImageUnavailable(data.failMsg), error: failure.message, cost: kieCreditCost(data.creditsConsumed) }; }
    if (data?.state === "success") {
      let result;
      try { result = JSON.parse(data.resultJson); } catch { throw new KieError("KIE 结果数据无法解析，未获得图片地址"); }
      if (!Array.isArray(result.resultUrls) || !result.resultUrls.length || result.resultUrls.some((url: unknown) => typeof url !== "string" || !url.startsWith("https://"))) throw new KieError("KIE 已完成任务但未返回有效图片地址");
      return { status: "success", urls: result.resultUrls, cost: kieCreditCost(data.creditsConsumed) };
    }
    throw new KieError("KIE 返回了未知任务状态，请检查账户任务记录");
  }
}
function kieFailureForTask(code: unknown, msg: unknown) {
  return kieFailure(Number(code) || 500, msg);
}
