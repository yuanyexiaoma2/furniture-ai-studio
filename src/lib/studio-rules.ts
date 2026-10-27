import {DEFAULT_AGENT} from "./agent-default";
export function passedProbe(probe:unknown){const p=probe as {toolCalls?:number;parameterCorrect?:number;formatCorrect?:number;contextStable?:number};return p?.toolCalls===20&&(p.parameterCorrect??0)>=19&&(p.formatCorrect??0)>=19&&p.contextStable===20;}
export function userSelectedAgent(id:string,candidate:unknown){const c=candidate as {provider?:string;model?:string}|null;return id===DEFAULT_AGENT.id&&c?.provider===DEFAULT_AGENT.candidate.provider&&c.model===DEFAULT_AGENT.candidate.model;}
export function agentCanBeUsed(id:string,candidate:unknown,probe:unknown){return userSelectedAgent(id,candidate)||passedProbe(probe);}
export function imageRetryAllowed(input:Record<string,unknown>,retryable:boolean,uncertain:boolean){return retryable&&!uncertain&&Number(input.autoRetryCount??0)<1&&Number(input.referenceRetryCount??0)<1;}

export function uploadIssue(files:{name:string;size:number;type:string}[]){if(files.filter(f=>f.type.startsWith("image/")||/\.(png|jpe?g|webp)$/i.test(f.name)).length>3)return "本次最多上传3张实拍；请移除多余图片后重试";if(files.length>15)return "本次最多15个文件；请分批上传";if(files.some(f=>f.size<=0||f.size>30*1024*1024))return "文件不能为空且每个不能超过30MB；请检查或压缩文件后重试";if(files.reduce((n,f)=>n+f.size,0)>100*1024*1024)return "文件合计超过100MB；请精简资料后重试";return null;}
