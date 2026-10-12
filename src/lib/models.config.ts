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

export const models = {
  "scene-main": KIE_IMAGE_MODEL,
  // 暂指向同一模型；蒙版与涂抹编辑留给后续任务，可独立替换路由。
  edit: KIE_IMAGE_MODEL,
} as const;

export const sceneAspectRatios = ["1:1", "3:4", "4:3", "16:9"] as const;
export type SceneAspectRatio = typeof sceneAspectRatios[number];
export type LogicalModel = keyof typeof models;

export function modelCost(logicalModel: LogicalModel) {
  const config = models[logicalModel];
  const credits = config.prices[config.resolution];
  return { credits, usd: credits * config.usdPerCredit };
}
