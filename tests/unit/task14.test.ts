import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import {setModelVisibility} from "../../src/lib/model-visibility";
import {canonicalAgentId,probeWarning,preserveProbeHistory,studioAgents} from "../../src/lib/agent-models";
import {candidatesFor,routeCall,type CircuitStore} from "../../src/lib/gateway-router";
import {imageRouteCandidates,kieImageModels,imageCandidate,zenmuxImageModels} from "../../src/lib/image-models";
import {GatewayError} from "../../src/lib/gateway-error";
import {llmProvider} from "../../src/lib/gateway-providers";
import {imageAttemptTotals} from "../../src/lib/gateway-cost";
import {ZenMuxImageProvider} from "../../src/lib/zenmux-image-provider";
import type {ImageRequest} from "../../src/lib/image-provider";
import {kieFailure} from "../../src/lib/kie-http";

function harness(open?:string){
 const events:{provider:string;fallback:boolean;status:string}[]=[];
 const circuit:CircuitStore={isOpen:async p=>p===open,success:async()=>{},failure:async()=>{}};
 const hooks={start:async(c:{provider:string},fallback:boolean)=>{events.push({provider:c.provider,fallback,status:"running"});return String(events.length-1);},success:async(id:string)=>{events[+id].status="success";},failure:async(id:string)=>{events[+id].status="failed";}};
 return {circuit,hooks,events};
}
const primary=imageCandidate(kieImageModels[0]);
test("未验证/未达标模型可以打开或关闭，旧Flash别名操作同一规范行",async()=>{
 const row={visible:false,probe:{toolCalls:20,parameterCorrect:0,contextStable:0}},calls:unknown[]=[];
 const store={update:async(input:{where:{id:string};data:{visible:boolean}})=>{calls.push(input);row.visible=input.data.visible;return row;}};
 await setModelVisibility("agent-haiku",true,store);assert.equal(row.visible,true);assert.match(probeWarning(row.probe),/0\/20，可能不稳定/);
 await setModelVisibility("agent-haiku",false,store);assert.equal(row.visible,false);
 await setModelVisibility("agent-flash",true,store);assert.deepEqual(calls[2],{where:{id:"agent-zenmux-flash"},data:{visible:true}});
 assert.match(probeWarning({}),/待验证/);
});
test("Flash只保留一个规范定义和默认ID，归档原KIE探测数据不丢失",()=>{
 assert.equal(canonicalAgentId("agent-flash"),"agent-zenmux-flash");assert.equal(studioAgents.filter(m=>m.name==="Gemini 3.8 Flash").length,1);
 const old={toolCalls:20,parameterCorrect:16,contextStable:20},merged=preserveProbeHistory({toolCalls:20,parameterCorrect:20},[{id:"agent-flash",candidate:{provider:"kie",model:"gemini-3-8-flash-openai"},probe:old}]);
 assert.equal(merged.parameterCorrect,20);assert.deepEqual((merged.history[0] as {probe:unknown}).probe,old);assert.equal((merged.history[0] as {provider:string}).provider,"kie");
});
test("所有网关偏好下LLM仅ZenMux，生产工厂拒绝KIE LLM",async()=>{
 for(const preference of ["auto","kie","zenmux"])for(const logical of ["llm-agent","llm-vision"] as const)assert(candidatesFor(logical,preference).every(c=>c.provider==="zenmux"));
 assert(studioAgents.every(m=>m.candidate.provider==="zenmux"));assert.throws(()=>llmProvider({...primary,supportsTools:true}),/只允许ZenMux/);
 const h=harness(),calls:string[]=[];await assert.rejects(routeCall({logical:"llm-agent",candidates:[studioAgents[0].candidate,primary],configured:()=>true,...h,call:async c=>{calls.push(c.provider);throw new GatewayError(c.provider,"上游失败",503);}}));assert.deepEqual(calls,["zenmux"]);
});
test("五款生图精确匹配同款，不把Qwen标准版换成Pro，KIE始终排第一",()=>{
 assert.deepEqual(kieImageModels.map(s=>imageRouteCandidates(imageCandidate(s)).map(c=>c.model)),[
  ["nano-banana-2-1","google/gemini-nano-banana-2.1"],["gpt-image-2-5-sunburst-image-to-image","openai/gpt-image-2.5-sunburst"],["nano-banana-2","google/gemini-3.1-flash-image"],["nano-banana-pro","google/gemini-3-pro-image"],["qwen3/image-to-image","qwen/qwen-image-3.0"]
 ]);
 for(const m of zenmuxImageModels)assert.equal(imageRouteCandidates(m.candidate)[0].provider,"kie");
 assert.equal(candidatesFor("scene-main","zenmux")[0].provider,"kie");
});
for(const failure of [new GatewayError("kie","上游服务异常",503),new GatewayError("kie","网络超时",500,true,true),new GatewayError("kie","任务失败",500)])test("KIE失败切换同款ZenMux一次："+failure.message,async()=>{
 const h=harness(),bodies:unknown[]=[];const request={prompt:"身份锁与逐张用途",references:["product-front","product-side","light-reference"],resolution:"2K",ratio:"3:4"};
 const result=await routeCall({logical:"scene-main",candidates:imageRouteCandidates(primary),configured:()=>true,...h,call:async c=>{bodies.push(structuredClone(request));if(c.provider==="kie")throw failure;return "done";}});
 assert.equal(result.candidate.provider,"zenmux");assert.equal(result.fallback,true);assert.deepEqual(bodies,[request,request]);assert.deepEqual(h.events.map(e=>e.status),["failed","success"]);
});
for(const failure of [new GatewayError("kie","参数错误",400),new GatewayError("kie","内容安全策略拒绝",500),new GatewayError("kie","余额不足",402),new GatewayError("kie","配额不足",500)])test("不可切换错误直接报错："+failure.message,async()=>{
 const h=harness(),calls:string[]=[];await assert.rejects(routeCall({logical:"scene-main",candidates:imageRouteCandidates(primary),configured:()=>true,...h,call:async c=>{calls.push(c.provider);throw failure;}}));assert.deepEqual(calls,["kie"]);
});
test("没有ZenMux同款只尝试KIE，不换别的模型；两个网关都失败不会第三次提交",async()=>{
 for(const c of [{...primary,model:"no-same-model"},primary]){const h=harness(),calls:string[]=[];await assert.rejects(routeCall({logical:"scene-main",candidates:imageRouteCandidates(c),configured:()=>true,...h,call:async next=>{calls.push(next.provider+":"+next.model);throw new GatewayError(next.provider,"失败",503);}}));assert.equal(calls.length,c.model==="no-same-model"?1:2);}
});
test("KIE熔断直接使用同款ZenMux并标记切换，不关闭模型功能",async()=>{
 const h=harness("kie"),calls:string[]=[];const r=await routeCall({logical:"scene-main",candidates:imageRouteCandidates(primary),configured:()=>true,...h,call:async c=>{calls.push(c.provider);return "done";}});assert.deepEqual(calls,["zenmux"]);assert.equal(r.fallback,true);assert.match(r.warnings.join(""),/熔断/);
});
test("只汇总成功尝试，失败真实收费/预估仍保留审计，不重复扣费；历史账单不重写",()=>{
 const attempts=[{status:"failed",costUsd:.03,credits:6,costEstimated:true},{status:"failed",costUsd:.01,credits:2,costEstimated:false},{status:"success",costUsd:.06,credits:null,costEstimated:false}];
 assert.deepEqual(imageAttemptTotals({chargeSuccessfulAttemptOnly:true},attempts),{costUsd:.06,credits:null,costEstimated:false});assert.equal(attempts[0].costUsd,.03);
 assert.equal(imageAttemptTotals({},attempts).costUsd,.1);assert.deepEqual(imageAttemptTotals({chargeSuccessfulAttemptOnly:true},attempts.slice(0,2)),{costUsd:0,credits:null,costEstimated:false});
});
test("KIE审核拒绝不因HTTP500被误判成可切换",()=>{const e=kieFailure(500,"content blocked by safety policy");assert.equal(e.retryable,false);});
test("GPT/Qwen通过官方editImage协议发送原顺序图片、提示词和原分辨率（零外网）",async()=>{
 const previous=process.env.ZENMUX_API_KEY;process.env.ZENMUX_API_KEY="local-test";
 try{for(const registry of zenmuxImageModels.filter(m=>m.candidate.imageProtocol==="vertex-edit")){
  let observed:unknown;const provider=new ZenMuxImageProvider(registry.candidate.model,{models:{generateContent:async()=>assert.fail("不得用Google generateContent调用非Google模型"),editImage:async body=>{observed=body;return {generatedImages:[{image:{imageBytes:Buffer.from("image").toString("base64")}}]};}}},async id=>({bytes:Buffer.from(id),mime:"image/png"}));
  const request:ImageRequest={prompt:"完全相同的最终提示词",referenceImages:[{id:"product"},{id:"ref-light"}],aspectRatio:"3:4",resolution:"2K",outputFormat:"png"};await provider.generate(request);
  const body=observed as {model:string;prompt:string;referenceImages:{referenceId:number;referenceImage:{imageBytes:string}}[];config:{aspectRatio:string;httpOptions:{extraBody:{resolution:string}}}};assert.equal(body.model,registry.candidate.model);assert.equal(body.prompt,request.prompt);assert.equal(body.config.aspectRatio,request.aspectRatio);assert.equal(body.config.httpOptions.extraBody.resolution,"2K");assert.deepEqual(body.referenceImages.map(r=>Buffer.from(r.referenceImage.imageBytes,"base64").toString()),["product","ref-light"]);
 }}finally{if(previous===undefined)delete process.env.ZENMUX_API_KEY;else process.env.ZENMUX_API_KEY=previous;}
});
