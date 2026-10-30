import "server-only";
import {db} from "./db";
import {json} from "./agent-state";
import {studioAgents,canonicalAgentId,preserveProbeHistory} from "./agent-models";
export async function configureTask14Models(){
 return db.$transaction(async tx=>{
  await tx.studioModel.deleteMany({where:{kind:"agent",OR:[{id:"agent-zenmux"},{candidate:{path:["model"],equals:"google/gemini-2.5-pro"}}]}});
  const rows=await tx.studioModel.findMany({where:{kind:"agent"}});
  for(const definition of studioAgents){
   const related=rows.filter(r=>canonicalAgentId(r.id)===definition.id),current=related.find(r=>r.id===definition.id);
   const probe=preserveProbeHistory(current?.probe??related[0]?.probe??{},related);
   await tx.studioModel.upsert({where:{id:definition.id},create:{id:definition.id,name:definition.name,kind:"agent",candidate:json(definition.candidate),enabled:true,visible:definition.id==="agent-zenmux-flash",probe:json(probe)},update:{name:definition.name,candidate:json(definition.candidate),probe:json(probe)}});
   // 保留旧行及其探测证据，旧ID作为别名解析；目录只显示规范行。
   for(const alias of related.filter(r=>r.id!==definition.id))await tx.studioModel.update({where:{id:alias.id},data:{candidate:json(definition.candidate),probe:json({...alias.probe as object,aliasOf:definition.id})}});
  }
  return studioAgents.map(m=>({id:m.id,model:m.candidate.model,provider:m.candidate.provider}));
 });
}
