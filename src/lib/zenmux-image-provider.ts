import "server-only";
import {imageReferenceLimit} from "./generation-references";
import {zenmuxImageModels} from "./image-models";
import { GoogleGenAI,RawReferenceImage,type EditImageParameters,type GenerateContentParameters } from "@google/genai";
import { assetBytes } from "@/lib/asset-bytes";
import { GatewayError, gatewayException } from "@/lib/gateway-error";
import type { ImageProvider, ImageRequest, ImageGeneration } from "@/lib/image-provider";
import { models, IMAGE_TEXT_OUTPUT_BUDGET } from "./models.config";
import { imageUsageUsd } from "./gateway-cost";

type Client = { models: { generateContent: (input: GenerateContentParameters) => Promise<unknown>;editImage?:(input:EditImageParameters)=>Promise<unknown> } };
type Part = { inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string } };
type Reply = { responseId?: string; response_id?: string; promptFeedback?: { blockReason?: string }; candidates?: { finishReason?: string; safetyRatings?: { blocked?: boolean }[]; content?: { parts?: Part[] } }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } };

export class ZenMuxImageProvider implements ImageProvider {
  constructor(private model = models["scene-main"].find(c => c.provider === "zenmux")!.model, private injected?: Client, private read = assetBytes) {}
  isConfigured() { return Boolean(process.env.ZENMUX_API_KEY?.trim()); }
  async generate(input: ImageRequest): Promise<ImageGeneration> {
    if (!this.isConfigured()) throw new GatewayError("zenmux", "未配置 ZENMUX_API_KEY", 503, false);
    if(input.referenceImages.length>imageReferenceLimit({provider:"zenmux",model:this.model}))throw new GatewayError("zenmux","图片数量超过当前模型输入上限，未提交也不会改成文字参考",400,false);
    let reply: Reply | undefined;
    try {
      const registered=zenmuxImageModels.find(m=>m.candidate.model===this.model);
      if(registered?.candidate.imageProtocol==="vertex-edit"){
        const client=this.injected??new GoogleGenAI({apiKey:process.env.ZENMUX_API_KEY!.trim(),vertexai:true,httpOptions:{baseUrl:process.env.ZENMUX_VERTEX_BASE_URL?.trim()||"https://zenmux.ai/api/vertex-ai",apiVersion:"v1",timeout:90000,retryOptions:{attempts:1}}});
        if(!client.models.editImage)throw new GatewayError("zenmux","当前客户端未提供官方editImage协议",400,false);
        const referenceImages=await Promise.all(input.referenceImages.map(async({id},index)=>{const file=await this.read(id);return Object.assign(new RawReferenceImage(),{referenceId:index+1,referenceImage:{imageBytes:file.bytes.toString("base64"),mimeType:file.mime}});}));
        const response=await client.models.editImage({model:this.model,prompt:input.prompt,referenceImages,config:{numberOfImages:1,outputMimeType:input.outputFormat==="jpg"?"image/jpeg":"image/png",...(input.aspectRatio!=="auto"?{aspectRatio:input.aspectRatio}:{}),httpOptions:{extraBody:{imageSize:zenmuxImageSize(input.resolution,input.aspectRatio),resolution:input.resolution}}}}) as {generatedImages?:{image?:{imageBytes?:string};raiFilteredReason?:string}[];sdkHttpResponse?:{headers?:Record<string,string>}};
        if(response.generatedImages?.some(i=>i.raiFilteredReason))throw new GatewayError("zenmux","内容被安全策略拦截",422,false);
        const images=response.generatedImages?.flatMap(i=>i.image?.imageBytes?[Buffer.from(i.image.imageBytes,"base64")]:[])??[];
        if(!images.length)throw new GatewayError("zenmux","返回内容中没有图片",502,true);
        return {kind:"done",images,externalGenerationId:response.sdkHttpResponse?.headers?.["x-generation-id"]};
      }
      const references = await Promise.all(input.referenceImages.map(async ({ id }) => {
        const { bytes, mime } = await this.read(id);
        return { inlineData: { mimeType: mime, data: bytes.toString("base64") } };
      }));
      const client = this.injected ?? new GoogleGenAI({ apiKey: process.env.ZENMUX_API_KEY!.trim(), vertexai: true, httpOptions: { baseUrl: process.env.ZENMUX_VERTEX_BASE_URL?.trim() || "https://zenmux.ai/api/vertex-ai", apiVersion: "v1", timeout: 30000, retryOptions: { attempts: 1 } } });
      const response = await client.models.generateContent({ model: this.model, contents: [{ role: "user", parts: [{ text: input.prompt }, ...references] }], config: { responseModalities: ["TEXT", "IMAGE"], maxOutputTokens: (registered?.candidate.pricing.imageTokens?.[input.resolution] ?? 0) + IMAGE_TEXT_OUTPUT_BUDGET, imageConfig: { ...(input.aspectRatio !== "auto" ? { aspectRatio: input.aspectRatio } : {}), imageSize: input.resolution, outputMimeType: input.outputFormat === "jpg" ? "image/jpeg" : "image/png" } } }) as Reply;
      reply = response;
      if (response.promptFeedback?.blockReason || response.candidates?.some((candidate) => /SAFETY|BLOCKLIST|PROHIBITED_CONTENT/.test(candidate.finishReason ?? "") || candidate.safetyRatings?.some((rating) => rating.blocked))) throw new GatewayError("zenmux", "内容被安全策略拦截", 422, false);
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
      const normalized = usage ? { inputTokens: usage.promptTokenCount ?? 0, outputTokens: usage.candidatesTokenCount ?? 0, totalTokens: usage.totalTokenCount ?? 0 } : undefined;
      const candidate = registered?.candidate??models["scene-main"].find(c => c.provider === "zenmux" && c.model === this.model);
      return { kind: "done", images, externalGenerationId: response.responseId ?? response.response_id, ...(normalized ? { usage: normalized, ...(candidate ? { cost: { amount: imageUsageUsd(candidate, normalized, input.resolution, images.length), currency: "USD" as const, estimated: true } } : {}) } : {}) };
    } catch (error) { const failure = gatewayException("zenmux", error); failure.externalGenerationId = reply?.responseId ?? reply?.response_id; throw failure; }
  }
}
// 保留所选分辨率与宽高比，不在回退时默认降为1K或换图。
export function zenmuxImageSize(resolution:string,ratio:string){
 if(ratio==="auto")return "auto";
 const [w,h]=ratio.split(":").map(Number),edge=resolution==="4K"?4096:resolution==="2K"?2048:1024;
 if(!w||!h)throw new GatewayError("zenmux","图片比例参数无效",400,false);
 const width=w>=h?edge:Math.round(edge*w/h/16)*16,height=h>=w?edge:Math.round(edge*h/w/16)*16;
 return `${width}x${height}`;
}
