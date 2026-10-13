import "server-only";
import { GoogleGenAI, type GenerateContentParameters } from "@google/genai";
import { assetBytes } from "@/lib/asset-bytes";
import { GatewayError, gatewayException } from "@/lib/gateway-error";
import type { ImageProvider, ImageRequest, ImageGeneration } from "@/lib/image-provider";

type Client = { models: { generateContent: (input: GenerateContentParameters) => Promise<unknown> } };
type Part = { inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string } };
type Reply = { promptFeedback?: { blockReason?: string }; candidates?: { finishReason?: string; safetyRatings?: { blocked?: boolean }[]; content?: { parts?: Part[] } }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } };

export class ZenMuxImageProvider implements ImageProvider {
  constructor(private model = "google/gemini-nano-banana-2.1", private injected?: Client, private read = assetBytes) {}
  isConfigured() { return Boolean(process.env.ZENMUX_API_KEY?.trim()); }
  async generate(input: ImageRequest): Promise<ImageGeneration> {
    if (!this.isConfigured()) throw new GatewayError("zenmux", "未配置 ZENMUX_API_KEY", 503, false);
    try {
      const references = await Promise.all(input.referenceImages.map(async ({ id }) => {
        const { bytes, mime } = await this.read(id);
        return { inlineData: { mimeType: mime, data: bytes.toString("base64") } };
      }));
      const client = this.injected ?? new GoogleGenAI({ apiKey: process.env.ZENMUX_API_KEY!.trim(), vertexai: true, httpOptions: { baseUrl: process.env.ZENMUX_VERTEX_BASE_URL?.trim() || "https://zenmux.ai/api/vertex-ai", apiVersion: "v1", timeout: 30000 } });
      const response = await client.models.generateContent({ model: this.model, contents: [{ role: "user", parts: [{ text: input.prompt }, ...references] }], config: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { ...(input.aspectRatio !== "auto" ? { aspectRatio: input.aspectRatio } : {}), imageSize: input.resolution, outputMimeType: input.outputFormat === "jpg" ? "image/jpeg" : "image/png" } } }) as Reply;
      if (response.promptFeedback?.blockReason || response.candidates?.some((candidate) => /SAFETY|BLOCKLIST|PROHIBITED_CONTENT/.test(candidate.finishReason ?? "") || candidate.safetyRatings?.some((rating) => rating.blocked))) throw new GatewayError("zenmux", "内容被安全策略拦截", 500, true);
      const images: Buffer[] = [];
      for (const candidate of response.candidates ?? []) for (const part of candidate.content?.parts ?? []) {
        const inline = part.inlineData ?? part.inline_data;
        if (inline?.data) {
          if (inline.data.length > 42 * 1024 * 1024 || !/^[A-Za-z0-9+/\r\n]*={0,2}$/.test(inline.data)) throw new GatewayError("zenmux", "返回图片数据无效或超过大小限制", 500, true);
          const bytes = Buffer.from(inline.data, "base64"); if (bytes.length) images.push(bytes);
        }
      }
      if (!images.length) throw new GatewayError("zenmux", "返回内容中没有图片", 500, true);
      const usage = response.usageMetadata;
      return { kind: "done", images, ...(usage ? { usage: { inputTokens: usage.promptTokenCount ?? 0, outputTokens: usage.candidatesTokenCount ?? 0, totalTokens: usage.totalTokenCount ?? 0 } } : {}) };
    } catch (error) { throw gatewayException("zenmux", error); }
  }
}
