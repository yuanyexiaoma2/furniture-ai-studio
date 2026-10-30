import {test} from "node:test";import assert from "node:assert/strict";
import {passedProbe,agentCanBeUsed,userSelectedAgent,imageRetryAllowed,uploadIssue} from "../../src/lib/studio-rules";
import {FEATURE_WEB_RESEARCH} from "../../src/lib/project-features";
import {DEFAULT_AGENT} from "../../src/lib/agent-default";
import {agentToolSchemas,llmAgentTools} from "../../src/lib/agent-tool-schemas";
import {PromptComposer} from "../../src/design-preview/library/prompt-composer";
import {seedProducts,seedScenes,seedProps,seedPropSets,administrator} from "../../src/design-preview/mock/library";
test("模型开放需20次样本、至少95%参数和格式正确及20轮上下文通过",()=>{assert.equal(passedProbe({toolCalls:20,formatCorrect:20,parameterCorrect:19,contextStable:20}),true);for(const p of [{toolCalls:19,formatCorrect:20,parameterCorrect:20,contextStable:20},{toolCalls:20,formatCorrect:20,parameterCorrect:18,contextStable:20},{toolCalls:20,formatCorrect:18,parameterCorrect:20,contextStable:20},{toolCalls:20,formatCorrect:20,parameterCorrect:20,contextStable:19},{}])assert.equal(passedProbe(p),false);});
test("项目或会话关闭联网时不暴露web_search；输入长度和数量仍验证",()=>{assert(!llmAgentTools(false).some(t=>t.function.name==="web_search"));assert.equal(llmAgentTools(true).some(t=>t.function.name==="web_search"),FEATURE_WEB_RESEARCH);assert(!agentToolSchemas.web_search.safeParse({query:"",max_results:3}).success);assert(!agentToolSchemas.web_search.safeParse({query:"产品",max_results:6}).success);});

test("用户指定的ZenMux默认Agent可用，KIE探测和其他未验证模型不被放行",()=>{
 const kieProbe={toolCalls:20,formatCorrect:19,parameterCorrect:16,contextStable:20};
 assert.equal(passedProbe(kieProbe),false);
 assert.equal(agentCanBeUsed(DEFAULT_AGENT.id,DEFAULT_AGENT.candidate,{}),true);
 assert.equal(userSelectedAgent(DEFAULT_AGENT.id,{...DEFAULT_AGENT.candidate,provider:"kie"}),false);
 assert.equal(agentCanBeUsed("agent-flash",{provider:"kie",model:"gemini-3-8-flash-openai"},kieProbe),false);
 assert.equal(agentCanBeUsed("agent-zenmux",{provider:"zenmux",model:"google/gemini-2.5-pro"},{}),false);
 assert.equal(agentCanBeUsed(DEFAULT_AGENT.id,{provider:"zenmux",model:"other"},{}),false);
});
test("未知尺寸不编造测量值，锁定外观始终进入真实组合提示词",()=>{const product=structuredClone(seedProducts[0]);product.dimensions={width:0,depth:0,height:0,unit:"cm"};const input={template:seedScenes[0],product,propSets:seedPropSets.filter(s=>s.id==="G01"),props:seedProps,variables:{},actor:administrator};assert.throws(()=>PromptComposer.compose(input));const composed=PromptComposer.compose({...input,dimensionsUnknown:true});assert(composed.finalPrompt.includes("dimensions unknown"));assert(!composed.finalPrompt.includes("0 × 0"));assert(composed.finalPrompt.includes("Locked product features:"));assert.equal(composed.originalPhotoIds.length,product.photos.length);assert.equal(PromptComposer.compose({...input,dimensionsUnknown:true}).finalPrompt,composed.finalPrompt);});

test("仅已知失败自动重试一次，未知扣费、断网与参考重传不能叠加付费重试",()=>{assert(imageRetryAllowed({},true,false));assert(!imageRetryAllowed({autoRetryCount:1},true,false));assert(!imageRetryAllowed({referenceRetryCount:1},true,false));assert(!imageRetryAllowed({},true,true));assert(!imageRetryAllowed({},false,false));});

test("上传上限同时检查文件名和MIME，不能绕过成5/3，限制单文件和整批大小",()=>{const file={name:"photo.jpg",type:"",size:100};assert.equal(uploadIssue([file,file,file]),null);assert.match(uploadIssue([file,file,file,file])??"",/3张/);assert.match(uploadIssue([{...file,size:31*1024*1024}])??"",/30MB/);assert.match(uploadIssue(Array.from({length:16},()=>({...file,name:"d.pdf"})))??"",/15/);assert.match(uploadIssue(Array.from({length:4},()=>({...file,name:"d.pdf",size:26*1024*1024})))??"",/100MB/);});
