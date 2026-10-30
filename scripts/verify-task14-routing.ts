import "dotenv/config";
process.env.VISUAL_REVIEW_TEST_MODE="true";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {spawnSync} from "node:child_process";
import {Pool} from "pg";
import sharp from "sharp";
import {GatewayError,ImageTaskFailure,ImageResultTransferFailure} from "../src/lib/gateway-error";
import {imageCandidate,kieImageModels} from "../src/lib/image-models";
import type {ImageRequest,ImageProvider,ImageGeneration} from "../src/lib/image-provider";
import type {ModelCandidate} from "../src/lib/models.config";

const original=process.env.DATABASE_URL;
if(!original||!["localhost","127.0.0.1"].includes(new URL(original).hostname))throw Error("只允许本地隔离数据库");
const database="verify_task14_"+randomUUID().replaceAll("-",""),pool=new Pool({connectionString:original});
await pool.query(`CREATE DATABASE "${database}"`);const url=new URL(original);url.pathname="/"+database;process.env.DATABASE_URL=url.href;
process.env.ZENMUX_API_KEY=process.env.KIE_API_KEY="isolated-no-real-key";process.env.ZENMUX_BASE_URL=process.env.KIE_BASE_URL=process.env.ZENMUX_VERTEX_BASE_URL="http://127.0.0.1:9";
let cleanup:(()=>Promise<void>)|undefined;
try{
 const migrated=spawnSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env:process.env,encoding:"utf8"});if(migrated.status)throw Error(migrated.stderr);
 const {db}=await import("../src/lib/db"),{submitGatewayJob,pollGatewayJob}=await import("../src/lib/image-router"),{getBoss,expireOverdueJobs}=await import("../src/lib/generation-queue"),{deleteObject}=await import("../src/lib/storage"),{studioCatalog}=await import("../src/lib/studio-models"),{configureTask14Models}=await import("../src/lib/configure-task14-models"),{setModelVisibility}=await import("../src/lib/model-visibility"),{gatewayStatus}=await import("../src/lib/gateway-status");
 cleanup=async()=>{for(const a of await db.asset.findMany({where:{type:"generated"}}))await deleteObject(a.storageKey);await(await getBoss()).stop();await db.$disconnect();};
 await db.studioModel.createMany({data:[{id:"agent-flash",name:"Gemini 3.8 Flash",kind:"agent",visible:false,candidate:{provider:"kie",model:"gemini-3-8-flash-openai"},probe:{toolCalls:20,parameterCorrect:16,contextStable:20}},{id:"agent-zenmux-flash",name:"Gemini 3.8 Flash",kind:"agent",visible:true,candidate:{provider:"zenmux",model:"google/gemini-3.8-flash"},probe:{}}]});
 await configureTask14Models();await db.studioModel.update({where:{id:"agent-haiku"},data:{probe:{toolCalls:20,parameterCorrect:0,contextStable:0}}});await setModelVisibility("agent-haiku",true,db.studioModel);
 const catalog=await studioCatalog(true);assert.equal(catalog.filter(m=>m.name==="Gemini 3.8 Flash").length,1);assert(catalog.find(m=>m.name==="Gemini 3.8 Flash")!.isDefault);assert((await studioCatalog()).some(m=>m.id==="agent-haiku"));
 const canonical=await db.studioModel.findUniqueOrThrow({where:{id:"agent-zenmux-flash"}});assert(JSON.stringify(canonical.probe).includes('"parameterCorrect":16'));
 const {databaseCircuit}=await import("../src/lib/gateway-circuit");
 const image=await sharp({create:{width:64,height:64,channels:3,background:"#888888"}}).png().toBuffer();let cases=0;
 async function runCase(name:string,options:{failure?:GatewayError;pending?:boolean;pollFailure?:GatewayError;bothFail?:boolean;noPartner?:boolean;expire?:boolean;download?:boolean}){
  // 独立场景清理熔断状态，不能让前一个故障测试跳过本场景待验证的KIE错误。
  await databaseCircuit.success("kie");await databaseCircuit.success("zenmux");
  const user=await db.user.create({data:{name:"隔离路由"+name,email:randomUUID()+"@example.invalid",passwordHash:"not-a-login",monthlyQuota:.07}}),product=await db.product.create({data:{sku:randomUUID(),name,category:"测试家具",dimensions:"未知",colors:"木色",materials:"木",sellingPoints:[],createdById:user.id}});
  const refs=[];for(const type of ["photo","photo","style_ref"] as const)refs.push(await db.asset.create({data:{productId:product.id,createdById:user.id,type,storageKey:"unused-test-input/"+randomUUID(),width:64,height:64}}));
  const selected=imageCandidate(kieImageModels[0]);if(options.noPartner)selected.model="no-same-model";
  const input={selectedCandidate:selected,prompt:"锁定本产品；第三张只参考光线，不搬用其中家具",referenceAssetIds:refs.map(r=>r.id),referenceUsage:refs.map(r=>({assetId:r.id,role:r.type==="photo"?"product":"reference",purpose:r.type==="photo"?"身份一致":"只参考光线"})),aspect_ratio:"1:1",resolution:"2K",output_format:"png",submissionAttempted:false};
  const job=await db.generationJob.create({data:{productId:product.id,createdById:user.id,logicalModel:"scene-main",reservedUsd:.03,deadlineAt:new Date(Date.now()+600000),input}}),calls:string[]=[],requests:ImageRequest[]=[];
  const factory=(candidate:ModelCandidate):ImageProvider=>({isConfigured:()=>true,generate:async request=>{
   calls.push(candidate.provider);requests.push(structuredClone(request));
   if(candidate.provider==="kie"){
    if(options.pending||options.expire||options.download)return {kind:"pending",taskId:"local-existing-task"};
    if(options.failure)throw options.failure;
    return {kind:"done",images:[image],cost:{amount:6,currency:"credits"}};
   }
   if(options.bothFail)throw new GatewayError("zenmux","备用失败",503);
   const active=await db.generationJob.findUniqueOrThrow({where:{id:job.id}});assert(Number(active.reservedUsd)<.07,"失败预留不得叠加到备用预算");assert.equal(Number(active.costUsd),0);
   return {kind:"done",images:[image],cost:{amount:.06,currency:"USD"}};
  },poll:async():Promise<ImageGeneration>=>{if(options.download)throw new ImageResultTransferFailure("kie","结果已成功但下载失败",502,true);throw options.pollFailure??new ImageTaskFailure("kie","KIE任务失败",500);}});
  await submitGatewayJob(job.id,factory);
  if(options.pending||options.download)await pollGatewayJob(job.id,factory);
  if(options.expire){await db.generationJob.update({where:{id:job.id},data:{deadlineAt:new Date(Date.now()-1000)}});await expireOverdueJobs();assert.equal((await db.generationJob.findUniqueOrThrow({where:{id:job.id}})).status,"pending");await submitGatewayJob(job.id,factory);}
  const result=await db.generationJob.findUniqueOrThrow({where:{id:job.id},include:{attempts:true}});
  if(options.download){assert.equal(result.status,"running");assert.deepEqual(calls,["kie"]);await db.generationJob.update({where:{id:job.id},data:{status:"failed",costUsd:0,reservedUsd:0}});}
  else if(options.noPartner||options.bothFail||options.failure&&!options.failure.retryable){assert.equal(result.status,"failed");assert.equal(Number(result.costUsd),0);assert.equal(Number(result.reservedUsd),0);assert.equal(calls.length,options.bothFail?2:1);}
  else if(options.failure||options.pending||options.expire){assert.equal(result.status,"success");assert.deepEqual(calls,["kie","zenmux"]);assert.equal(result.provider,"zenmux");assert.equal(result.fallback,true);assert.equal(Number(result.costUsd),.06);assert.equal(Number(result.reservedUsd),0);assert.deepEqual(requests[0],requests[1]);assert.match(String((result.input as {switchReason?:string}).switchReason),/KIE|超时|失败|超时/);assert.equal(result.attempts.length,2);}
  else{assert.equal(result.status,"success");assert.deepEqual(calls,["kie"]);assert.equal(Number(result.costUsd),.03);}
  cases++;console.log("通过："+name);
 }
 await runCase("KIE成功不切换",{});
 const actualFailure=new GatewayError("kie","KIE 503失败",503);actualFailure.cost={amount:6,currency:"credits"};
 await runCase("KIE 503切同款，失败实际消耗只留审计，不叠加成功费用",{failure:actualFailure});
 await runCase("KIE提交超时切同款一次",{failure:new GatewayError("kie","KIE网络超时",500,true,true)});
 for(const [code,name]of [[400,"参数错误"],[422,"安全审核拒绝"],[402,"额度不足"]] as const)await runCase(name+"不切换且释放预留",{failure:new GatewayError("kie",name,code,false)});
 await runCase("没有同款直接报错",{failure:new GatewayError("kie","KIE失败",503),noPartner:true});
 await runCase("两个网关失败仅两次提交且失败费用为零",{failure:new GatewayError("kie","KIE失败",503),bothFail:true});
 await runCase("异步任务失败切同款",{pending:true});
 await runCase("查询网络超时切同款",{pending:true,pollFailure:new GatewayError("kie","查询超时",500,true,true)});
 await runCase("10分钟超时沿用同一任务和原队列切换一次",{expire:true});
 await runCase("已生成结果下载失败只下载原任务，不再收费生成",{download:true});
 const statuses=await gatewayStatus();assert.equal(statuses.gateways.find(g=>g.provider==="kie")!.totals.USD.amount,.03);assert.equal(await db.llmCall.count(),0);
 console.log(`全部${cases}个隔离路由/费用场景及模型目录检查通过；未调用真实模型。`);
}finally{await cleanup?.();await pool.query(`DROP DATABASE "${database}" WITH (FORCE)`);await pool.end();}
