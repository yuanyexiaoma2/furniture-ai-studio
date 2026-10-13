// 模型值已由官方 createTask 示例核实，详见 docs/kie-notes.md。
export const KIE_IMAGE_MODEL = {
  provider: "kie",
  model: "nano-banana-2-1",
  label: "Nano Banana 2.1",
  resolution: "2K",
  output_format: "png",
  aspect_ratio: "1:1",
  prices: { "1K": 4, "2K": 6, "4K": 9 },
  usdPerCredit: 0.005,
} as const;

export type ModelCandidate = {
  provider: "zenmux" | "kie";
  model: string;
  endpoint?: string;
  protocol?: "chat" | "responses";
  supportsTools: boolean;
  pricing: { currency: "credits" | "USD"; images?: Partial<Record<"1K" | "2K" | "4K", number>>; inputPerMillion?: number; outputPerMillion?: number };
};
const imageCandidates: readonly ModelCandidate[] = [
  { provider: "zenmux", model: "google/gemini-nano-banana-2.1", supportsTools: false, pricing: { currency: "USD" } },
  { provider: "kie", model: "nano-banana-2-1", supportsTools: false, pricing: { currency: "credits", images: KIE_IMAGE_MODEL.prices } },
];
export const models = {
  "scene-main": imageCandidates,
  edit: imageCandidates,
  "llm-vision": [
    { provider: "zenmux", model: "google/gemini-2.5-pro", supportsTools: true, pricing: { currency: "USD" } },
    { provider: "kie", model: "gemini-3-6-flash-openai", endpoint: "https://api.kie.ai/gemini-3-6-flash-openai/v1/chat/completions", protocol: "chat", supportsTools: false, pricing: { currency: "credits", inputPerMillion: 45, outputPerMillion: 225 } },
  ],
  // KIE 已核实的工具模型走 Responses 协议；这里只配置，不调用 Agent。
  "llm-agent": [
    { provider: "zenmux", model: "google/gemini-2.5-pro", supportsTools: true, pricing: { currency: "USD" } },
    { provider: "kie", model: "gpt-6-1-sol", endpoint: "https://api.kie.ai/codex/v1/responses", protocol: "responses", supportsTools: true, pricing: { currency: "credits" } },
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
