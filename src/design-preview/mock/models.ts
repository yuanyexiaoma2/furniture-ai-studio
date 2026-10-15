/** 静态原型唯一模型目录；价格与耗时均为演示值，不是服务报价。 */
export type ModelKind = "agent" | "image";
export type Quality = "auto" | "standard" | "fine";
export type ModelTier = { id: Quality; label: string; seconds: number; price: number };
export type MockModel = {
  id: string; kind: ModelKind; name: string; brandIcon: string; color: string;
  description: string; tag?: string; seconds: number; price: number;
  pricesByResolution?:Partial<Record<"1K"|"2K"|"4K",number>>;failureRate: number; enabled: boolean; visible: boolean; isDefault?: boolean; tiers?: ModelTier[];
};
export const models: MockModel[] = [
  {id:"agent-sol",kind:"agent",name:"GPT-6.1 Sol",brandIcon:"/design-preview/brands/openai.svg",color:"#365c4c",description:"强推理，适合复杂图包规划",tag:"推荐",seconds:8,price:.006,failureRate:.8,enabled:true,visible:true,isDefault:true},
  {id:"agent-flash",kind:"agent",name:"Gemini 3.8 Flash",brandIcon:"/design-preview/brands/google.svg",color:"#5075a2",description:"速度快、成本低",tag:"快",seconds:3,price:.002,failureRate:.6,enabled:true,visible:true},
  {id:"agent-haiku",kind:"agent",name:"Claude Haiku 5.5",brandIcon:"/design-preview/brands/anthropic.svg",color:"#a86d50",description:"对话自然、跟随指令稳",tag:"省钱",seconds:4,price:.001,failureRate:1.1,enabled:true,visible:true},
  {id:"image-banana",kind:"image",name:"Nano Banana 2.1",brandIcon:"/design-preview/brands/google.svg",color:"#9b8439",description:"产品还原度高",seconds:18,price:.03,failureRate:1.2,enabled:true,visible:true,isDefault:true},
  {id:"image-banana-pro",kind:"image",name:"Nano Banana Pro",brandIcon:"/design-preview/brands/google.svg",color:"#887046",description:"材质细节与精细修改",seconds:28,price:.05,failureRate:2.1,enabled:true,visible:true,tiers:[{id:"auto",label:"自动",seconds:28,price:.05},{id:"standard",label:"标准",seconds:20,price:.04},{id:"fine",label:"精细",seconds:38,price:.07}]},
  {id:"image-gpt",kind:"image",name:"GPT Image 2",brandIcon:"/design-preview/brands/openai.svg",color:"#365c4c",description:"指令理解与透明底",seconds:32,price:.08,failureRate:2.4,enabled:true,visible:true,tiers:[{id:"auto",label:"自动",seconds:32,price:.08},{id:"standard",label:"标准",seconds:24,price:.06},{id:"fine",label:"精细",seconds:45,price:.12}]},
  {id:"image-seedream",kind:"image",name:"Seedream 5.0",brandIcon:"/design-preview/brands/bytedance.svg",color:"#5f6a94",description:"场景氛围与中文排版",seconds:16,price:.025,failureRate:3.6,enabled:true,visible:true},
  {id:"image-flux",kind:"image",name:"Flux.2 Pro",brandIcon:"/design-preview/brands/bfl.svg",color:"#5d6166",description:"自然光影与真实空间",seconds:22,price:.04,failureRate:1.9,enabled:true,visible:true},
];
export const qualityLabels: Record<Quality,string> = {auto:"自动",standard:"标准",fine:"精细"};
export function modelRate(model: MockModel, quality: Quality = "auto") {
  return model.tiers?.find(t=>t.id===quality) ?? {seconds:model.seconds,price:model.price};
}
