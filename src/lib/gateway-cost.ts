import { KIE_USD_PER_CREDIT, LLM_OUTPUT_BUDGET, IMAGE_TEXT_OUTPUT_BUDGET, type ModelCandidate } from "./models.config";
import type { GatewayCost, ImageResolution, TokenUsage } from "./image-provider";
export const roundUsd = (amount: number) => Math.round(amount * 1_000_000) / 1_000_000;
export function toUsd(cost: GatewayCost) { return roundUsd(cost.amount * (cost.currency === "credits" ? KIE_USD_PER_CREDIT : 1)); }
export function imageInputTokens(photos: { width: number; height: number }[]) {
  return photos.reduce((sum, p) => sum + (p.width <= 384 && p.height <= 384 ? 258 : Math.ceil(p.width / 768) * Math.ceil(p.height / 768) * 258), 0);
}
// 文本按字符、图片按瓦片粗估；不是网关实际 token 计数。
export function estimateImageUsd(candidate: ModelCandidate, resolution: ImageResolution, prompt = "", photos: { width: number; height: number }[] = []) {
  const pricing = candidate.pricing;
  if (pricing.images?.[resolution] !== undefined) return roundUsd((pricing.images[resolution]! + photos.length*(pricing.inputImage??0)) * (pricing.currency === "credits" ? KIE_USD_PER_CREDIT : 1));
  if (pricing.imageTokens?.[resolution] === undefined || pricing.imageOutputPerMillion === undefined) throw new Error("生图模型未配置可核实的预估单价");
  return roundUsd((pricing.imageTokens[resolution]! * pricing.imageOutputPerMillion + (prompt.length + imageInputTokens(photos)) * (pricing.inputPerMillion ?? 0) + IMAGE_TEXT_OUTPUT_BUDGET * (pricing.outputPerMillion ?? 0)) / 1_000_000);
}
export function estimateLlmUsd(candidate: ModelCandidate, inputTokens: number, outputTokens = LLM_OUTPUT_BUDGET) {
  const long = inputTokens > 200_000, p = candidate.pricing;
  const input = long ? p.longContextInputPerMillion ?? p.inputPerMillion : p.inputPerMillion;
  const output = long ? p.longContextOutputPerMillion ?? p.outputPerMillion : p.outputPerMillion;
  if (input === undefined || output === undefined) throw new Error("大语言模型未配置可核实的预估单价");
  return roundUsd((inputTokens * input + outputTokens * output) / 1_000_000 * (p.currency === "credits" ? KIE_USD_PER_CREDIT : 1));
}
export function imageUsageUsd(candidate: ModelCandidate, usage: TokenUsage, resolution: ImageResolution, count: number) {
  const p = candidate.pricing, imageTokens = (p.imageTokens?.[resolution] ?? 0) * count;
  return roundUsd((usage.inputTokens * (p.inputPerMillion ?? 0) + imageTokens * (p.imageOutputPerMillion ?? 0) + Math.max(0, usage.outputTokens - imageTokens) * (p.outputPerMillion ?? 0)) / 1_000_000);
}
export function costFields(cost: GatewayCost | undefined, estimateUsd: number) {
  return { costUsd: cost ? toUsd(cost) : roundUsd(estimateUsd), credits: cost?.currency === "credits" ? cost.amount : null, costEstimated: !cost || Boolean(cost.estimated) };
}
export function kieCreditCost(value: unknown): GatewayCost | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return { amount: value, currency: "credits" };
}

// 任务14起，失败尝试保留供应商审计，但不重复汇入用户成功图片账单。
export function imageAttemptTotals(input:Record<string,unknown>,attempts:{status:string;costUsd:unknown;credits?:unknown;costEstimated:boolean}[]){
 const billable=input.chargeSuccessfulAttemptOnly?attempts.filter(a=>a.status==="success"):attempts;
 return {costUsd:roundUsd(billable.reduce((sum,a)=>sum+Number(a.costUsd??0),0)),credits:billable.some(a=>a.credits!=null)?roundUsd(billable.reduce((sum,a)=>sum+Number(a.credits??0),0)):null,costEstimated:billable.some(a=>a.costEstimated)};
}
