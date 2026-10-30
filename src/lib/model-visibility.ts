import {canonicalAgentId} from "./agent-models";
// 探测仅供参考；权限由API校验，开放权属于管理员。
export async function setModelVisibility(id:string,visible:boolean,store:{update:(input:{where:{id:string};data:{visible:boolean}})=>Promise<unknown>}){
 return store.update({where:{id:canonicalAgentId(id)},data:{visible}});
}
