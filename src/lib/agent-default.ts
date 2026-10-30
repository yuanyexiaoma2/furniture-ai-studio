import type {ModelCandidate} from "./models.config";

// 用户于2026-10-27指定默认模型；与KIE的历史探测分开，不代表通过能力验收。
export const DEFAULT_AGENT = {
 id:"agent-zenmux-flash",
 name:"Gemini 3.8 Flash",
 candidate:{
  provider:"zenmux",model:"google/gemini-3.8-flash",supportsTools:true,
  pricing:{currency:"USD",inputPerMillion:.75,outputPerMillion:3.75,
   estimateSource:"https://zenmux.ai/google/gemini-3.8-flash；2026-10-30公开目录参考预估，实际以账单回填为准"},
 } satisfies ModelCandidate,
} as const;
