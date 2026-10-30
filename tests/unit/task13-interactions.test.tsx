import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {QuestionsCard,ProfileForm} from "../../src/components/design-preview/interaction-cards";
import {acknowledgeProfileConflict,questionsComplete,validateQuestionAnswers,currentGenerationSlot,imageCostLabel,type UserQuestion} from "../../src/lib/interaction-rules";
import {emptyProfile} from "../../src/lib/profile-rules";
import {submitEditImmediately,type EditSelection} from "../../src/lib/direct-submission";
import {gatewayTestSchema,gatewayTestEstimate} from "../../src/lib/gateway-test-rules";
import {GatewayManager} from "../../src/components/gateway-manager";
Object.assign(globalThis,{React});

const questions:UserQuestion[]=[{question:"尺寸以哪份为准？",options:["说明书","参数表"],allowFreeText:false},{question:"产品颜色",options:["白色"],allowFreeText:true},{question:"其他要求",options:[],allowFreeText:true}];
test("新版多问题卡渲染全部题目、选项、自由输入和一次提交按钮",()=>{
 const html=renderToStaticMarkup(<QuestionsCard questions={questions} busy={false} onSubmit={()=>assert.fail("渲染不应提交")}/>);
 for(const q of questions)assert(html.includes(q.question));
 assert(html.includes('aria-label="问题2回答"'));assert(html.includes('aria-label="问题3回答"'));assert(!html.includes('aria-label="问题1回答"'));assert(html.includes("说明书"));assert(html.includes("参数表"));assert(html.includes("提交回答"));assert(!html.includes("确认费用"));
});
test("多题答案一次提交，漏答、长度错误和非法选项均不会放行",()=>{
 const answers=["参数表","用户填写的米色","不要金属道具"];
 assert.deepEqual(validateQuestionAnswers(answers,questions),answers);assert(questionsComplete(answers,questions));
 for(const wrong of [["参数表"],["参数表","米色"," "],["不存在的选项","米色","无"],["参数表","a".repeat(2001),"无"]]){assert(!questionsComplete(wrong,questions));assert.throws(()=>validateQuestionAnswers(wrong,questions),/全部问题/);}
});
test("档案卡展示冲突核实入口，勾选保留填写值及来源，撤销勾选恢复冲突",()=>{
 const profile=emptyProfile();profile.dimensions={value:"80cm",status:"inferred",sources:[{kind:"document",id:"p",quote:"参数表80cm"}],conflicts:[{value:"90cm",source:{kind:"document",id:"d",quote:"说明书90cm"}}]};
 const html=renderToStaticMarkup(<ProfileForm profile={profile} onSave={async()=>{}}/>);assert(html.includes("我已核实，以上填写值为准"));assert(html.includes("说明书90cm"));
 const original=structuredClone(profile),resolved=acknowledgeProfileConflict(profile,"dimensions",true,profile.dimensions);assert.equal(resolved.dimensions.value,"80cm");assert.equal(resolved.dimensions.status,"confirmed");assert.deepEqual(resolved.dimensions.conflicts,[]);assert.deepEqual(resolved.dimensions.sources,profile.dimensions.sources);assert.deepEqual(profile,original);
 const undone=acknowledgeProfileConflict(resolved,"dimensions",false,profile.dimensions);assert.deepEqual(undone.dimensions.conflicts,profile.dimensions.conflicts);
});
test("当前图位忽略人工、空意图、旧方案和已定稿，沿用顺序与用户数量",()=>{
 const slot={id:"current",method:"ai_scene",goal:"产品场景",finalAssetId:null,visualPlan:{confirmationCardId:"plan"},candidateCount:2};
 const slots=[{...slot,id:"manual",method:"manual_upload"},{...slot,id:"empty",goal:" "},{...slot,id:"old",visualPlan:{confirmationCardId:"old"}},{...slot,id:"final",finalAssetId:"asset"},slot];
 assert.equal(currentGenerationSlot(slots,"plan")?.id,"current");assert.equal(currentGenerationSlot(slots,"plan")?.candidateCount,2);assert.equal(currentGenerationSlot(slots.slice(0,4),"plan"),undefined);
});
for(const action of ["换背景","抠图","再来一张","局部重绘","消除","扩图"]){test(`${action}：内部报价后直接提交，蒙版/扩图参数和提交编号不丢失`,async()=>{
 const selection:EditSelection={assetId:"image",instruction:action,...(["局部重绘","消除"].includes(action)?{maskAssetId:"mask"}:{}),...(action==="扩图"?{expansion:{width:1200,height:900,offsetX:10,offsetY:20}}:{})};let submissions=0;
 const result=await submitEditImmediately(selection,"stable-key",{quote:async received=>{assert.deepEqual(received,selection);return {fingerprint:"frozen",estimatedCostUsd:2.5,warning:null};},submit:async received=>{submissions++;assert.deepEqual(received,{...selection,requestKey:"stable-key",fingerprint:"frozen"});return "job";}});
 assert.equal(result.result,"job");assert.equal(submissions,1);assert.equal(result.quote.estimatedCostUsd,2.5);
 });}
test("修改额度不足或报价失败直接报错，不虚报成功、不转成等待费用确认",async()=>{
 let count=0;await assert.rejects(submitEditImmediately({assetId:"a",instruction:"改光线"},"r",{quote:async()=>{throw Error("额度不足");},submit:async()=>{count++;}}),/额度不足/);assert.equal(count,0);
 await assert.rejects(submitEditImmediately({assetId:"a",instruction:"改光线"},"r",{quote:async()=>({fingerprint:"q",estimatedCostUsd:.3,warning:null}),submit:async()=>{throw Error("预留额度不足");}}),/预留额度不足/);
});
test("图片实际费用与待回填估价明确区分，真实零费用保留",()=>{
 assert.equal(imageCostLabel({costUsd:0,reservedUsd:.03,costEstimated:false}),"实际 $0.0000");assert.match(imageCostLabel({costUsd:.04,costEstimated:false}),/实际 \$0.0400/);assert.match(imageCostLabel({costUsd:.03,costEstimated:true}),/预估/);assert.match(imageCostLabel({costUsd:null,reservedUsd:.03}),/待回填/);
});
test("浏览器断网后重试沿用同一提交编号，后续刷新失败不会误报为生成失败",async()=>{
 const {useLiveStore}=await import("../../src/components/design-preview/live-store");
 const saved=useLiveStore.getState(),fetcher=globalThis.fetch;const keys:string[]=[];let first=true;
 const snapshot={product:{id:"task13-network",assets:[]},pack:{slots:[]},agent:{session:{mode:"quick"}}} as unknown as NonNullable<typeof saved.snapshot>;
 try{
  useLiveStore.setState({snapshot,busy:false});
  globalThis.fetch=async(_url,options)=>{if(options?.method==="POST"){const body=JSON.parse(String(options.body));if(body.action==="generate"){keys.push(body.data.requestKey);if(first){first=false;throw Error("连接中断，服务器可能已接收");}}return new Response(JSON.stringify({submitted:true}));}throw Error("读取进度暂时失败");};
  await assert.rejects(useLiveStore.getState().act("generate",{requestKey:"first-local"}),/连接中断/);
  await useLiveStore.getState().act("generate",{requestKey:"second-local"});assert.equal(keys.length,2);assert.equal(keys[0],keys[1]);assert.match(useLiveStore.getState().error,/已提交/);assert.equal(useLiveStore.getState().busy,false);
 }finally{globalThis.fetch=fetcher;useLiveStore.setState(saved);}
});
test("逐张选择提示不会提交任务，当前图位选择提交一次并关闭提示",async()=>{
 const {useLiveStore}=await import("../../src/components/design-preview/live-store");
 const saved=useLiveStore.getState(),fetcher=globalThis.fetch;const selections:unknown[]=[];
 const snapshot={product:{id:"task13-mode",assets:[]},pack:{slots:[]},agent:{session:{mode:"manual"}}} as unknown as NonNullable<typeof saved.snapshot>;
 try{
  useLiveStore.setState({snapshot,busy:false,generationChoiceRequired:false});
  globalThis.fetch=async(_url,options)=>{if(!options?.method)return new Response(JSON.stringify(snapshot));const body=JSON.parse(String(options.body));if(body.action==="generate"){selections.push(body.data.scope);return new Response(JSON.stringify(body.data.scope?{submitted:true}:{modeChoiceRequired:true}));}return new Response("{}");};
  await useLiveStore.getState().act("generate");assert.equal(useLiveStore.getState().generationChoiceRequired,true);
  await useLiveStore.getState().act("generate",{scope:"current"});assert.equal(useLiveStore.getState().generationChoiceRequired,false);assert.deepEqual(selections,[undefined,"current"]);
  snapshot.agent.session.mode="quick";useLiveStore.setState({generationChoiceRequired:true});await useLiveStore.getState().load(snapshot.product.id);assert.equal(useLiveStore.getState().generationChoiceRequired,false);
 }finally{globalThis.fetch=fetcher;useLiveStore.setState(saved);}
});
test("后台网关测试不需要费用确认字段，仍校验网关和测试类型",()=>{
 assert(gatewayTestSchema.safeParse({provider:"kie",kind:"image"}).success);assert(gatewayTestSchema.safeParse({provider:"zenmux",kind:"llm",confirmed:false}).success);
 assert(!gatewayTestSchema.safeParse({provider:"unknown",kind:"image"}).success);assert(!gatewayTestSchema.safeParse({provider:"kie",kind:"unknown"}).success);
 for(const provider of ["kie","zenmux"] as const)for(const kind of ["image","llm"] as const)assert((gatewayTestEstimate(provider,kind)??0)>0);
});
test("后台连通性按钮显示费用小字且没有确认弹窗，渲染本身不调用模型",()=>{
 const initial={routes:[],gateways:[{provider:"kie",configured:true,open:false,calls:0,successRate:null,averageMs:null,totals:{},rawCredits:0,imageCalls:0,llmCalls:0,active:0,pendingBills:0,unresolvedBills:0}]} as unknown as Parameters<typeof GatewayManager>[0]["initial"];
 const html=renderToStaticMarkup(<GatewayManager initial={initial}/>);assert(html.includes("预估约 $"));assert(html.includes("连通性测试"));assert(!html.includes('role="dialog"'));assert(!html.includes("确认并测试"));
});
