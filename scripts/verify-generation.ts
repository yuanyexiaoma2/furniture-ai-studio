import "dotenv/config";
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
let mode: "pending" | "success" | "network" | "fail" = "pending";
let submitted: Record<string, unknown> | null = null;
const mock = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (request.url?.includes("createTask")) submitted = JSON.parse(Buffer.concat(chunks).toString());
  if (request.headers.authorization !== "Bearer local-test-valid-key") { response.writeHead(401); response.end(JSON.stringify({ code: 401 })); return; }
  if (request.url?.includes("createTask")) {
    submissions++;
    if (mode === "network") { request.socket.destroy(); return; }
    response.end(JSON.stringify({ code: 200, data: { taskId: `local-test-task-${submissions}` } })); return;
  }
  if (request.url?.includes("file-stream-upload")) {
    uploads++; response.end(JSON.stringify({ code: 200, success: true, data: { downloadUrl: `https://fixture.invalid/reference-${uploads}.png` } })); return;
  }
  response.end(JSON.stringify({ code: 200, data: { state: mode === "success" ? "success" : mode === "fail" ? "fail" : "generating", failMsg: "模拟内容拦截", resultJson: JSON.stringify({ resultUrls: ["https://fixture.invalid/result.png"] }) } }));
});
await new Promise<void>((resolve) => mock.listen(0, "127.0.0.1", resolve));
const address = mock.address();
if (!address || typeof address === "string") throw new Error("模拟服务启动失败");
process.env.KIE_BASE_URL = process.env.KIE_UPLOAD_BASE_URL = `http://127.0.0.1:${address.port}`;
let cleanup: (() => Promise<void>) | undefined;
try {
  const migration = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env: process.env, encoding: "utf8" });
  if (migration.status !== 0) throw new Error("隔离验收数据库迁移失败");
  const { db } = await import("../src/lib/db");
  const { getBoss, SUBMIT_QUEUE, WORKER_ID, expireOverdueJobs } = await import("../src/lib/generation-queue");
  const { createSceneJob, createEditJob, generationAvailability, quotaMonth } = await import("../src/lib/scene-generation");
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
  cleanup = async () => { for (const asset of await db.asset.findMany()) keys.push(asset.storageKey); for (const key of new Set(keys)) await deleteObject(key); await boss.stop(); await db.$disconnect(); };
  const user = await db.user.create({ data: { name: "隔离验收", email: "test@example.invalid", passwordHash: "never-login", monthlyQuota: 6 } });
  const product = await db.product.create({ data: { sku: "SIMULATION-ONLY", name: "模拟测试商品", category: "测试", dimensions: "测试", colors: "测试", materials: "测试", sellingPoints: [], identityTraits: "模拟身份特征，仅自动测试", createdById: user.id } });
  for (let i = 0; i < 2; i++) {
    const bytes = await sharp({ create: { width: 64, height: 64, channels: 3, background: i ? "#ffffff" : "#eeeeee" } }).png().toBuffer();
    const key = `verification/${databaseName}/reference-${i}.png`; keys.push(key);
    await putObject(key, bytes, "image/png");
    await db.asset.create({ data: { productId: product.id, type: "photo", width: 64, height: 64, storageKey: key, createdById: user.id } });
  }
  await assert.rejects(createSceneJob(user.id, product.id, "测试", "1:1"), /worker/);
  await db.workerHeartbeat.create({ data: { id: WORKER_ID, instanceId: "isolated-test" } });
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
  assert.equal(job.status, "failed"); assert.equal(Number(job.reservedCredits), 0); assert.match(job.error!, /密钥无效/); assert.equal(submissions, 0);
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
  assert.equal(job.status, "success"); assert.equal(Number(job.reservedCredits), 6);
  assert.equal(job.provider, "kie"); assert.equal(Number(job.cost), 6); assert.equal(job.costCurrency, "credits"); assert.equal(job.fallback, false);
  const firstAttempts = await db.generationAttempt.findMany({ where: { jobId: restored } }); assert.equal(firstAttempts.length, 1); assert.equal(firstAttempts[0].status, "success");
  const asset = await db.asset.findUniqueOrThrow({ where: { id: (job.resultAssetIds as string[])[0] } });
  assert.equal(asset.width, 2048); assert.equal(asset.height, 2048); assert.deepEqual((await readObject(asset.storageKey)).bytes, resultBytes);
  console.log("通过：恢复提交、轮询、转存重试、真实 MinIO 写入与成功事务（模拟图）");

  await db.user.update({ where: { id: user.id }, data: { monthlyQuota: 60 } });
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
  assert.equal(job.status, "failed"); assert.equal(Number(job.reservedCredits), 6); assert.equal(submissions, 2); assert.equal(uploads, 2);
  console.log("通过：入队失败事务回滚、上传缓存、提交断网不重发且保留预留");

  mode = "pending";
  const expiredQueued = await createSceneJob(user.id, product.id, "模拟排队超时", "1:1");
  const expiredSubmitted = await createSceneJob(user.id, product.id, "模拟提交超时", "1:1");
  await submitSceneJob(expiredSubmitted, provider);
  await db.generationJob.updateMany({ where: { id: { in: [expiredQueued, expiredSubmitted] } }, data: { createdAt: new Date(Date.now() - 11 * 60000) } });
  await expireOverdueJobs();
  assert.equal(Number((await db.generationJob.findUniqueOrThrow({ where: { id: expiredQueued } })).reservedCredits), 0);
  assert.equal(Number((await db.generationJob.findUniqueOrThrow({ where: { id: expiredSubmitted } })).reservedCredits), 6);
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
  assert.equal(Number(edit.reservedCredits), 9); assert.equal(edit.logicalModel, "edit");
  const editInput = edit.input as Record<string, unknown>;
  assert.deepEqual(editInput.referenceAssetIds, [asset.id, ...reverse]);
  assert.equal(editInput.sourceJobId, restored); assert.equal(editInput.sourceAssetId, asset.id); assert.match(String(editInput.prompt), /第一张参考图/);
  const used = (await generationAvailability(user.id)).used;
  await db.user.update({ where: { id: user.id }, data: { monthlyQuota: used + 8 } });
  await assert.rejects(createSceneJob(user.id, product.id, "4K额度不足", "8:1", "4K"), /配额不足/);
  await db.user.update({ where: { id: user.id }, data: { monthlyQuota: 60 } });
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
  await db.user.update({ where: { id: user.id }, data: { monthlyQuota: 1000 } });
  process.env.ZENMUX_API_KEY = "local-test-zenmux"; process.env.GATEWAY_PREFERENCE = "auto";
  const syncFactory = (candidate: import("../src/lib/models.config").ModelCandidate) => candidate.provider === "zenmux" ? { isConfigured: () => true, generate: async () => ({ kind: "done" as const, images: [resultBytes, resultBytes], cost: { amount: 0.02, currency: "USD" as const }, usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 } }) } : new KieProvider(undefined, async () => resultBytes);
  const syncId = await createSceneJob(user.id, product.id, "同步网关模拟", "1:1"); await submitGatewayJob(syncId, syncFactory);
  const syncJob = await db.generationJob.findUniqueOrThrow({ where: { id: syncId } }); assert.equal(syncJob.status, "success"); assert.equal(syncJob.provider, "zenmux"); assert.equal(syncJob.costCurrency, "USD"); assert.equal(Number(syncJob.cost), 0.02); assert.equal((syncJob.resultAssetIds as string[]).length, 2); assert.equal(syncJob.reservedCredits, 6);
  const backupFactory = (candidate: import("../src/lib/models.config").ModelCandidate) => candidate.provider === "zenmux" ? { isConfigured: () => true, generate: async (): Promise<never> => { throw new GatewayError("zenmux", "模拟服务 503", 503); } } : new KieProvider(undefined, async () => resultBytes);
  const backupId = await createSceneJob(user.id, product.id, "主网关失败转异步备用", "1:1"); mode = "pending"; await submitGatewayJob(backupId, backupFactory);
  mode = "success"; await pollGatewayJob(backupId, backupFactory); const backupJob = await db.generationJob.findUniqueOrThrow({ where: { id: backupId } }); assert.equal(backupJob.status, "success"); assert.equal(backupJob.provider, "kie"); assert.equal(backupJob.fallback, true);
  const backupAttempts = await db.generationAttempt.findMany({ where: { jobId: backupId }, orderBy: { createdAt: "asc" } }); assert.deepEqual(backupAttempts.map(a => [a.provider, a.status, a.fallback]), [["zenmux", "failed", false], ["kie", "success", true]]);
  process.env.GATEWAY_PREFERENCE = "kie";
  const blockedId = await createSceneJob(user.id, product.id, "异步内容拦截转同步备用", "1:1"); mode = "pending"; await submitGatewayJob(blockedId, syncFactory); mode = "fail"; await pollGatewayJob(blockedId, syncFactory);
  const blockedJob = await db.generationJob.findUniqueOrThrow({ where: { id: blockedId } }); assert.equal(blockedJob.status, "success"); assert.equal(blockedJob.provider, "zenmux"); assert.equal(blockedJob.fallback, true);
  // 本地存储失败不能触发下一家重复付费；保留已经生成的费用预留。
  process.env.GATEWAY_PREFERENCE = "auto"; let secondProviderCalls = 0;
  const storageFailureId = await createSceneJob(user.id, product.id, "同步保存失败", "1:1");
  await submitGatewayJob(storageFailureId, candidate => { if (candidate.provider === "kie") secondProviderCalls++; return { isConfigured: () => true, generate: async () => ({ kind: "done", images: [Buffer.from("invalid-image")] }) }; });
  const storageFailure = await db.generationJob.findUniqueOrThrow({ where: { id: storageFailureId } }); assert.equal(storageFailure.status, "failed"); assert.equal(storageFailure.reservedCredits, 6); assert.equal(secondProviderCalls, 0);
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
