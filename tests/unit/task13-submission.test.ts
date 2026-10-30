import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import {submitImmediateBatch,quoteBatch,submitBatch} from "../../src/lib/image-packs";
import {studioGenerate} from "../../src/lib/agent-actions";
import {confirmProfile} from "../../src/lib/product-profile";
import {emptyProfile} from "../../src/lib/profile-rules";
import {acknowledgeProfileConflict} from "../../src/lib/interaction-rules";
import type {Prisma} from "../../src/generated/prisma/client";
import {StudioError} from "../../src/lib/studio-error";

test("生成与失败重试不等待费用卡，沿用原报价指纹和提交编号；重复请求复用原结果",async()=>{
 const jobs=new Map<string,{batchId:string;estimatedCostUsd:number}>();let quoted=0,submitted=0;
 const deps:NonNullable<Parameters<typeof submitImmediateBatch>[5]>={replay:async(_u,_p,key)=>jobs.get(key)??null,quote:async()=>{quoted++;return {estimatedCostUsd:2.5,fingerprint:"fingerprint"} as Awaited<ReturnType<typeof quoteBatch>>;},submit:async(_u,_p,selection,fingerprint,key)=>{assert.equal(fingerprint,"fingerprint");assert(selection.slotId||selection.retryJobId);submitted++;const id="batch-"+submitted;jobs.set(key,{batchId:id,estimatedCostUsd:2.5});return id;}};
 for(const selection of [{slotId:"slot"},{retryJobId:"failed"}]){const key=JSON.stringify(selection),first=await submitImmediateBatch("u","p",selection,key,"s",deps),second=await submitImmediateBatch("u","p",selection,key,"s",deps);assert.deepEqual(second,first);assert.equal(first.submitted,true);assert.equal(first.estimatedCostUsd,2.5);assert(!("waitForUser"in first));}
 assert.equal(submitted,2);assert.equal(quoted,2);
});
test("直接批量提交仍调用原事务，额度不足原样返回，不创建等待卡",async()=>{
 let submitted=0;const deps:NonNullable<Parameters<typeof submitImmediateBatch>[5]>={replay:async()=>null,quote:async()=>({fingerprint:"f",estimatedCostUsd:.3}) as Awaited<ReturnType<typeof quoteBatch>>,submit:async()=>{submitted++;throw Error("本月额度不足");}};
 await assert.rejects(submitImmediateBatch("u","p",{},"key","s",deps),/额度不足/);assert.equal(submitted,1);assert.equal(typeof submitBatch,"function");
});
test("报价与提交间价格变化只自动刷新一次，仍用原请求号，不绕过最终指纹校验",async()=>{
 let quotes=0;const submitted:string[]=[];
 const deps:NonNullable<Parameters<typeof submitImmediateBatch>[5]>={replay:async()=>null,quote:async()=>({fingerprint:"f"+(++quotes),estimatedCostUsd:.03}) as Awaited<ReturnType<typeof quoteBatch>>,submit:async(_u,_p,_s,fingerprint,key)=>{assert.equal(key,"stable");submitted.push(fingerprint);if(submitted.length===1)throw new StudioError("图位、身份特征或价格已变化，请重试生成",409);return "batch";}};
 assert.equal((await submitImmediateBatch("u","p",{},"stable","s",deps)).batchId,"batch");assert.deepEqual(submitted,["f1","f2"]);assert.equal(quotes,2);
});
test("逐张模式返回两个选择，不切换模式、不报价或提交",async()=>{
 const deps={session:async()=>({id:"s",mode:"manual"}),switchToBatch:async()=>assert.fail("不得自动切换"),pack:async()=>assert.fail("不读取图位"),submit:async()=>assert.fail("不提交") } as unknown as NonNullable<Parameters<typeof studioGenerate>[4]>;
 assert.deepEqual(await studioGenerate("p","u",undefined,"key",deps),{modeChoiceRequired:true});
});
test("切回整套才更新模式并提交，当前图位只生成有效的第一个未定稿图位",async()=>{
 let switched=0;const submitted:unknown[]=[];const slot={id:"current",method:"ai_scene",goal:"场景",finalAssetId:null,visualPlan:{confirmationCardId:"plan"},candidateCount:2};
 const deps={session:async()=>({id:"s",mode:"manual"}),switchToBatch:async()=>{switched++;},pack:async()=>({confirmedPlanId:"plan",slots:[{...slot,id:"old",visualPlan:{confirmationCardId:"old"}},slot]}),submit:async(_session: string,action:unknown,key:string)=>{submitted.push({action,key});return {submitted:true};}} as unknown as NonNullable<Parameters<typeof studioGenerate>[4]>;
 await studioGenerate("p","u","current","one",deps);assert.equal(switched,0);assert.deepEqual(submitted[0],{action:{operation:"generate_slot",slotId:"current",count:2},key:"one"});
 await studioGenerate("p","u","batch","all",deps);assert.equal(switched,1);assert.deepEqual(submitted[1],{action:{operation:"generate_batch"},key:"all"});
});
test("冲突未核实仍禁止保存，明确核实后能生成正式档案且保留用户值",async()=>{
 const profile=emptyProfile();profile.dimensions={value:"80cm",status:"inferred",sources:[{kind:"document",id:"doc",quote:"80cm"}],conflicts:[{value:"90cm",source:{kind:"document",id:"other",quote:"90cm"}}]};let saved=0;
 const tx={$executeRaw:async()=>{},productProfile:{findFirst:async()=>null,create:async({data}:{data:unknown})=>{saved++;return data;}},productIdentityVersion:{create:async()=>({id:"identity"})},product:{update:async()=>{}}} as unknown as Prisma.TransactionClient;
 await assert.rejects(confirmProfile(tx,"p","u",profile),/冲突/);assert.equal(saved,0);
 const resolved=acknowledgeProfileConflict(profile,"dimensions",true,profile.dimensions);await confirmProfile(tx,"p","u",resolved);assert.equal(saved,1);assert.equal(resolved.dimensions.value,"80cm");assert.equal(profile.dimensions.conflicts.length,1);
});
