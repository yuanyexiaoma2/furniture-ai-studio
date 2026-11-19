import {researchSchema} from "./visual-plan-rules";

// 竞品看图和联网补充分别复用；切换联网或模型不重复分析仍有效的竞品图片。
export function researchCacheState(raw:unknown,cacheKey:string,searchKey:string,now=Date.now()){
 const parsed=researchSchema.safeParse(raw),meta=raw as {cacheKey?:string;searchCacheKey?:string;searchCachedAt?:string}|null;
 const research=parsed.success&&meta?.cacheKey===cacheKey&&now-Date.parse(parsed.data.cachedAt)<(parsed.data.status==="success"?7*86400000:15*60000)?parsed.data:null;
 const searchFresh=Boolean(research?.supplement&&meta?.searchCacheKey===searchKey&&now-Date.parse(meta.searchCachedAt??"")<(research.supplement.status==="success"?7*86400000:15*60000));
 return {research,searchFresh};
}
