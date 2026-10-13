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
  const { createSceneJob, generationAvailability, quotaMonth } = await import("../src/lib/scene-generation");
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
  await assert.rejects(createSceneJob(user.id, product.id, "测试", "1:1"), /KIE_API_KEY/); process.env.KIE_API_KEY = currentKey;
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
  const provider = new KieProvider();
  await submitSceneJob(jobId, provider);
  let job = await db.generationJob.findUniqueOrThrow({ where: { id: jobId } });
  assert.equal(job.status, "failed"); assert.equal(Number(job.cost), 0); assert.match(job.error!, /密钥无效/); assert.equal(submissions, 0);
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
  await pollSceneJob(restored, provider, async () => { throw new Error("模拟转存网络错误"); });
  assert.equal((await db.generationJob.findUniqueOrThrow({ where: { id: restored } })).status, "running");
  const resultBytes = await sharp({ create: { width: 2048, height: 2048, channels: 3, background: "#dddddd" } }).png().toBuffer();
  await pollSceneJob(restored, provider, async () => resultBytes);
  job = await db.generationJob.findUniqueOrThrow({ where: { id: restored } });
  assert.equal(job.status, "success"); assert.equal(Number(job.cost), 6);
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
  assert.equal(job.status, "failed"); assert.equal(Number(job.cost), 6); assert.equal(submissions, 2); assert.equal(uploads, 2);
  console.log("通过：入队失败事务回滚、上传缓存、提交断网不重发且保留预留");

  mode = "pending";
  const expiredQueued = await createSceneJob(user.id, product.id, "模拟排队超时", "1:1");
  const expiredSubmitted = await createSceneJob(user.id, product.id, "模拟提交超时", "1:1");
  await submitSceneJob(expiredSubmitted, provider);
  await db.generationJob.updateMany({ where: { id: { in: [expiredQueued, expiredSubmitted] } }, data: { createdAt: new Date(Date.now() - 11 * 60000) } });
  await expireOverdueJobs();
  assert.equal(Number((await db.generationJob.findUniqueOrThrow({ where: { id: expiredQueued } })).cost), 0);
  assert.equal(Number((await db.generationJob.findUniqueOrThrow({ where: { id: expiredSubmitted } })).cost), 6);
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
