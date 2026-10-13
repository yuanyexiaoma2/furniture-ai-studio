export type ImageInput = {
  prompt: string;
  image_input: string[];
  aspect_ratio: string;
  resolution: string;
  output_format: string;
};

export type ImageResult =
  | { status: "pending" }
  | { status: "success"; urls: string[]; cost?: GatewayCost }
  | { status: "failed"; error: string };

// 保留旧接口供任务 2 回归测试；业务改为以下同步 / 异步统一接口。
export interface LegacyImageProvider {
  uploadFile(assetId: string): Promise<string>;
  submit(model: string, input: ImageInput): Promise<string>;
  getResult(taskId: string): Promise<ImageResult>;
}

export type ImageResolution = "1K" | "2K" | "4K";
export type ImageRequest = {
  prompt: string;
  referenceImages: { id: string }[];
  aspectRatio: string;
  resolution: ImageResolution;
  outputFormat: "png" | "jpg";
};
export type TokenUsage = { inputTokens: number; outputTokens: number; totalTokens: number };
export type GatewayCost = { amount: number; currency: "credits" | "USD"; estimated?: boolean };
export type ImageGeneration =
  | { kind: "done"; images: Buffer[]; usage?: TokenUsage; cost?: GatewayCost; requestInput?: Record<string, unknown> }
  | { kind: "pending"; taskId: string; requestInput?: Record<string, unknown> };
export interface ImageProvider {
  isConfigured(): boolean;
  generate(input: ImageRequest): Promise<ImageGeneration>;
  poll?(taskId: string): Promise<ImageGeneration>;
}
