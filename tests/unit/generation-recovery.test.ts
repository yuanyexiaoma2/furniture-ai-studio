import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { imageCandidate, kieImageModels } from "../../src/lib/image-models";
import { GatewayError, ImageResultTransferFailure } from "../../src/lib/gateway-error";
import type { ImageGeneration } from "../../src/lib/image-provider";
import type { PgBoss } from "pg-boss";
import type { Prisma } from "../../src/generated/prisma/client";

const candidate = imageCandidate(kieImageModels[0]);
type Job = { id:string; status:string; provider:string|null; model:string|null; externalTaskId:string|null; reservedUsd:number; costUsd:number|null; input:Record<string,unknown>; error:string|null; nextPollAt:Date|null; startedAt:Date; createdById:string; logicalModel:string; productId:null; resultAssetIds:string[] };
type Attempt = { id:string; jobId:string; status:string; provider:string; model:string; externalTaskId:string|null; costUsd:number; createdAt:Date; costEstimated:boolean };
let job:Job, attempts:Attempt[], writes:number, createdAssets:number;
const snapshot=()=>({...structuredClone(job),attempts:structuredClone(attempts)});
const fake={
  $transaction:async<T>(fn:(tx:Prisma.TransactionClient)=>Promise<T>):Promise<T>=>fn(fake as unknown as Prisma.TransactionClient),
  $queryRaw:async()=>[{amount:0}], $queryRawUnsafe:async()=>[],
  $executeRaw:async(query:TemplateStringsArray)=>{if(query.join("").includes('UPDATE "GenerationAttempt"'))for(const a of attempts)if(["pending","running"].includes(a.status))a.status="failed";return 0;},
  generationJob:{
    findMany:async({where}:{where:{status:string}})=>job.status===where.status?[structuredClone(job)]:[],
    findUnique:async()=>snapshot(),findUniqueOrThrow:async()=>snapshot(),
    update:async({data}:{data:Partial<Job>})=>{writes++;Object.assign(job,data);return snapshot();},
    updateMany:async({where,data}:{where:{status?:string;startedAt?:Date};data:Partial<Job>})=>{if(where.status&&where.status!==job.status||where.startedAt&&where.startedAt.getTime()!==job.startedAt.getTime())return {count:0};writes++;Object.assign(job,data);return {count:1};},
  },
  generationAttempt:{
    findUniqueOrThrow:async({where}:{where:{id:string}})=>structuredClone(attempts.find(a=>a.id===where.id)!),
    findMany:async()=>structuredClone(attempts),
    update:async({where,data}:{where:{id:string};data:Partial<Attempt>})=>{writes++;return Object.assign(attempts.find(a=>a.id===where.id)!,data);},
    updateMany:async({where,data}:{where:{id:string;status:string};data:Partial<Attempt>})=>{const a=attempts.find(a=>a.id===where.id&&a.status===where.status);if(!a)return {count:0};writes++;Object.assign(a,data);return {count:1};},
    create:async({data}:{data:Partial<Attempt>})=>{const a={...attempts[0],id:"new-attempt",status:"running",externalTaskId:null,...data};attempts.push(a);return a;},
  },
  asset:{findMany:async()=>[],create:async()=>{createdAssets++;return {id:"result"};}},
  user:{findUniqueOrThrow:async()=>({id:"user",role:"admin",monthlyQuota:100})},
  gatewayCircuit:{findUnique:async()=>null,upsert:async()=>({})},
};
// 所有数据库操作使用内存替身，禁止连接真实数据库或调用网络。
(globalThis as unknown as {prisma:unknown}).prisma=fake;
globalThis.fetch=async()=>assert.fail("回归测试不得联网");
const {pollGatewayJob}=await import("../../src/lib/image-router");
const {recoverInterruptedJobs}=await import("../../src/lib/worker-recovery");
const {saveGenerationResult}=await import("../../src/lib/save-generation-result");
beforeEach(()=>{
  job={id:"job",status:"running",provider:"kie",model:candidate.model,externalTaskId:"old-task",reservedUsd:.03,costUsd:null,input:{chargeSuccessfulAttemptOnly:true,selectedCandidate:candidate,referenceAssetIds:[],prompt:"测试",aspect_ratio:"1:1",resolution:"2K",output_format:"png"},error:null,nextPollAt:null,startedAt:new Date(),createdById:"user",logicalModel:"scene-main",productId:null,resultAssetIds:[]};
  attempts=[{id:"old-attempt",jobId:job.id,status:"pending",provider:"kie",model:candidate.model,externalTaskId:"old-task",costUsd:.03,createdAt:new Date(),costEstimated:true}];writes=0;createdAssets=0;
});
function switchToFallback(){
  attempts[0].status="failed";
  job={...job,provider:"zenmux",model:"google/gemini-nano-banana-2.1",externalTaskId:null,reservedUsd:.06,error:"备用线路运行中",input:{...job.input,autoRetryCount:1}};
  attempts.push({...attempts[0],id:"new-attempt",status:"running",provider:"zenmux",model:job.model!,externalTaskId:null,costUsd:.06});
}
for(const response of ["failure","success","pending","download-failure"] as const)test(`切换后旧KIE轮询返回${response}，不改新任务、预留或尝试`,async()=>{
  let finish!:(value:ImageGeneration)=>void,reject!:(error:Error)=>void,started!:()=>void;
  const ready=new Promise<void>(resolve=>started=resolve);
  const run=pollGatewayJob(job.id,()=>({isConfigured:()=>true,generate:async()=>assert.fail("不能再次生成"),poll:async()=>{started();return new Promise<ImageGeneration>((resolve,no)=>{finish=resolve;reject=no;});}}));
  await ready;switchToFallback();const expected=snapshot();
  if(response==="failure")reject(new GatewayError("kie","迟到的失败",503));
  else if(response==="download-failure")reject(new ImageResultTransferFailure("kie","迟到的下载失败",502));
  else finish(response==="success"?{kind:"done",images:[Buffer.from("不应落盘")]}:{kind:"pending",taskId:"old-task"});
  await run;assert.deepEqual(snapshot(),expected);assert.equal(writes,0);
});
test("旧结果转存期间切换线路，提交前再次核对并清理孤立文件",async()=>{
  const removed:string[]=[];
  await assert.rejects(saveGenerationResult(job.id,[Buffer.from("模拟图片")],{attemptId:"old-attempt",durationMs:10,estimateUsd:.03},{
    inspectPhoto:async()=>({width:10,height:10,mime:"image/png" as const,extension:"png" as const}),
    putObject:async()=>{switchToFallback();},deleteObject:async key=>{removed.push(key);},
    readObject:async()=>assert.fail("无须读取原图"),writeProductReviewSafely:async()=>null,
  }),/已切换线路/);
  assert.equal(job.status,"running");assert.equal(job.reservedUsd,.06);assert.equal(createdAssets,0);assert.equal(removed.length,1);
});
test("正常成功只记账一次，重复回执不创建第二张素材",async()=>{
  const io={inspectPhoto:async()=>({width:10,height:10,mime:"image/png" as const,extension:"png" as const}),putObject:async()=>{},deleteObject:async()=>{},readObject:async()=>assert.fail("无须读取"),writeProductReviewSafely:async()=>null};
  const meta={attemptId:"old-attempt",durationMs:10,estimateUsd:.03};
  await saveGenerationResult(job.id,[Buffer.from("模拟图片")],meta,io);
  await assert.rejects(saveGenerationResult(job.id,[Buffer.from("重复回执")],meta,io));
  assert.equal(job.status,"success");assert.equal(job.costUsd,.03);assert.equal(job.reservedUsd,0);assert.equal(createdAssets,1);
});
for(const provider of ["kie","zenmux"])test(`${provider}中断恢复释放新任务费用与预留，保留尝试审计`,async()=>{
  job.provider=provider;job.externalTaskId=null;job.reservedUsd=.06;
  const boss={cancel:async()=>{},send:async()=>assert.fail("中断任务不得重新提交")} as unknown as PgBoss;
  await recoverInterruptedJobs("worker",boss);
  assert.equal(job.status,"failed");assert.equal(job.reservedUsd,0);assert.equal(job.costUsd,0);
  assert.equal(attempts[0].costUsd,.03);assert.equal(attempts[0].status,"failed");assert.match(job.error!,/不代表供应商退款/);
});
test("旧版任务仍保留原账务规则，已有KIE任务恢复轮询不重发",async()=>{
  const boss={cancel:async()=>{},send:async()=>assert.fail("不得重新生成")} as unknown as PgBoss;
  await recoverInterruptedJobs("worker",boss);assert.equal(job.status,"running");assert.equal(job.externalTaskId,"old-task");assert.equal(job.reservedUsd,.03);
  job.provider="zenmux";job.externalTaskId=null;job.input={};
  await recoverInterruptedJobs("worker",boss);assert.equal(job.status,"failed");assert.equal(job.costUsd,.03);
});
test("当前KIE不可切换错误仍释放预留并正常结束",async()=>{
  await pollGatewayJob(job.id,()=>({isConfigured:()=>true,generate:async()=>assert.fail("不得回退"),poll:async()=>{throw new GatewayError("kie","参数错误",400);}}));
  assert.equal(job.status,"failed");assert.equal(job.costUsd,0);assert.equal(job.reservedUsd,0);
});
test("当前KIE失败仅提交一次同款ZenMux，重复旧回执不再提交",async()=>{
  process.env.ZENMUX_API_KEY="local-test";let submissions=0;
  const factory=(c:{provider:string})=>({isConfigured:()=>true,generate:async():Promise<ImageGeneration>=>{submissions++;assert.equal(c.provider,"zenmux");throw new GatewayError("zenmux","模拟失败",503);},poll:async():Promise<ImageGeneration>=>{throw new GatewayError("kie","模拟失败",503);}});
  await pollGatewayJob(job.id,factory);await pollGatewayJob(job.id,factory);
  assert.equal(submissions,1);assert.equal(job.status,"failed");assert.equal(job.reservedUsd,0);assert.equal(job.costUsd,0);
});
