import "server-only";
import {db} from "./db";
import {json} from "./agent-state";
import {DEFAULT_AGENT} from "./agent-default";
import {imageCandidate,kieImageModels} from "./image-models";

// 仅登记用户授权的模型目录，不执行模型探测或真实生成，保留历史probe与调用记录。
export async function configureStudioModels(){
 const entries=[{id:DEFAULT_AGENT.id,name:DEFAULT_AGENT.name,kind:"agent",candidate:DEFAULT_AGENT.candidate},...kieImageModels.map(spec=>({id:spec.id,name:spec.name,kind:"image",candidate:imageCandidate(spec)}))];
 for(const entry of entries){const data={name:entry.name,kind:entry.kind,candidate:json(entry.candidate),enabled:true,visible:true};await db.studioModel.upsert({where:{id:entry.id},create:{id:entry.id,...data},update:data});}
 return entries.map(({id,name,kind,candidate})=>({id,name,kind,provider:candidate.provider,model:candidate.model}));
}
