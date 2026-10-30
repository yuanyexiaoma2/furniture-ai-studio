import type {ModelCandidate} from "./models.config";
import {DEFAULT_AGENT} from "./agent-default";
export const agentAliases:Record<string,string>={"agent-flash":DEFAULT_AGENT.id};
export const canonicalAgentId=(id:string)=>agentAliases[id]??id;
// 2026-10-30核对ZenMux公开目录；旧KIE探测结果仅作为历史，不决定可见性。
export const studioAgents=[
 {id:DEFAULT_AGENT.id,name:DEFAULT_AGENT.name,candidate:{...DEFAULT_AGENT.candidate,pricing:{currency:"USD",inputPerMillion:.75,outputPerMillion:3.75,estimateSource:"https://zenmux.ai/google/gemini-3.8-flash"}}},
 {id:"agent-haiku",name:"Claude Haiku 5.5",candidate:{provider:"zenmux",model:"anthropic/claude-haiku-5.5",supportsTools:true,pricing:{currency:"USD",inputPerMillion:.1,outputPerMillion:.5,longContextInputPerMillion:.5,longContextOutputPerMillion:2.5,estimateSource:"https://zenmux.ai/anthropic/claude-haiku-5.5"}}},
 {id:"agent-sol",name:"GPT-6.1 Sol",candidate:{provider:"zenmux",model:"openai/gpt-6.1-sol",supportsTools:true,pricing:{currency:"USD",inputPerMillion:2,outputPerMillion:10,longContextInputPerMillion:4,longContextOutputPerMillion:15,estimateSource:"https://zenmux.ai/openai/gpt-6.1-sol"}}}
] satisfies {id:string;name:string;candidate:ModelCandidate}[];
export function zenmuxAgentCandidate(id:string,candidate:ModelCandidate):ModelCandidate{
 return studioAgents.find(m=>m.id===canonicalAgentId(id))?.candidate??candidate;
}
export function probeWarning(probe:unknown){
 const p=probe as {toolCalls?:number;parameterCorrect?:number;formatCorrect?:number;contextStable?:number}|null;
 return p?.toolCalls===20&&(p.parameterCorrect??0)>=19&&(p.formatCorrect??0)>=19&&p.contextStable===20?"":`${p?.toolCalls?"":"待验证 · "}工具调用正确率 ${p?.parameterCorrect??0}/20，可能不稳定`;
}
export function preserveProbeHistory(current:unknown,prior:{id:string;candidate:unknown;probe:unknown}[]):Record<string,unknown>&{history:unknown[]}{
 const main=current&&typeof current==="object"?current as Record<string,unknown>:{},history=Array.isArray(main.history)?main.history:[];
 const additions=prior.filter(p=>p.probe&&Object.keys(p.probe as object).length).map(p=>({sourceId:p.id,provider:(p.candidate as ModelCandidate).provider,model:(p.candidate as ModelCandidate).model,probe:Object.fromEntries(Object.entries(p.probe as Record<string,unknown>).filter(([key])=>key!=="history"))}));
 return {...main,history:[...new Map([...history,...additions].map(h=>[JSON.stringify(h),h])).values()]};
}
