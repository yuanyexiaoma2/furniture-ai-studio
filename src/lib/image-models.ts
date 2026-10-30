import type {ModelCandidate} from "./models.config";

// 2026-10-27核对KIE官方文档和价格卡；标准Qwen3的参考图另计0.5积分/张。
export type KieImageSpec={id:string;name:string;model:string;brand:"google"|"openai"|"qwen";description:string;prices:Partial<Record<"1K"|"2K"|"4K",number>>;inputImageCredits?:number;maxReferences:number;maxPrompt:number;maxReferenceBytes:number;ratios:readonly string[];format:"banana"|"gpt25"|"qwen3";source:string};
const bananaRatios=["1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9","1:4","4:1","1:8","8:1","auto"];
const commonRatios=["1:1","3:2","2:3","4:3","3:4","16:9","9:16","21:9"];
export const DEFAULT_IMAGE_ID="image-banana";
export const kieImageModels:readonly KieImageSpec[]=[
 {id:DEFAULT_IMAGE_ID,name:"Nano Banana 2.1",model:"nano-banana-2-1",brand:"google",description:"多图参考与产品场景，支持1K/2K/4K",prices:{"1K":4,"2K":6,"4K":9},maxReferences:10,maxPrompt:20000,maxReferenceBytes:30*1024*1024,ratios:bananaRatios,format:"banana",source:"https://kie.ai/nano-banana-2-1"},
 {id:"image-gpt-25",name:"GPT Image 2.5",model:"gpt-image-2-5-sunburst-image-to-image",brand:"openai",description:"Sunburst画质版，多图参考与指令精修",prices:{"1K":6,"2K":10,"4K":16},maxReferences:16,maxPrompt:20000,maxReferenceBytes:30*1024*1024,ratios:[...commonRatios,"auto"],format:"gpt25",source:"https://kie.ai/gpt-image-2-5"},
 {id:"image-banana-2",name:"Nano Banana 2",model:"nano-banana-2",brand:"google",description:"快速多图生成，支持1K/2K/4K",prices:{"1K":8,"2K":12,"4K":18},maxReferences:10,maxPrompt:20000,maxReferenceBytes:30*1024*1024,ratios:bananaRatios,format:"banana",source:"https://kie.ai/nano-banana-2"},
 {id:"image-banana-pro",name:"Nano Banana Pro",model:"nano-banana-pro",brand:"google",description:"材质细节与精细修改，支持1K/2K/4K",prices:{"1K":18,"2K":18,"4K":24},maxReferences:8,maxPrompt:20000,maxReferenceBytes:30*1024*1024,ratios:[...commonRatios,"4:5","5:4","auto"],format:"banana",source:"https://kie.ai/nano-banana-pro"},
 {id:"image-qwen3",name:"Qwen3",model:"qwen3/image-to-image",brand:"qwen",description:"Qwen Image 3.0，支持1K/2K、最多3张参考图",prices:{"1K":4.8,"2K":4.8},inputImageCredits:.5,maxReferences:3,maxPrompt:5000,maxReferenceBytes:10*1024*1024,ratios:commonRatios,format:"qwen3",source:"https://kie.ai/qwen-image-3?model=qwen3%2Fimage-to-image"},
];
export function kieImageSpec(model:string){return kieImageModels.find(spec=>spec.model===model);}
export function imageCandidate(spec:KieImageSpec):ModelCandidate{return {provider:"kie",model:spec.model,supportsTools:false,pricing:{currency:"credits",images:spec.prices,inputImage:spec.inputImageCredits,estimateSource:spec.source}};}

// 同款映射核对自ZenMux模型页和Google Gemini图片协议；不可用相近型号替换。
export const zenmuxImageModels:{kieModel:string;candidate:ModelCandidate;maxReferences:number}[]=[
 {kieModel:"nano-banana-2-1",maxReferences:14,candidate:{provider:"zenmux",model:"google/gemini-nano-banana-2.1",imageProtocol:"gemini",supportsTools:false,pricing:{currency:"USD",inputPerMillion:1.5,outputPerMillion:7.5,imageOutputPerMillion:30,imageTokens:{"1K":1120,"2K":1680,"4K":3780},estimateSource:"https://zenmux.ai/google/gemini-nano-banana-2.1"}}},
 {kieModel:"nano-banana-2",maxReferences:14,candidate:{provider:"zenmux",model:"google/gemini-3.1-flash-image",imageProtocol:"gemini",supportsTools:false,pricing:{currency:"USD",inputPerMillion:.5,outputPerMillion:3,imageOutputPerMillion:60,imageTokens:{"1K":1120,"2K":1680,"4K":2520},estimateSource:"https://ai.google.dev/gemini-api/docs/pricing"}}},
 {kieModel:"nano-banana-pro",maxReferences:14,candidate:{provider:"zenmux",model:"google/gemini-3-pro-image",imageProtocol:"gemini",supportsTools:false,pricing:{currency:"USD",inputPerMillion:2,outputPerMillion:12,imageOutputPerMillion:120,imageTokens:{"1K":1120,"2K":1120,"4K":2000},estimateSource:"https://zenmux.ai/google/gemini-3-pro-image"}}},
 {kieModel:"gpt-image-2-5-sunburst-image-to-image",maxReferences:16,candidate:{provider:"zenmux",model:"openai/gpt-image-2.5-sunburst",imageProtocol:"vertex-edit",supportsTools:false,pricing:{currency:"USD",images:{"1K":.03,"2K":.05,"4K":.08},estimateSource:"https://kie.ai/gpt-image-2-5；仅沿用KIE同款预算作回退预留参考，不是ZenMux报价；实际成功费用由ZenMux账单回填"}}},
 {kieModel:"qwen3/image-to-image",maxReferences:3,candidate:{provider:"zenmux",model:"qwen/qwen-image-3.0",imageProtocol:"vertex-edit",supportsTools:false,pricing:{currency:"USD",images:{"1K":.03,"2K":.03},inputImage:.003,estimateSource:"https://zenmux.ai/qwen/qwen-image-3.0"}}}
];
export function imageRouteCandidates(selected:ModelCandidate){
 const match=zenmuxImageModels.find(m=>selected.provider==="kie"?m.kieModel===selected.model:m.candidate.model===selected.model);
 if(!match)return selected.provider==="kie"?[selected]:[];
 const primary=kieImageModels.find(m=>m.model===match.kieModel)!;
 return [imageCandidate(primary),match.candidate];
}
