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
  // 指令二次编辑使用同一多图参考模型；蒙版与涂抹编辑另行实现。
  edit: KIE_IMAGE_MODEL,
} as const;

export const sceneAspectRatios = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9", "1:4", "4:1", "1:8", "8:1", "auto"] as const;
export const sceneResolutions = ["2K", "4K"] as const;
export type SceneResolution = typeof sceneResolutions[number];
export type SceneAspectRatio = typeof sceneAspectRatios[number];
export type LogicalModel = keyof typeof models;

export function modelCost(logicalModel: LogicalModel, resolution: SceneResolution = "2K") {
  const config = models[logicalModel];
  const credits = config.prices[resolution];
  return { credits, usd: credits * config.usdPerCredit };
}
