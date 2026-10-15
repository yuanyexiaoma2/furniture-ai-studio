import "server-only";
import {db} from "./db";
import {assertUsdQuota} from "./quota";
import {StudioError} from "./studio-error";
import {json} from "./agent-state";
export type SearchSource={title:string;url:string;content:string};
export async function webSearch(sessionId:string,userId:string,query:string,maxResults=3,fetcher:typeof fetch=fetch){
 const q=query.trim();if(!q||q.length>500||!Number.isInteger(maxResults)||maxResults<1||maxResults>5)throw new StudioError("搜索词需为1～500字，结果数量为1～5");
 const key=process.env.TAVILY_API_KEY?.trim();if(!key)throw new StudioError("联网搜索尚未配置，管理员需填写 TAVILY_API_KEY 并重启服务；可以关闭联网继续制作",503);
 const estimate=Number(process.env.TAVILY_SEARCH_COST_USD??".008");if(!Number.isFinite(estimate)||estimate<0)throw new StudioError("搜索计费配置无效，请管理员核对",503);
 const row=await db.$transaction(async tx=>{await assertUsdQuota(tx,userId,estimate);return tx.searchCall.create({data:{sessionId,createdById:userId,query:q,costUsd:estimate}});});
 const begin=Date.now();
 try{
 const response=await fetcher("https://api.tavily.com/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({api_key:key,query:q,max_results:maxResults,search_depth:"basic",include_answer:false,include_raw_content:false,include_usage:true}),signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new StudioError("搜索服务暂时不可用（"+response.status+"），请稍后重试或关闭联网继续",502);
 const data=await response.json() as {results?:SearchSource[];usage?:{credits?:number}};const sources=(data.results??[]).filter(r=>/^https?:\/\//.test(r.url)).slice(0,maxResults).map(r=>({title:r.title.slice(0,300),url:r.url,content:r.content.slice(0,2500)}));
 await db.searchCall.update({where:{id:row.id},data:{status:"success",durationMs:Date.now()-begin,resultCount:sources.length,sources:json(sources)}});
 return{sources,resultCount:sources.length,costUsd:estimate,costEstimated:true};
 }catch(error){await db.searchCall.update({where:{id:row.id},data:{status:"failed",durationMs:Date.now()-begin,error:error instanceof Error?error.message:"搜索失败"}});throw error;}
}
