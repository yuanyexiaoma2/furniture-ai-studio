/** 此文件虽名为mock，但被真实功能引用，不可删除。
 * 具体用途：模型页面/选择器共用ModelKind、Quality、MockModel类型；model-store复用默认值、modelRate与前端费用估算。
 * 真实页面优先读取/api/studio/models；这里仍保留历史回退目录和展示估值，不能冒充服务端报价。后续单独拆分改名。
 */
import {kieImageModels,DEFAULT_IMAGE_ID} from "@/lib/image-models";
import {DEFAULT_AGENT} from "@/lib/agent-default";

export type ModelKind = "agent" | "image";
export type Quality = "auto" | "standard" | "fine";
export type ModelTier = { id: Quality; label: string; seconds: number; price: number };
export type MockModel = {
  id: string; kind: ModelKind; name: string; brandIcon: string; color: string;
  description: string; tag?: string; seconds: number; price: number;
  provider?:"kie"|"zenmux";supportedResolutions?:string[];referenceImagePrice?:number;pricesByResolution?:Partial<Record<"1K"|"2K"|"4K",number>>;failureRate: number; enabled: boolean; visible: boolean; isDefault?: boolean; tiers?: ModelTier[];
};
export const models: MockModel[] = [
  {id:DEFAULT_AGENT.id,kind:"agent",name:DEFAULT_AGENT.name,brandIcon:"/design-preview/brands/google.svg",color:"#5075a2",description:"通过ZenMux理解产品、规划图包与对话",tag:"默认",seconds:3,price:.003,failureRate:0,enabled:true,visible:true,isDefault:true},
  {id:"agent-sol",kind:"agent",name:"GPT-6.1 Sol",brandIcon:"/design-preview/brands/openai.svg",color:"#365c4c",description:"强推理，适合复杂图包规划",tag:"推荐",seconds:8,price:.006,failureRate:.8,enabled:true,visible:true},
  {id:"agent-flash",kind:"agent",name:"Gemini 3.8 Flash",brandIcon:"/design-preview/brands/google.svg",color:"#5075a2",description:"速度快、成本低",tag:"快",seconds:3,price:.002,failureRate:.6,enabled:true,visible:true},
  {id:"agent-haiku",kind:"agent",name:"Claude Haiku 5.5",brandIcon:"/design-preview/brands/anthropic.svg",color:"#a86d50",description:"对话自然、跟随指令稳",tag:"省钱",seconds:4,price:.001,failureRate:1.1,enabled:true,visible:true},
  ...kieImageModels.map(spec=>({id:spec.id,kind:"image" as const,name:spec.name,brandIcon:spec.brand==="qwen"?"":"/design-preview/brands/"+spec.brand+".svg",color:"#888888",description:"KIE · "+spec.description,provider:"kie" as const,seconds:35,price:(spec.prices["2K"]??0)*.005,pricesByResolution:Object.fromEntries(Object.entries(spec.prices).map(([k,v])=>[k,v*.005])),referenceImagePrice:(spec.inputImageCredits??0)*.005,supportedResolutions:Object.keys(spec.prices),failureRate:0,enabled:true,visible:true,isDefault:spec.id===DEFAULT_IMAGE_ID})),
];
export const qualityLabels: Record<Quality,string> = {auto:"自动",standard:"标准",fine:"精细"};
export function modelRate(model: MockModel, quality: Quality = "auto") {
  return model.tiers?.find(t=>t.id===quality) ?? {seconds:model.seconds,price:model.price};
}
