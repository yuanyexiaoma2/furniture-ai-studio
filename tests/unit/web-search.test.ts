import "dotenv/config";
import {test} from "node:test";
import assert from "node:assert/strict";
import {createWebSearch} from "../../src/lib/web-search";
import {ZenMuxLLMProvider} from "../../src/lib/zenmux-llm-provider";
import {researchCacheState} from "../../src/lib/research-cache";
import {studioAgents} from "../../src/lib/agent-models";
import {fixture} from "../fixtures/visual-plan";

test("Sol与Gemini均按所选模型发送联网选项，并保留原调用的账号与商品上下文",async()=>{
 const prior={key:process.env.ZENMUX_API_KEY,enabled:process.env.GOOGLE_SEARCH_ENABLED};
 process.env.ZENMUX_API_KEY="local-test";process.env.GOOGLE_SEARCH_ENABLED="true";
 try{
  for(const id of ["agent-sol","agent-zenmux-flash"]){
   const candidate=studioAgents.find(a=>a.id===id)!.candidate;let calls=0;
   const provider=new ZenMuxLLMProvider(candidate.model,async body=>{
    calls++;assert.equal(body.model,candidate.model);assert.deepEqual(body.web_search_options,{search_context_size:"low"});
    return {choices:[{message:{content:"来源内容",annotations:[{type:"url_citation",url_citation:{title:"来源",url:"https://example.org/source"}}]}}]};
   });
   const search=createWebSearch({session:async()=>({productId:"product",settings:{agentId:id,webEnabled:true}}),candidate:async(_kind,settings)=>{assert.equal(settings.agentId,id);return candidate;},chat:async(logical,input,context)=>{
    assert.equal(logical,"llm-agent");assert.equal(context.userId,"user");assert.equal(context.productId,"product");assert.equal(context.sessionId,"session");assert.equal(context.candidate,candidate);
    return {result:await provider.chat(input)};
   }});
   const result=await search("session","user","品类趋势",1);assert.equal(calls,1);assert.equal(result.resultCount,1);assert.equal(result.sources[0].url,"https://example.org/source");
  }
 }finally{
  if(prior.key===undefined)delete process.env.ZENMUX_API_KEY;else process.env.ZENMUX_API_KEY=prior.key;
  if(prior.enabled===undefined)delete process.env.GOOGLE_SEARCH_ENABLED;else process.env.GOOGLE_SEARCH_ENABLED=prior.enabled;
 }
});

test("全局或会话关闭联网、非法输入均在调用模型前拒绝",async()=>{
 const prior=process.env.GOOGLE_SEARCH_ENABLED;let calls=0;let webEnabled=true;
 const search=createWebSearch({session:async()=>({productId:"p",settings:{webEnabled}}),candidate:async()=>studioAgents[0].candidate,chat:async()=>{calls++;throw new Error("不应调用");}});
 try{
  process.env.GOOGLE_SEARCH_ENABLED="false";await assert.rejects(search("s","u","搜索"),/联网补充已关闭/);
  process.env.GOOGLE_SEARCH_ENABLED="true";webEnabled=false;await assert.rejects(search("s","u","搜索"),/当前会话已关闭/);
  webEnabled=true;await assert.rejects(search("s","u"," "),/搜索词/);await assert.rejects(search("s","u","搜索",6),/结果数量/);assert.equal(calls,0);
 }finally{if(prior===undefined)delete process.env.GOOGLE_SEARCH_ENABLED;else process.env.GOOGLE_SEARCH_ENABLED=prior;}
});

test("没有供应商来源注解的自写链接不能冒充搜索成功，也不重试或切换模型",async()=>{
 const prior=process.env.GOOGLE_SEARCH_ENABLED;process.env.GOOGLE_SEARCH_ENABLED="true";let calls=0;
 const {parseChatReply}=await import("../../src/lib/llm-format");
 const search=createWebSearch({session:async()=>({productId:"p",settings:{webEnabled:true}}),candidate:async()=>studioAgents[2].candidate,chat:async(_logical,input)=>{
  calls++;return {result:parseChatReply({choices:[{message:{content:"据 https://invented.invalid 所述",annotations:[{type:"url_citation",url_citation:{url:"javascript:alert(1)"}}]}}]},input,"zenmux")};
 }});
 try{await assert.rejects(search("s","u","搜索"),/未返回搜索来源/);assert.equal(calls,1);}
 finally{if(prior===undefined)delete process.env.GOOGLE_SEARCH_ENABLED;else process.env.GOOGLE_SEARCH_ENABLED=prior;}
});

const now=Date.now(),recent=new Date(now-60_000).toISOString();
const cached={...fixture.research,status:"success",cachedAt:recent,cacheKey:"pictures",searchCacheKey:"sol-on",searchCachedAt:recent,supplement:{status:"success",note:"来源",text:"补充",sources:[{title:"来源",url:"https://example.org",content:"内容"}]}};
test("切换联网开关或Agent只使联网补充失效，仍复用未过期的竞品看图结果",()=>{
 assert(researchCacheState(cached,"pictures","sol-on",now).searchFresh);
 for(const key of ["sol-off","gemini-on"]){const state=researchCacheState(cached,"pictures",key,now);assert(state.research);assert(!state.searchFresh);}
 assert.equal(researchCacheState(cached,"changed-pictures","sol-on",now).research,null);
});
test("联网失败只缓存15分钟，不沿用竞品成功的7天时效；兼容没有联网键的历史缓存",()=>{
 const stale=new Date(now-16*60_000).toISOString();
 const state=researchCacheState({...cached,searchCachedAt:stale,supplement:{...cached.supplement,status:"skipped"}},"pictures","sol-on",now);
 assert(state.research);assert(!state.searchFresh);
 const legacy=researchCacheState({...cached,searchCacheKey:undefined},"pictures","sol-on",now);assert(legacy.research);assert(!legacy.searchFresh);
 assert(!researchCacheState({...cached,searchCachedAt:new Date(now-8*86400000).toISOString()},"pictures","sol-on",now).searchFresh);
});
