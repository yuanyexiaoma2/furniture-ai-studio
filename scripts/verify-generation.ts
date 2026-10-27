import "dotenv/config";
import {fixture} from "../tests/fixtures/visual-plan";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { Pool } from "pg";
import sharp from "sharp";

// 所有任务在随机隔离数据库运行；KIE 仅连接本地模拟服务，不发起付费请求。
const originalUrl = process.env.DATABASE_URL;
if (!originalUrl || !["localhost", "127.0.0.1"].includes(new URL(originalUrl).hostname)) throw new Error("验收只允许本地数据库");
const databaseName = `verify_generation_${randomUUID().replaceAll("-", "")}`;
const pool = new Pool({ connectionString: originalUrl });
await pool.query(`CREATE DATABASE "${databaseName}"`);
const isolatedUrl = new URL(originalUrl); isolatedUrl.pathname = `/${databaseName}`;
process.env.DATABASE_URL = isolatedUrl.href;
process.env.KIE_API_KEY = "local-test-valid-key";
process.env.KIE_CALLBACK_URL = "";
process.env.ZENMUX_API_KEY = "";
process.env.GATEWAY_PREFERENCE = "zenmux";
process.env.PG_BOSS_SCHEMA = "pgboss";
let uploads = 0, submissions = 0;
let mode: "pending" | "success" | "network" | "fail" | "reference-fail" = "pending";
let failureEndpoint = "", failureCode = 500, failureMessage = "Content blocked by safety policy";
let submitted: Record<string, unknown> | null = null;
const mock = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (request.url?.includes("createTask")) submitted = JSON.parse(Buffer.concat(chunks).toString());
  if (request.headers.authorization !== "Bearer local-test-valid-key") { response.writeHead(401); response.end(JSON.stringify({ code: 401 })); return; }
  if (failureEndpoint && request.url?.includes(failureEndpoint)) { response.end(JSON.stringify({ code: failureCode, msg: failureMessage })); return; }
  if (request.url?.includes("chat/completions")) { response.end(JSON.stringify({ choices: [{ message: { content: "模拟问候" } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }, credits_consumed: 0.1 })); return; }
  if (request.url?.includes("createTask")) {
    submissions++;
    if (mode === "network") { request.socket.destroy(); return; }
    response.end(JSON.stringify({ code: 200, data: { taskId: `local-test-task-${submissions}` } })); return;
  }
  if (request.url?.includes("file-stream-upload")) {
    uploads++; response.end(JSON.stringify({ code: 200, success: true, data: { downloadUrl: `https://fixture.invalid/reference-${uploads}.png` } })); return;
  }
  response.end(JSON.stringify({ code: 200, data: { creditsConsumed: mode === "success" ? 6 : mode === "reference-fail" ? 0 : undefined, state: mode === "success" ? "success" : mode === "fail" || mode === "reference-fail" ? "fail" : "generating", failMsg: mode === "reference-fail" ? "Failed to download reference image: URL expired" : "模拟内容拦截", resultJson: JSON.stringify({ resultUrls: ["https://fixture.invalid/result.png"] }) } }));
});
await new Promise<void>((resolve) => mock.listen(0, "127.0.0.1", resolve));
const address = mock.address();
if (!address || typeof address === "string") throw new Error("模拟服务启动失败");
process.env.KIE_BASE_URL = process.env.KIE_UPLOAD_BASE_URL = `http://127.0.0.1:${address.port}`;
let cleanup: (() => Promise<void>) | undefined, testHeartbeat:NodeJS.Timeout|undefined;
try {
  const migration = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env: process.env, encoding: "utf8" });
  if (migration.status !== 0) throw new Error("隔离验收数据库迁移失败");
  const { db } = await import("../src/lib/db");
  const { getBoss, SUBMIT_QUEUE, WORKER_ID, expireOverdueJobs } = await import("../src/lib/generation-queue");
  const { createSceneJob:submitSceneWithSnapshot, createEditJob, generationAvailability, quotaMonth } = await import("../src/lib/scene-generation");
  async function frozenScene(productId:string,intent:string){
    const p=await db.product.findUniqueOrThrow({where:{id:productId}}),photos=await db.asset.findMany({where:{productId,type:"photo",deletedAt:null},orderBy:[{sortOrder:"asc"},{createdAt:"asc"},{id:"asc"}],take:3}),version=await db.productIdentityVersion.findFirst({where:{productId},orderBy:[{savedAt:"desc"},{id:"desc"}]});
    const plan={...fixture,productId,identityLock:{...fixture.identityLock,traits:p.identityTraits??"未知",referenceAssetIds:photos.map(a=>a.id),identityVersionId:version?.id??null},slots:[{...fixture.slots[0],display:intent}]};return {plan,slot:plan.slots[0]};
  }
  const createSceneJob=async(userId:string,productId:string,intent:string,ratio:Parameters<typeof submitSceneWithSnapshot>[3],resolution:Parameters<typeof submitSceneWithSnapshot>[4]="2K")=>submitSceneWithSnapshot(userId,productId,intent,ratio,resolution,await frozenScene(productId,intent));
  const { reorderProductPhotos, removeProductPhoto } = await import("../src/lib/product-photos");
  const { productSnapshot } = await import("../src/lib/product-data");
  const { sceneSchema } = await import("../src/lib/product-validation");
  const { sceneAspectRatios, models } = await import("../src/lib/models.config");
  const { submitSceneJob, pollSceneJob } = await import("../src/lib/generation-worker");
  const { KieProvider } = await import("../src/lib/kie-provider");
  const { kieRequest, safeKieMessage } = await import("../src/lib/kie-http");
  const { inspectPhoto, putObject, readObject, deleteObject } = await import("../src/lib/storage");
  const boss = await getBoss();
  const keys: string[] = [];
  cleanup = async () => { if(testHeartbeat)clearInterval(testHeartbeat); for (const asset of await db.asset.findMany()) keys.push(asset.storageKey); for (const key of new Set(keys)) await deleteObject(key); await boss.stop(); await db.$disconnect(); };
  const user = await db.user.create({ data: { name: "隔离验收", email: "test@example.invalid", passwordHash: "never-login", monthlyQuota: 0.03 } });
  const product = await db.product.create({ data: { sku: "SIMULATION-ONLY", name: "模拟测试商品", category: "测试", dimensions: "测试", colors: "测试", materials: "测试", sellingPoints: [], identityTraits: "模拟身份特征，仅自动测试", createdById: user.id } });
  for (let i = 0; i < 2; i++) {
    const bytes = await sharp({ create: { width: 64, height: 64, channels: 3, background: i ? "#ffffff" : "#eeeeee" } }).png().toBuffer();
    const key = `verification/${databaseName}/reference-${i}.png`; keys.push(key);
    await putObject(key, bytes, "image/png");
    await db.asset.create({ data: { productId: product.id, type: "photo", width: 64, height: 64, storageKey: key, createdById: user.id } });
  }
  await assert.rejects(createSceneJob(user.id, product.id, "测试", "1:1"), /worker/);
  await db.workerHeartbeat.create({ data: { id: WORKER_ID, instanceId: "isolated-test" } });
  testHeartbeat=setInterval(()=>{void db.workerHeartbeat.update({where:{id:WORKER_ID},data:{updatedAt:new Date()}}).catch(()=>undefined);},5000);
  const currentKey = process.env.KIE_API_KEY; delete process.env.KIE_API_KEY;
  await assert.rejects(createSceneJob(user.id, product.id, "测试", "1:1"), /API Key/); process.env.KIE_API_KEY = currentKey;
  const results = await Promise.allSettled(Array.from({ length: 3 }, () => createSceneJob(user.id, product.id, "隔离场景意图", "3:4")));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected" && /配额不足/.test(result.reason.message)).length, 2);
  const first = results.find((result) => result.status === "fulfilled")!;
  assert.equal(first.status, "fulfilled");
  const jobId = (first as PromiseFulfilledResult<string>).value;
  const queueRows = await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*) FROM pgboss.job WHERE name = '${SUBMIT_QUEUE}'`);
  assert.equal(Number(queueRows[0].count), 1);
  assert.equal((await generationAvailability(user.id)).remaining, 0);
  console.log("通过：并发配额与 GenerationJob / pg-boss 事务入队");

  process.env.KIE_API_KEY = "local-test-wrong-key";
  const provider = () => new KieProvider();
  await submitSceneJob(jobId, provider);
  let job = await db.generationJob.findUniqueOrThrow({ where: { id: jobId } });
  assert.equal(job.status, "failed"); assert.equal(Number(job.reservedUsd), 0); assert.match(job.error!, /密钥无效/); assert.equal(submissions, 0);
  process.env.KIE_API_KEY = currentKey;
  console.log("通过：模拟错误密钥明确失败，释放积分，不提交付费任务");

  const restored = await createSceneJob(user.id, product.id, "模拟恢复", "1:1");
  await submitSceneJob(restored, provider);
  assert.equal(uploads, 2); assert.equal(submissions, 1);
  assert.equal(submitted!.model, "nano-banana-2-1");
  const requestInput = submitted!.input as Record<string, unknown>;
  assert.equal(requestInput.resolution, "2K"); assert.equal(requestInput.output_format, "png"); assert.equal((requestInput.image_input as string[]).length, 2);
  await pollSceneJob(restored, provider);
  assert.equal((await db.generationJob.findUniqueOrThrow({ where: { id: restored } })).status, "running");
  mode = "success";
  await pollSceneJob(restored, () => new KieProvider(undefined, async () => { throw new Error("模拟转存网络错误"); }));
  assert.equal((await db.generationJob.findUniqueOrThrow({ where: { id: restored } })).status, "running");
  const resultBytes = await sharp({ create: { width: 2048, height: 2048, channels: 3, background: "#dddddd" } }).png().toBuffer();
  await pollSceneJob(restored, () => new KieProvider(undefined, async () => resultBytes));
  job = await db.generationJob.findUniqueOrThrow({ where: { id: restored } });
  assert.equal(job.status, "success"); assert.equal(Number(job.reservedUsd), 0);
  assert.equal(job.provider, "kie"); assert.equal(Number(job.costUsd), 0.03); assert.equal(Number(job.credits), 6); assert.equal(job.fallback, false);
  const firstAttempts = await db.generationAttempt.findMany({ where: { jobId: restored } }); assert.equal(firstAttempts.length, 1); assert.equal(firstAttempts[0].status, "success");
  const asset = await db.asset.findUniqueOrThrow({ where: { id: (job.resultAssetIds as string[])[0] } });
  assert.equal(asset.width, 2048); assert.equal(asset.height, 2048); assert.deepEqual((await readObject(asset.storageKey)).bytes, resultBytes);
  console.log("通过：恢复提交、轮询、转存重试、真实 MinIO 写入与成功事务（模拟图）");

  await db.user.update({ where: { id: user.id }, data: { monthlyQuota: 0.3 } });
  const send = boss.send.bind(boss);
  boss.send = (async () => null) as typeof boss.send;
  const count = await db.generationJob.count();
  await assert.rejects(createSceneJob(user.id, product.id, "模拟入队失败", "1:1"), /未能入队/);
  assert.equal(await db.generationJob.count(), count);
  boss.send = send;
  mode = "network";
  const uncertain = await createSceneJob(user.id, product.id, "模拟提交断网", "1:1");
  await submitSceneJob(uncertain, provider);
  job = await db.generationJob.findUniqueOrThrow({ where: { id: uncertain } });
  assert.equal(job.status, "failed"); assert.equal(Number(job.reservedUsd), 0.03); assert.equal(submissions, 2); assert.equal(uploads, 2);
  console.log("通过：入队失败事务回滚、上传缓存、提交断网不重发且保留预留");

  mode = "pending";
  const expiredQueued = await createSceneJob(user.id, product.id, "模拟排队超时", "1:1");
  const expiredSubmitted = await createSceneJob(user.id, product.id, "模拟提交超时", "1:1");
  await submitSceneJob(expiredSubmitted, provider);
  await db.generationJob.updateMany({ where: { id: { in: [expiredQueued, expiredSubmitted] } }, data: { createdAt: new Date(Date.now() - 11 * 60000), deadlineAt: new Date(Date.now() - 1) } });
  await expireOverdueJobs();
  assert.equal(Number((await db.generationJob.findUniqueOrThrow({ where: { id: expiredQueued } } )).reservedUsd), 0);
  assert.equal(Number((await db.generationJob.findUniqueOrThrow({ where: { id: expiredSubmitted } } )).reservedUsd), 0.03);
  for (const ratio of sceneAspectRatios) assert.equal(sceneSchema.safeParse({ sceneIntent: "测试全部比例", aspectRatio: ratio, resolution: "4K" }).success, true);
  assert.equal(sceneSchema.safeParse({ sceneIntent: "测试", resolution: "8K" }).success, false);
  const photos = await db.asset.findMany({ where: { productId: product.id, type: "photo", deletedAt: null }, orderBy: { createdAt: "asc" } });
  const reverse = photos.map((photo) => photo.id).reverse();
  await reorderProductPhotos(product.id, reverse);
  assert.deepEqual((await productSnapshot(product.id))!.photos.map((photo) => photo.id), reverse);
  await assert.rejects(reorderProductPhotos(product.id, [reverse[0], reverse[0]]), /变更/);
  await assert.rejects(createEditJob(user.id, product.id, "修改", "1:1", "4K", { sourceJobId: restored, sourceAssetId: photos[0].id }), /已完成的生成/);
  const editId = await createEditJob(user.id, product.id, "将背景改为暖白色，保留产品", "21:9", "4K", { sourceJobId: restored, sourceAssetId: asset.id });
  const edit = await db.generationJob.findUniqueOrThrow({ where: { id: editId } });
  assert.equal(Number(edit.reservedUsd), 0.045); assert.equal(edit.logicalModel, "edit");
  const editInput = edit.input as Record<string, unknown>;
  const sourceSnapshot=await db.generationJob.findUniqueOrThrow({where:{id:restored}});
  assert.deepEqual(editInput.referenceAssetIds, [asset.id, ...(sourceSnapshot.input as {referenceAssetIds:string[]}).referenceAssetIds]);
  assert.equal(editInput.sourceJobId, restored); assert.equal(editInput.sourceAssetId, asset.id); assert.match(String(editInput.prompt), /第一张参考图/);
  const used = (await generationAvailability(user.id)).used;
  await db.user.update({ where: { id: user.id }, data: { monthlyQuota: used + 0.04 } });
  await assert.rejects(createSceneJob(user.id, product.id, "4K额度不足", "8:1", "4K"), /配额不足/);
  await db.user.update({ where: { id: user.id }, data: { monthlyQuota: 0.3 } });
  // 删除后仍可执行已排队的编辑：任务已保存参考快照，文件被保留。
  await removeProductPhoto(product.id, reverse[0]);
  assert.equal((await productSnapshot(product.id))!.photos.length, 1);
  assert.ok((await db.asset.findUniqueOrThrow({ where: { id: reverse[0] } })).deletedAt);
  await assert.rejects(removeProductPhoto(product.id, asset.id), /不存在/);
  mode = "pending";
  await submitSceneJob(editId, provider);
  assert.equal((submitted!.input as Record<string, unknown>).resolution, "4K");
  assert.equal((submitted!.input as Record<string, unknown>).aspect_ratio, "21:9");
  assert.equal(((submitted!.input as Record<string, unknown>).image_input as string[]).length, 3);
  mode = "success";
  await pollSceneJob(editId, () => new KieProvider(undefined, async () => resultBytes));
  const edited = await db.generationJob.findUniqueOrThrow({ where: { id: editId } });
  assert.equal(edited.status, "success"); assert.notDeepEqual(edited.resultAssetIds, job.resultAssetIds);
  assert.deepEqual((await db.generationJob.findUniqueOrThrow({ where: { id: restored } })).resultAssetIds, [asset.id]);
  const replacementKey = `verification/${databaseName}/replacement.png`; keys.push(replacementKey);
  const replacement = (await readObject(photos[0].storageKey)).bytes;
  await putObject(replacementKey, replacement, "image/png");
  await db.asset.create({ data: { productId: product.id, type: "photo", storageKey: replacementKey, width: 64, height: 64, createdById: user.id, sortOrder: 2 } });
  const nextVersion = await createEditJob(user.id, product.id, "继续调整光线", "auto", "2K", { sourceJobId: editId, sourceAssetId: (edited.resultAssetIds as string[])[0] });
  assert.equal((await db.generationJob.findUniqueOrThrow({ where: { id: nextVersion } })).logicalModel, "edit");
  console.log("通过：全部比例、4K定价与配额、排序快照、删除保留旧任务、原图编辑和连续版本");
  const { submitGatewayJob, pollGatewayJob } = await import("../src/lib/image-router");
  const { GatewayError } = await import("../src/lib/gateway-error");
  const { databaseCircuit, gatewayCircuitState } = await import("../src/lib/gateway-circuit");
  const { chatWithGateway } = await import("../src/lib/llm-router");
  await db.user.update({ where: { id: user.id }, data: { monthlyQuota: 5 } });
  process.env.ZENMUX_API_KEY = "local-test-zenmux"; process.env.GATEWAY_PREFERENCE = "zenmux";
  // 当前默认生图走KIE；同步主线路回归显式指定ZenMux，避免依赖旧auto顺序。
  const syncFactory = (candidate: import("../src/lib/models.config").ModelCandidate) => candidate.provider === "zenmux" ? { isConfigured: () => true, generate: async () => ({ kind: "done" as const, images: [resultBytes, resultBytes], cost: { amount: 0.02, currency: "USD" as const }, usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 } }) } : new KieProvider(undefined, async () => resultBytes);
  const syncId = await createSceneJob(user.id, product.id, "同步网关模拟", "1:1"); await submitGatewayJob(syncId, syncFactory);
  const syncJob = await db.generationJob.findUniqueOrThrow({ where: { id: syncId } }); assert.equal(syncJob.status, "success"); assert.equal(syncJob.provider, "zenmux"); assert.equal(syncJob.costEstimated, false); assert.equal(Number(syncJob.costUsd), 0.02); assert.equal((syncJob.resultAssetIds as string[]).length, 2); assert.equal(Number(syncJob.reservedUsd), 0);
  const backupFactory = (candidate: import("../src/lib/models.config").ModelCandidate) => candidate.provider === "zenmux" ? { isConfigured: () => true, generate: async (): Promise<never> => { throw new GatewayError("zenmux", "模拟服务 503", 503); } } : new KieProvider(undefined, async () => resultBytes);
  const backupId = await createSceneJob(user.id, product.id, "主网关失败转异步备用", "1:1"); mode = "pending"; await submitGatewayJob(backupId, backupFactory);
  mode = "success"; await pollGatewayJob(backupId, backupFactory); const backupJob = await db.generationJob.findUniqueOrThrow({ where: { id: backupId } }); assert.equal(backupJob.status, "success"); assert.equal(backupJob.provider, "kie"); assert.equal(backupJob.fallback, true);
  const backupAttempts = await db.generationAttempt.findMany({ where: { jobId: backupId }, orderBy: { createdAt: "asc" } }); assert.deepEqual(backupAttempts.map(a => [a.provider, a.status, a.fallback]), [["zenmux", "failed", false], ["kie", "success", true]]);
  process.env.GATEWAY_PREFERENCE = "kie";
  const blockedId = await createSceneJob(user.id, product.id, "异步已知失败按既有策略重试一次", "1:1"); mode = "pending"; await submitGatewayJob(blockedId, syncFactory); mode = "fail"; await pollGatewayJob(blockedId, syncFactory);
  // 本轮不改异步双网关策略：既有实现同线路重试一次后结束，不假称已实现失败后跨网关补交。
  if((await db.generationJob.findUniqueOrThrow({where:{id:blockedId}})).status==="running")await pollGatewayJob(blockedId,syncFactory);
  const blockedJob = await db.generationJob.findUniqueOrThrow({ where: { id: blockedId } }); assert.equal(blockedJob.status, "failed"); assert.equal(blockedJob.provider, "kie");
  const blockedAttempts=await db.generationAttempt.findMany({where:{jobId:blockedId}});assert.equal(blockedAttempts.length,2);assert(blockedAttempts.every(a=>a.provider==="kie"&&a.status==="failed"));
  // 本地存储失败不能触发下一家重复付费；保留已经生成的费用预留。
  process.env.GATEWAY_PREFERENCE = "zenmux"; let secondProviderCalls = 0;
  const storageFailureId = await createSceneJob(user.id, product.id, "同步保存失败", "1:1");
  await submitGatewayJob(storageFailureId, candidate => { if (candidate.provider === "kie") secondProviderCalls++; return { isConfigured: () => true, generate: async () => ({ kind: "done", images: [Buffer.from("invalid-image")] }) }; });
  const storageFailure = await db.generationJob.findUniqueOrThrow({ where: { id: storageFailureId } }); assert.equal(storageFailure.status, "failed"); assert.ok(Number(storageFailure.reservedUsd) > 0); assert.equal(secondProviderCalls, 0);
  // 实际数据库熔断跨路由共享，并在更换凭据或到期后恢复。
  await databaseCircuit.success("zenmux"); for (let i = 0; i < 3; i++) await databaseCircuit.failure("zenmux"); assert.equal(await databaseCircuit.isOpen("zenmux"), true);
  process.env.ZENMUX_API_KEY = "different-local-key"; assert.equal(await databaseCircuit.isOpen("zenmux"), false); await databaseCircuit.success("zenmux");
  for (let i = 0; i < 3; i++) await databaseCircuit.failure("zenmux"); await db.gatewayCircuit.update({ where: { provider: "zenmux" }, data: { openUntil: new Date(Date.now() - 1) } }); assert.equal(await databaseCircuit.isOpen("zenmux"), false); await databaseCircuit.failure("zenmux"); assert.equal((await gatewayCircuitState("zenmux"))?.consecutiveFailures, 1);
  process.env.ZENMUX_API_KEY = "";
  const llmCandidate = models["llm-vision"].find(c => c.provider === "kie")!; assert.equal(llmCandidate.supportsTools, false);
  // 本地模拟聊天返回业务错误：必须有一条失败 LlmCall，不能当成功。
  process.env.KIE_API_KEY = "wrong-key"; await assert.rejects(chatWithGateway("llm-vision", { messages: [{ role: "user", content: "模拟问候" }] }, { userId: user.id }), /密钥无效/); process.env.KIE_API_KEY = currentKey;
  const llmLog = await db.llmCall.findFirstOrThrow({ where: { createdById: user.id } }); assert.equal(llmLog.provider, "kie"); assert.equal(llmLog.status, "failed");
  console.log("通过：双网关同步/异步统一保存、多图转存、跨模型备用标记、逐次账本、保存失败不重复付费、数据库熔断与 LLM 失败记录");
  // 最新审查：真实上传时间更新、缓存失效重传、参考下载故障仅同网关重试一次。
  const actualPhotos = (await productSnapshot(product.id))!.photos;
  const uploader = new KieProvider();
  const cached = await db.kieUpload.findFirstOrThrow();
  await db.kieUpload.updateMany({ data: { uploadedAt: new Date(Date.now() - 24 * 3600000), expiresAt: new Date(Date.now() + 3600000) } });
  const uploadsBefore = uploads; await uploader.uploadFile(actualPhotos[0].id); assert.equal(uploads, uploadsBefore + 1);
  assert.ok((await db.kieUpload.findMany()).some(row => row.uploadedAt.getTime() > cached.uploadedAt.getTime()));
  const referenceId = await createSceneJob(user.id, product.id, "模拟参考链接失效", "1:1"); mode = "pending"; await submitGatewayJob(referenceId, provider);
  const originalTaskId = (await db.generationJob.findUniqueOrThrow({ where: { id: referenceId } })).externalTaskId;
  const submittedBeforeRetry = submissions, uploadsBeforeRetry = uploads; mode = "reference-fail";
  await pollGatewayJob(referenceId, provider); const refreshed = await db.generationJob.findUniqueOrThrow({ where: { id: referenceId } });
  assert.equal(submissions, submittedBeforeRetry + 1); assert.equal(uploads, uploadsBeforeRetry + 2); assert.notEqual(refreshed.externalTaskId, originalTaskId); assert.equal(refreshed.provider, "kie"); assert.equal(refreshed.fallback, false); assert.equal((refreshed.input as Record<string, unknown>).referenceRetryCount, 1);
  await pollGatewayJob(referenceId, provider); assert.equal(submissions, submittedBeforeRetry + 1); assert.equal((await db.generationJob.findUniqueOrThrow({ where: { id: referenceId } })).status, "failed");
  console.log("通过：按最近上传时间过期刷新，参考访问故障同KIE重传，最多重试一次且不切换网关");
  // 四类HTTP200业务错误都必须失败，任务和LLM账本不能报成功。
  failureEndpoint = "file-stream-upload"; failureCode = 402; failureMessage = "Insufficient balance"; await assert.rejects(uploader.uploadFile(actualPhotos[0].id, true), /余额不足/);
  failureEndpoint = "createTask"; const rejectedJob = await createSceneJob(user.id, product.id, "模拟业务余额错误", "1:1"); await submitGatewayJob(rejectedJob, provider); assert.equal((await db.generationJob.findUniqueOrThrow({ where: { id: rejectedJob } })).status, "failed");
  failureEndpoint = ""; await databaseCircuit.success("kie"); mode = "pending";
  const queryFailureJob = await createSceneJob(user.id, product.id, "模拟查询业务错误", "1:1"); await submitGatewayJob(queryFailureJob, provider); failureEndpoint = "recordInfo"; failureCode = 500; failureMessage = "Upstream task error";
  await pollGatewayJob(queryFailureJob, provider);
  const queryRetry=await db.generationJob.findUniqueOrThrow({where:{id:queryFailureJob}});assert.equal(queryRetry.status,"running");assert.equal((queryRetry.input as Record<string,unknown>).autoRetryCount,1);
  await pollGatewayJob(queryFailureJob,provider);assert.equal((await db.generationJob.findUniqueOrThrow({where:{id:queryFailureJob}})).status,"failed");
  failureEndpoint = "chat/completions"; failureCode = 400; failureMessage = "Invalid parameter"; await databaseCircuit.success("kie"); await assert.rejects(chatWithGateway("llm-vision", { messages: [{ role: "user", content: "模拟业务错误" }] }, { userId: user.id }), /参数/); failureEndpoint = "";
  const { saveProduct } = await import("../src/lib/product-save");
  const { productSchema } = await import("../src/lib/product-validation");
  const savedData = productSchema.parse({ sku: product.sku, name: product.name, category: product.category, dimensions: "测试", colors: "测试", materials: "测试", sellingPoints: "模拟卖点", complexity: "simple", identityTraits: "新版身份：双门、四脚" });
  await saveProduct(savedData, user.id, product.id);
  const savedVersion = await db.productIdentityVersion.findFirstOrThrow({ where: { productId: product.id }, orderBy: { savedAt: "desc" } }); assert.equal(savedVersion.savedById, user.id);
  const versionJob = await createSceneJob(user.id, product.id, "按新版特征生成", "1:1");
  await saveProduct({ ...savedData, identityTraits: "再次修改后的身份" }, user.id, product.id);
  const frozen = (await db.generationJob.findUniqueOrThrow({ where: { id: versionJob } })).input as Record<string, unknown>;
  assert.ok(String(frozen.identityTraits).startsWith(savedData.identityTraits+"\n结构与部件：")); assert.equal(frozen.identityVersionId, savedVersion.id); assert.equal(frozen.identitySavedById, user.id); assert.equal(frozen.identitySavedAt, savedVersion.savedAt.toISOString());
  assert.equal(await db.productIdentityVersion.count({ where: { productId: product.id } }), 2);
  // 重启恢复：异步旧任务不再提交；同步中断立刻失败；遗漏的pending重新入队。
  const { recoverInterruptedJobs } = await import("../src/lib/worker-recovery");
  const recoverId = await createSceneJob(user.id, product.id, "重启后接管", "1:1"); mode = "pending"; await submitGatewayJob(recoverId, provider);
  const oldExternalId = (await db.generationJob.findUniqueOrThrow({ where: { id: recoverId } })).externalTaskId;
  await db.generationJob.update({ where: { id: recoverId }, data: { deadlineAt: new Date(Date.now() - 1), nextPollAt: null } });
  const interrupted = await db.generationJob.create({ data: { productId: product.id, createdById: user.id, logicalModel: "scene-main", provider: "zenmux", model: models["scene-main"][0].model, status: "running", reservedUsd: 0.02, input: { submissionAttempted: true } } });
  await db.generationAttempt.create({ data: { jobId: interrupted.id, provider: "zenmux", model: interrupted.model!, costUsd: 0.02, costEstimated: true } });
  const submittedBeforeRecovery = submissions; await recoverInterruptedJobs("restarted-test-worker", boss); await expireOverdueJobs();
  const resumed = await db.generationJob.findUniqueOrThrow({ where: { id: recoverId } }); assert.equal(resumed.externalTaskId, oldExternalId); assert.equal(resumed.status, "running"); assert.ok(resumed.nextPollAt); assert.equal(submissions, submittedBeforeRecovery);
  assert.equal((await db.generationJob.findUniqueOrThrow({ where: { id: interrupted.id } })).status, "failed"); mode = "success"; await pollGatewayJob(recoverId, () => new KieProvider(undefined, async () => resultBytes)); assert.equal((await db.generationJob.findUniqueOrThrow({ where: { id: recoverId } })).status, "success");
  const { reconcileZenMuxCosts } = await import("../src/lib/zenmux-billing"); process.env.ZENMUX_API_KEY = "local-zenmux-billing";
  const billCall = await db.llmCall.create({ data: { logicalModel: "llm-vision", provider: "zenmux", model: models["llm-vision"][0].model, createdById: user.id, status: "success", costUsd: 0.1, costEstimated: true, externalGenerationId: "gen_mock", billingState: "pending", nextBillingAt: new Date(0) } });
  await reconcileZenMuxCosts(async () => new Response(JSON.stringify({ generationId: "gen_mock", model: billCall.model, ratingResponses: { billAmount: 0.0123 } })));
  const settled = await db.llmCall.findUniqueOrThrow({ where: { id: billCall.id } }); assert.equal(Number(settled.costUsd), 0.0123); assert.equal(settled.costEstimated, false); assert.equal(settled.billingState, "settled"); process.env.ZENMUX_API_KEY = "";
  const tiny = await db.user.create({ data: { name: "微额配额验收", email: "tiny@example.invalid", passwordHash: "no-login", monthlyQuota: 0.000001 } }); await assert.rejects(createSceneJob(tiny.id, product.id, "微额配额", "1:1"), /美元配额不足/);
  console.log("通过：四类HTTP200业务错误、身份版本全文冻结、美元小配额拦截、KIE重启接管、ZenMux中断失败和延迟实际账单回填");
  // 图包复用真实事务 / 队列 / MinIO，仅网关使用本地模拟。
  const { mutatePack, quoteBatch, submitBatch, packSnapshot } = await import("../src/lib/image-packs");
  const { exportPack } = await import("../src/lib/pack-export");
  await databaseCircuit.success("kie");
  await db.user.update({ where: { id: user.id }, data: { monthlyQuota: 20 } });
  await db.workerHeartbeat.update({ where: { id: WORKER_ID }, data: { updatedAt: new Date() } });
  await mutatePack(product.id, { action: "defaults" });
  let board = await packSnapshot(product.id); assert.equal(board.slots.length, 7);
  for (const slot of board.slots.slice(0, 3)) await mutatePack(product.id, { action: "save", slotId: slot.id, slot: { ...slot, goal: `测试${slot.name}空间` } });
  for(const slot of board.slots.slice(0,3))await db.imageSlot.update({where:{id:slot.id},data:{visualPlan:JSON.parse(JSON.stringify(await frozenScene(product.id,slot.goal)))}});
  const quote = await quoteBatch(user.id, product.id, {}); assert.equal(quote.totalCount, 6); assert.equal(quote.estimatedCostUsd, 0.18); assert.deepEqual(quote.skipped, ["其他空间场景"]);
  const jobsBeforeQuota = await db.generationJob.count();
  await assert.rejects(submitBatch(tiny.id, product.id, {}, quote.fingerprint, randomUUID()), /还差/); assert.equal(await db.generationJob.count(), jobsBeforeQuota);
  const requestKey = randomUUID(); const batchId = await submitBatch(user.id, product.id, {}, quote.fingerprint, requestKey);
  assert.equal(await submitBatch(user.id, product.id, {}, quote.fingerprint, requestKey), batchId);
  const batchJobs = await db.generationJob.findMany({ where: { batchId }, orderBy: { createdAt: "asc" } }); assert.equal(batchJobs.length, 6); assert.ok(batchJobs.every(j => j.slotId && (j.input as Record<string, unknown>).identityVersionId && j.logicalModel === "scene-main"));
  const { monthlySpendUsd } = await import("../src/lib/quota");
  const reservedSpend = await monthlySpendUsd(db, user.id); await db.user.update({ where: { id: user.id }, data: { monthlyQuota: reservedSpend + 0.01 } });
  await assert.rejects(submitBatch(user.id, product.id, {}, quote.fingerprint, randomUUID()), /还差/);
  await db.user.update({ where: { id: user.id }, data: { monthlyQuota: 20 } });
  failureEndpoint = "createTask"; failureCode = 400; failureMessage = "Invalid parameter";
  await submitGatewayJob(batchJobs[0].id, provider); failureEndpoint = ""; assert.equal((await db.generationJob.findUniqueOrThrow({ where: { id: batchJobs[0].id } })).status, "failed");
  mode = "pending"; for (const j of batchJobs.slice(1)) await submitGatewayJob(j.id, provider);
  const beforeResume = submissions; await recoverInterruptedJobs("pack-restart-test", boss); assert.equal(submissions, beforeResume);
  mode = "success"; for (const j of batchJobs.slice(1)) await pollGatewayJob(j.id, () => new KieProvider(undefined, async () => resultBytes));
  board = await packSnapshot(product.id); assert.equal(board.batches[0].completed, 5); assert.equal(board.batches[0].failed, 1);
  const retryQuote = await quoteBatch(user.id, product.id, { retryJobId: batchJobs[0].id }); assert.equal(retryQuote.totalCount, 1);
  const retryKey = randomUUID(); await submitBatch(user.id, product.id, { retryJobId: batchJobs[0].id }, retryQuote.fingerprint, retryKey);
  assert.equal(await submitBatch(user.id, product.id, { retryJobId: batchJobs[0].id }, retryQuote.fingerprint, retryKey), batchId);
  const retry = await db.generationJob.findUniqueOrThrow({ where: { retryOfId: batchJobs[0].id } }); await submitGatewayJob(retry.id, provider); await pollGatewayJob(retry.id, () => new KieProvider(undefined, async () => resultBytes));
  board = await packSnapshot(product.id); assert.equal(board.batches[0].completed, 6); assert.equal(board.batches[0].failed, 0); assert.equal(board.batches[0].total, 6); assert.equal((await db.generationBatch.findUniqueOrThrow({ where: { id: batchId } })).status, "completed");
  for (const slot of board.slots.slice(0, 3)) await mutatePack(product.id, { action: "final", slotId: slot.id, assetId: slot.jobs.find(j => j.assets.length)!.assets[0].id });
  const firstSlot = (await packSnapshot(product.id)).slots[0], originalFinal = firstSlot.finalAssetId!;
  const other = firstSlot.jobs.flatMap(j => j.assets).find(a => a.id !== originalFinal)!;
  await mutatePack(product.id, { action: "final", slotId: firstSlot.id, assetId: other.id });
  assert.equal((await db.imageSlot.findUniqueOrThrow({ where: { id: firstSlot.id } })).finalAssetId, other.id);
  await assert.rejects(mutatePack(product.id, { action: "hide", slotId: firstSlot.id, assetId: other.id }), /终稿不能直接删除/);
  await assert.rejects(mutatePack(product.id, { action: "delete", slotId: firstSlot.id }), /再次确认/);
  await mutatePack(product.id, { action: "hide", slotId: firstSlot.id, assetId: originalFinal }); assert.ok((await db.asset.findUniqueOrThrow({ where: { id: originalFinal } })).deletedAt);
  await assert.rejects(mutatePack(product.id, { action: "defaults" }), /确认/); await mutatePack(product.id, { action: "defaults", confirmed: true });
  assert.equal((await packSnapshot(product.id)).slots[0].finalAssetId, other.id);
  await assert.rejects(exportPack(product.id, false), /尚无终稿/);
  const exported = await exportPack(product.id, true); assert.equal(exported.bytes.readUInt16LE(exported.bytes.length - 12), 4); assert.ok(exported.bytes.includes(Buffer.from("_02_scene.png")));
  console.log("通过：图包6张原子提交、预留配额整批拒绝、空意图跳过、失败单张重试幂等、重启后6/6进度、终稿唯一性/保护、软删除与MinIO ZIP导出");
  await db.user.update({ where: { id: user.id }, data: { role: "viewer" } });
  await assert.rejects(createSceneJob(user.id, product.id, "模拟只读请求", "1:1"), /只读/);
  assert.equal(quotaMonth(new Date("2026-10-31T16:00:00Z")).start.toISOString(), "2026-10-31T16:00:00.000Z");
  await assert.rejects(inspectPhoto(Buffer.from("invalid")), /有效/);
  await assert.rejects(inspectPhoto(Buffer.alloc(30 * 1024 * 1024 + 1)), /30MB/);
  assert.equal(safeKieMessage(`Bearer ${currentKey} ${currentKey}` ).includes(currentKey!), false);
  let tries = 0;
  await kieRequest("http://fixture.invalid", {}, { key: "test-key", beforeRequest: async () => {}, sleep: async () => {}, fetcher: (async () => { tries++; return new Response(JSON.stringify({ code: tries < 3 ? 429 : 200 }), { status: tries < 3 ? 429 : 200 }); }) as typeof fetch });
  assert.equal(tries, 3);
  console.log("通过：超时退款口径、viewer 权限、北京时间月界、格式/大小限制与 429 退避");
  console.log("隔离自动验收完成；不代表真实家具或付费 KIE 生图验收");
} finally {
  try { await cleanup?.(); }
  finally {
    await new Promise<void>((resolve, reject) => mock.close((error) => error ? reject(error) : resolve()));
    await pool.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    await pool.end();
  }
}
