// 模型值已由官方 createTask 示例核实，详见 docs/kie-notes.md。
export const KIE_USD_PER_CREDIT = 0.005;
export const IMAGE_DEFAULTS = { resolution: "2K", output_format: "png", aspect_ratio: "1:1" } as const;
export const LLM_OUTPUT_BUDGET = 2200;
export const IMAGE_TEXT_OUTPUT_BUDGET = 1024;
export const KIE_IMAGE_MODEL = {
  provider: "kie",
  model: "nano-banana-2-1",
  label: "Nano Banana 2.1",
  resolution: "2K",
  output_format: "png",
  aspect_ratio: "1:1",
  prices: { "1K": 4, "2K": 6, "4K": 9 },
  usdPerCredit: KIE_USD_PER_CREDIT,
} as const;

export type ModelCandidate = {
  provider: "zenmux" | "kie";
  model: string;
  endpoint?: string;
  protocol?: "chat" | "responses";
  supportsTools: boolean;
  pricing: { currency: "credits" | "USD"; images?: Partial<Record<"1K" | "2K" | "4K", number>>; inputPerMillion?: number; outputPerMillion?: number; imageTokens?: Partial<Record<"1K" | "2K" | "4K", number>>; imageOutputPerMillion?: number; longContextInputPerMillion?: number; longContextOutputPerMillion?: number; estimateSource?: string };
};
const imageCandidates: readonly ModelCandidate[] = [
  { provider: "zenmux", model: "google/gemini-nano-banana-2.1", supportsTools: false, pricing: { currency: "USD", inputPerMillion: 1.5, outputPerMillion: 7.5, imageOutputPerMillion: 30, imageTokens: { "1K": 1120, "2K": 1680, "4K": 3780 }, estimateSource: "Google 上游价格与图像 token，仅供预估，ZenMux 账单回填为准" } },
  { provider: "kie", model: KIE_IMAGE_MODEL.model, supportsTools: false, pricing: { currency: "credits", images: KIE_IMAGE_MODEL.prices } },
];
export const models = {
  "scene-main": imageCandidates,
  edit: imageCandidates,
  "llm-vision": [
    { provider: "zenmux", model: "google/gemini-2.5-pro", supportsTools: true, pricing: { currency: "USD", inputPerMillion: 1.25, outputPerMillion: 10, longContextInputPerMillion: 2.5, longContextOutputPerMillion: 15, estimateSource: "Google 上游分档参考，ZenMux 账单回填为准" } },
    { provider: "kie", model: "gemini-3-6-flash-openai", endpoint: "https://api.kie.ai/gemini-3-6-flash-openai/v1/chat/completions", protocol: "chat", supportsTools: false, pricing: { currency: "credits", inputPerMillion: 45, outputPerMillion: 225 } },
  ],
  // KIE Responses 工具模型；单价来源 kie.ai/gpt-6-1-sol（2026-10-14）。
  "llm-agent": [
    { provider: "zenmux", model: "google/gemini-2.5-pro", supportsTools: true, pricing: { currency: "USD", inputPerMillion: 1.25, outputPerMillion: 10, longContextInputPerMillion: 2.5, longContextOutputPerMillion: 15 } },
    { provider: "kie", model: "gpt-6-1-sol", endpoint: "https://api.kie.ai/codex/v1/responses", protocol: "responses", supportsTools: true, pricing: { currency: "credits", inputPerMillion: 120, outputPerMillion: 600 } },
  ],
} satisfies Record<string, readonly ModelCandidate[]>;
export function modelLabel() { return KIE_IMAGE_MODEL.label; }

export const sceneAspectRatios = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9", "1:4", "4:1", "1:8", "8:1", "auto"] as const;
export const sceneResolutions = ["2K", "4K"] as const;
export type SceneResolution = typeof sceneResolutions[number];
export type SceneAspectRatio = typeof sceneAspectRatios[number];
export type LogicalModel = keyof typeof models;

export function modelCost(_logicalModel: LogicalModel, resolution: SceneResolution = "2K") {
  const config = KIE_IMAGE_MODEL;
  const credits = config.prices[resolution];
  return { credits, usd: credits * config.usdPerCredit };
}
