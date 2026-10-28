import "dotenv/config";
process.env.VISUAL_REVIEW_TEST_MODE="true";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { Pool } from "pg";
import sharp from "sharp";
import bcrypt from "bcrypt";
import { buildZip } from "../src/lib/zip";
import { emptyProfile, profileFields } from "../src/lib/profile-rules";
const originalUrl = process.env.DATABASE_URL;
if (!originalUrl || !["localhost", "127.0.0.1"].includes(new URL(originalUrl).hostname)) throw new Error("Agent 验收仅允许本地数据库");
const databaseName = `verify_agent_${randomUUID().replaceAll("-", "")}`, pool = new Pool({ connectionString: originalUrl });
await pool.query(`CREATE DATABASE "${databaseName}"`);
const isolated = new URL(originalUrl); isolated.pathname = `/${databaseName}`; process.env.DATABASE_URL = isolated.href;
process.env.GOOGLE_SEARCH_ENABLED="false"; process.env.KIE_API_KEY = "agent-local-test-key"; process.env.ZENMUX_API_KEY = ""; process.env.GATEWAY_PREFERENCE = "kie"; process.env.PG_BOSS_SCHEMA = "pgboss";
type Step = { name: string; args: unknown } | ((materials: Materials) => { name: string; args: unknown });
type Materials = { product: { id: string }; documents: { id: string; type: string; assetId: string }[]; images: { id: string }[]; conversation: { id: string }[]; pack?: { slots: { id: string; finalAssetId: string | null; method: string }[] } };
let refreshHeartbeat: (() => Promise<unknown>) | undefined;
let completeBrowser: ((productId: string) => Promise<void>) | undefined;
let steps: Step[] = [], calls = 0, submitted = 0, visualRevision=0, latestMaterials: Materials;
const values = ["储物边柜", "2扇门、4条腿、2个把手", "80 × 40 × 90 cm", "橡木木纹、黑色五金", "2个黑色竖直把手位于门正面", "无外露 Logo", "锁定双门和四脚，木纹不可改为纯色", "1.封闭储物 2.小户型适用", "小户型家庭", "客厅与卧室，自然现代风格"];
function profileFieldsArgs(materials: Materials, conflict: boolean) {
  const source = { kind: "document", id: materials.documents.find(d => d.type === "csv")!.id, quote: "参数表" };
  return { fields: profileFields.map((field, i) => ({ field, data: { value: values[i], status: field === "dimensions" && conflict ? "inferred" : "confirmed", sources: [!conflict && materials.conversation[0] ? { kind: "message", id: materials.conversation[0].id, quote: "美工核对尺寸" } : source], conflicts: field === "dimensions" && conflict ? [{ value: "宽80cm", source }, { value: "宽90cm", source: { kind: "document", id: materials.documents.find(d => d.type === "docx")!.id, quote: "说明书宽90cm" } }] : [] } })) };
}
function phase(name: string, params: Record<string, unknown> = {}) {
  const read: Step = { name: "read_product_materials", args: {} };
  if (name === "initial") steps = [read, m => ({ name: "view_images", args: { imageIds: m.images.map(i => i.id), instruction: "核对部件及图片类型", classifications: m.documents.filter(d => d.type === "image").map(d => ({ documentId: d.id, imageType: "photo" })) } }), m => ({ name: "update_profile_draft", args: profileFieldsArgs(m, true) }), { name: "ask_user", args: { questions: [{ question: "宽度以哪份资料为准？", options: ["参数表80cm", "说明书90cm"], allowFreeText: true }, { question: "是否有外露Logo？", options: ["没有", "有"], allowFreeText: true }, { question: "主要给谁使用？", options: ["小户型家庭", "其他"], allowFreeText: true }] } }];
  else if (name === "profile") steps = [read, m => ({ name: "update_profile_draft", args: profileFieldsArgs(m, false) }), { name: "request_profile_confirmation", args: {} }];
  else if (name === "pack") steps = [read, { name: "propose_image_pack", args: { reason: "从基础7图位出发，四个空间探索，三个精确信息人工制作", slots: ["主图", "客厅场景", "卧室场景", "其他空间场景", "卖点图", "细节图", "安装示意图"].map((name, i) => ({ name, slotType: i === 0 ? "main" : i < 4 ? "scene" : i === 4 ? "selling_point" : i === 5 ? "detail" : "installation", method: i < 4 ? "ai_scene" : "manual_upload", goal: i < 4 ? `${name}中体现双门柜的收纳用途，自然现代风格` : "人工核对产品信息", candidateCount: 1, aspectRatio: "1:1", reason: "对应产品用途" })) } }];
  else if (name === "generate") steps = [{ name: "generate_batch", args: {} }];
  else if (name === "slot") steps = [read, m => ({ name: "generate_slot", args: { slotId: m.pack!.slots.find(s => s.method === "ai_scene" && !s.finalAssetId)!.id, count: 1 } })];
  else if (name === "edit") steps = [{ name: "edit_image", args: { assetId: String(params.assetId), instruction: "灯光暖一点、地面换成浅色木地板" } }];
  else if (name === "final") steps = [{ name: "set_final", args: { slotId: params.slotId, assetId: params.assetId } }];
  else steps = [];
}
const mock = createServer(async (request, response) => {
  const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const bytes = Buffer.concat(chunks); let body: Record<string, unknown> = {}; try { body = JSON.parse(bytes.toString()); } catch {}
  if (request.url === "/control") { await refreshHeartbeat?.(); if (body.phase === "complete") await completeBrowser?.(String(body.productId)); else phase(String(body.phase), body); response.end("{}"); return; }
  if (request.headers.authorization !== "Bearer agent-local-test-key") { response.writeHead(401); response.end(JSON.stringify({ code: 401 })); return; }
  if (request.url?.includes("file-stream-upload")) { response.end(JSON.stringify({ success: true, code: 200, data: { downloadUrl: "https://fixture.invalid/reference.png" } })); return; }
  if (request.url?.includes("chat/completions")) { response.end(JSON.stringify({ choices: [{ message: { content: "图片为同款双门四脚实木边柜；实拍图，可见黑色竖直把手。" } }], usage: { prompt_tokens: 300, completion_tokens: 50, total_tokens: 350 }, credits_consumed: 0.1 })); return; }
  if (request.url?.includes("createTask")) { response.end(JSON.stringify({ code: 200, data: { taskId: `mock-agent-image-${++submitted}` } })); return; }
  if (request.url?.includes("recordInfo")) { response.end(JSON.stringify({ code: 200, data: { state: "success", resultJson: JSON.stringify({ resultUrls: ["https://fixture.invalid/result.png"] }), creditsConsumed: 6 } })); return; }
  if (!request.url?.includes("responses")) { response.writeHead(404); response.end("{}"); return; }
  calls++;
  for (const item of (body.input ?? []) as { type?: string; output?: string }[]) { if (item.type === "function_call_output") { try { const data = JSON.parse(item.output ?? "{}"); if (data.product && data.documents) latestMaterials = data; } catch {} } }
  const step = Array.isArray(body.tools) && body.tools.length ? steps.shift() : undefined, tool = typeof step === "function" ? step(latestMaterials) : step;
  const inputText=JSON.stringify(body.input??[]);
  let structured:unknown;
  if(inputText.includes("分析本产品实拍和参数"))structured={traits:"双门四脚木纹边柜，两个黑色把手",structure:"两扇门、四条腿、两个竖直把手",materials:"木质",colors:"橡木色和黑色五金",functions:["封闭储物"],sellingPoints:[{name:"封闭储物",evidence:"实拍和已确认档案",priority:1}]};
  if(inputText.includes("为本次新产品制定视觉方案")){visualRevision++;structured={propPool:["模拟环境配饰1","模拟环境配饰2","模拟环境配饰3"],reason:"按本产品检索并规划的模拟视觉方案",slots:["主图","客厅场景","卧室场景","其他空间场景","卖点图","细节图","安装示意图"].map((name,i)=>({key:"mock-"+i,name,slotType:i===0?"main":i<4?"scene":i===4?"selling_point":i===5?"detail":"installation",method:i<4?"ai_scene":"manual_upload",sellingPoint:"封闭储物",scene:i===0?"纯白背景":name,props:i<4&&i>0?["模拟环境配饰"+i]:[],display:"保持完整产品真实比例",camera:"模拟取景版本"+visualRevision,light:"柔和自然光",palette:"中性环境",composition:"完整产品入画",needs_post:i>=4,postNotes:i>=4?"后期人工排版":"",evidence:["identityLock"],notes:"",combinationKey:""})).map((slot,i)=>i>=3?{...slot,directions:[{...slot,id:"a",label:"方向A",reason:"侧重真实用途"},{...slot,id:"b",label:"方向B",reason:"更突出空间比例",camera:slot.camera+"另一侧"}],selectedDirectionId:null}:slot)};}
  const output = tool ? [{ type: "function_call", call_id: `mock-call-${calls}`, name: tool.name, arguments: JSON.stringify(tool.args) }] : [{ type: "message", role: "assistant", content: [{ type: "output_text", text: structured?JSON.stringify(structured):"当前操作已经记录，请查看确认卡或候选看板。" }] }];
  const result = { status: "completed", output, usage: { input_tokens: 500, output_tokens: 150, total_tokens: 650 }, credits_consumed: 0.1 };
  if (body.stream) { response.setHeader("Content-Type", "text/event-stream"); if (!tool) response.write(`data: ${JSON.stringify({ type: "response.output_text.delta", delta: "当前操作已经记录，请查看确认卡或候选看板。" })}\n\n`); response.end(`data: ${JSON.stringify({ type: "response.completed", response: result })}\n\n`); }
  else response.end(JSON.stringify(result));
});
await new Promise<void>(r => mock.listen(0, "127.0.0.1", r));
const address = mock.address(); if (!address || typeof address === "string") throw new Error("mock启动失败");
const mockUrl = `http://127.0.0.1:${address.port}`; process.env.KIE_BASE_URL = process.env.KIE_UPLOAD_BASE_URL = mockUrl;
let cleanup: (() => Promise<void>) | undefined, heartbeat: NodeJS.Timeout | undefined, nextProcess: ReturnType<typeof spawn> | undefined;
try {
  const migration = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env: process.env, encoding: "utf8" }); if (migration.status) throw new Error(migration.stderr);
  const { db } = await import("../src/lib/db"), { uploadProductDocuments } = await import("../src/lib/product-documents"), { runAgentTurn, executeAgentTool } = await import("../src/lib/planning-agent"), { agentSession, agentSnapshot } = await import("../src/lib/agent-state"), { approveAgentCard, createCostCard } = await import("../src/lib/agent-actions"), { getBoss, WORKER_ID } = await import("../src/lib/generation-queue"), { submitGatewayJob, pollGatewayJob } = await import("../src/lib/image-router"), { KieProvider } = await import("../src/lib/kie-provider"), { deleteObject } = await import("../src/lib/storage");
  const boss = await getBoss();
  const tick = () => db.workerHeartbeat.upsert({ where: { id: WORKER_ID }, create: { id: WORKER_ID, instanceId: "agent-mock" }, update: { instanceId: "agent-mock", updatedAt: new Date() } }); refreshHeartbeat = tick; await tick(); heartbeat = setInterval(() => { void tick(); }, 5000);
  cleanup = async () => { if (heartbeat) clearInterval(heartbeat); for (const asset of await db.asset.findMany()) await deleteObject(asset.storageKey).catch(() => undefined); for (const doc of await db.productDocument.findMany({ where: { assetId: null } })) await deleteObject(doc.storageKey).catch(() => undefined); await boss.stop(); await db.$disconnect(); };
  const {models:mockModels}=await import("../src/lib/models.config");
  await db.studioModel.create({data:{id:"mock-agent",name:"隔离模拟Agent",kind:"agent",visible:true,candidate:JSON.parse(JSON.stringify(mockModels["llm-agent"].find(c=>c.provider==="kie"))),probe:{toolCalls:20,parameterCorrect:20,formatCorrect:20,contextStable:20}}});
  const user = await db.user.create({ data: { name: "Agent隔离验收", email: "agent-test@example.invalid", passwordHash: await bcrypt.hash("agent-test-password-123",12), monthlyQuota: 20 } });
  const product = await db.product.create({ data: { sku: "MOCK-AGENT-5", name: "模拟边柜", category: "储物柜", dimensions: "80x40x90cm", colors: "木色", materials: "橡木", sellingPoints: [], createdById: user.id } });
  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#d8c8b2" } }).png().toBuffer();
  const docx = buildZip([{ name: "[Content_Types].xml", bytes: Buffer.from('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>') }, { name: "word/document.xml", bytes: Buffer.from('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>宽90cm，双门四脚，橡木，黑色把手。</w:t></w:r></w:p></w:body></w:document>') }]);
  const files = [0,1,2].map(i => new File([new Uint8Array(png)], `photo-${i}.png`, { type: "image/png" })); files.push(new File([new Uint8Array(docx)], "manual.docx"), new File(["参数,值\n宽度,80cm\n材质,橡木"], "spec.csv"), new File(["bad"],"bad.pdf"));
  const uploaded = await uploadProductDocuments(product.id, user.id, files); assert.equal(uploaded.filter(d => d.error).length,1); assert.equal(await db.productDocument.count({ where: { productId: product.id, parseStatus: "ready" } }),5);
  const session = await agentSession(product.id,user.id);
  const run = async (name: string, text = "请继续", params: Record<string,unknown> = {}) => { phase(name,params); await runAgentTurn(product.id,user.id,text,randomUUID()); const failed = await db.agentToolCall.findMany({ where: { sessionId: session.id,status:"failed" } }); assert.deepEqual(failed.map(f=>f.error),[]); };
  const card = (kind: string) => db.agentCard.findFirstOrThrow({ where: { sessionId:session.id,kind,status:"pending" },orderBy:{createdAt:"desc"} });
  await run("initial", "请读完所有资料"); let state=await agentSnapshot(product.id,user.id); assert.equal(state.understanding.conflicts.length,1); assert.equal(((await card("questions")).data as {questions:unknown[]}).questions.length,3); assert.equal(await db.productProfile.count({where:{productId:product.id}}),0);
  const materialAliases=await executeAgentTool(session.id,"read_product_materials",{}) as {sourceReferences:{alias:string;kind:string;id:string}[]};
  const oldMessageRef=materialAliases.sourceReferences.find(r=>r.kind==="message")!; await db.chatMessage.create({data:{productId:product.id,sessionId:session.id,role:"user",content:{text:"新增一条对话不应改变旧来源短编号"}}}); const newAliases=await executeAgentTool(session.id,"read_product_materials",{}) as typeof materialAliases; assert.equal(newAliases.sourceReferences.find(r=>r.id===oldMessageRef.id)!.alias,oldMessageRef.alias);
  const csvAlias=materialAliases.sourceReferences.find(r=>r.kind==="document"&&r.id===latestMaterials.documents.find(d=>d.type==="csv")!.id)!;
  const aliasField={field:"colorsAndTextures",data:{value:"橡木木纹、黑色五金",status:"confirmed",sources:[{kind:"document",id:csvAlias.alias,quote:"参数表材质"}],conflicts:[]}};
  await executeAgentTool(session.id,"update_profile_draft",{fields:[aliasField]});
  const canonical=(await db.agentSession.findUniqueOrThrow({where:{id:session.id}})).profileDraft as {colorsAndTextures:{sources:{id:string}[]}}; assert.equal(canonical.colorsAndTextures.sources[0].id,csvAlias.id);
  await assert.rejects(executeAgentTool(session.id,"update_profile_draft",{fields:[{...aliasField,data:{...aliasField.data,sources:[{kind:"document",id:"D99999",quote:"不存在的资料"}]}}]}),/不属于本 SKU/);
  const imageRef=materialAliases.sourceReferences.find(r=>r.kind==="image")!; const visionCalls=calls;
  await assert.rejects(executeAgentTool(session.id,"view_images",{imageIds:[imageRef.alias],instruction:"核对图片",classifications:[{documentId:imageRef.id,imageType:"photo"}]}),/不能使用Asset/); assert.equal(calls,visionCalls);
  await approveAgentCard(session.id,(await card("questions")).id,{answers:["参数表80cm","没有","小户型家庭"]}); await run("profile");
  const profileCard=await card("profile"), profile=(profileCard.data as unknown as {profile:ReturnType<typeof emptyProfile>}).profile; profile.driftWarnings.value += "，美工确认门缝不能加宽"; await approveAgentCard(session.id,profileCard.id,{profile}); assert.equal(await db.productIdentityVersion.count({where:{productId:product.id}}),1);
  await assert.rejects(executeAgentTool(session.id,"propose_image_pack",{reason:"校验新增图位",slots:[{id:"fabricated-new-slot",name:"新增场景",slotType:"scene",method:"ai_scene",goal:"新的空间意图",aspectRatio:"1:1",candidateCount:1,reason:"新增"}]}),/新增图位请省略id/);
  await run("pack"); const packCard=await card("pack"), proposal=packCard.data as {visualPlan:{slots:{display:string}[]}}; for(const s of proposal.visualPlan.slots as {directions?:{id:string}[];selectedDirectionId?:string}[])if(s.directions)s.selectedDirectionId=s.directions[0].id; proposal.visualPlan.slots[1].display="温暖的客厅中展现封闭收纳，浅色木地板"; await approveAgentCard(session.id,packCard.id,{visualPlan:proposal.visualPlan});
  await db.agentSession.update({where:{id:session.id},data:{autoConfirm:true}}); await run("generate"); const firstCost=await card("cost"); assert.equal(await db.generationJob.count({where:{productId:product.id}}),0); await approveAgentCard(session.id,firstCost.id,{}); await approveAgentCard(session.id,firstCost.id,{}); assert.equal(await db.generationJob.count({where:{productId:product.id}}),4);
  await db.agentCard.update({ where: { id: firstCost.id }, data: { status: "executing", data: { ...(firstCost.data as Record<string,unknown>), startedAt: new Date(Date.now()-180000).toISOString() } } });
  await agentSnapshot(product.id,user.id); assert.equal((await db.agentCard.findUniqueOrThrow({where:{id:firstCost.id}})).status,"executed"); assert.equal(await db.generationJob.count({where:{productId:product.id}}),4);
  completeBrowser = async (productId) => { for (const job of await db.generationJob.findMany({ where: { productId, status: "pending" } })) { await submitGatewayJob(job.id); await pollGatewayJob(job.id, () => new KieProvider(undefined, async () => png)); } };
  const complete = async () => { for (const job of await db.generationJob.findMany({where:{productId:product.id,status:"pending"}})) { await submitGatewayJob(job.id); await pollGatewayJob(job.id,()=>new KieProvider(undefined,async()=>png)); } };
  await complete(); const original=await db.generationJob.findFirstOrThrow({where:{productId:product.id,status:"success"}}), assetId=(original.resultAssetIds as string[])[0];
  await run("edit","灯光暖一点、地面换成浅色木地板",{assetId}); const edit=await db.generationJob.findFirstOrThrow({where:{productId:product.id,logicalModel:"edit"}}); const input=edit.input as {referenceAssetIds:string[];sourceAssetId:string;identityVersionId:string}; assert.equal(input.referenceAssetIds[0],assetId); assert.equal(input.referenceAssetIds.length,4); assert.equal(input.sourceAssetId,assetId); assert.equal(edit.slotId,original.slotId); assert.ok(input.identityVersionId); await complete();
  const edited=await db.generationJob.findUniqueOrThrow({where:{id:edit.id}}); await run("final","选这张为终稿",{slotId:edit.slotId,assetId:(edited.resultAssetIds as string[])[0]}); const finalCard=await card("final"); await approveAgentCard(session.id,finalCard.id,{});
  const oldFinal=(await db.imageSlot.findUniqueOrThrow({where:{id:edit.slotId!}})).finalAssetId; const slot=await db.imageSlot.findUniqueOrThrow({where:{id:edit.slotId!}});
  const partial=await executeAgentTool(session.id,"propose_image_pack",{reason:"局部优化，保留候选与终稿",slots:[{id:slot.id,name:slot.name,goal:"调整意图不删终稿",method:slot.method,slotType:slot.slotType,aspectRatio:slot.aspectRatio,candidateCount:slot.candidateCount,reason:"测试保留"}]}); const partialCard=await db.agentCard.findUniqueOrThrow({where:{id:(partial as {cardId:string}).cardId}}),partialPlan=(partialCard.data as {visualPlan:{slots:{directions?:{id:string}[];selectedDirectionId?:string}[]}}).visualPlan;for(const s of partialPlan.slots)if(s.directions)s.selectedDirectionId=s.directions[0].id;await approveAgentCard(session.id,partialCard.id,{visualPlan:partialPlan}); assert.equal((await db.imageSlot.findUniqueOrThrow({where:{id:slot.id}})).finalAssetId,oldFinal);
  await db.agentSession.update({where:{id:session.id},data:{mode:"manual",autoConfirm:true}}); await assert.rejects(createCostCard(session.id,{operation:"generate_batch"}),/手动模式/); const nextSlot=await db.imageSlot.findFirstOrThrow({where:{packId:slot.packId,method:"ai_scene",finalAssetId:null},orderBy:{order:"asc"}}); await run("slot"); await approveAgentCard(session.id,(await card("cost")).id,{}); await complete();
  const later=await db.imageSlot.findMany({where:{packId:slot.packId,method:"ai_scene",finalAssetId:null},orderBy:{order:"asc"}}); await assert.rejects(createCostCard(session.id,{operation:"generate_slot",slotId:later[1].id,count:1}),/先挑好/); assert.equal(nextSlot.id,later[0].id);
  await run("none","够了，开始吧"); const stopped=await executeAgentTool(session.id,"ask_user",{questions:[{question:"不应再问",options:[],allowFreeText:true}]}); assert.equal((stopped as {stopped:boolean}).stopped,true);
  await db.agentSession.update({where:{id:session.id},data:{mode:"quick",autoConfirm:true}});
  const currentSlot=await db.imageSlot.findUniqueOrThrow({where:{id:slot.id}});
  for(let i=0;i<10;i++) await db.imageSlot.create({data:{packId:slot.packId,order:8+i,name:`多图${i}`,visualPlan:currentSlot.visualPlan??undefined,slotType:"scene",method:"ai_scene",goal:"测试费用门槛",candidateCount:4,aspectRatio:"1:1"}});
  const expensive=await createCostCard(session.id,{operation:"generate_batch"}); assert.equal((expensive as {waitForUser:boolean}).waitForUser,true); assert.ok((expensive as {quote:{estimatedCostUsd:number}}).quote.estimatedCostUsd>1);
  state=await agentSnapshot(product.id,user.id); assert.ok(state.costs.llmUsd>0&&state.costs.imagesUsd>0); assert.equal(await db.llmCall.count({where:{productId:product.id,sessionId:null}}),0);
  console.log(`通过：上传/解析失败隔离 → 3问题与尺寸冲突 → 回答 → 修改并确认身份版本 → 7图位方案 → 首批手动确认幂等 → 4张mock生成 → 原图+3实拍调整 → 终稿 → 方案保留 → 手动图位限制 → 停止提问 → 超$1确认。mock费用 LLM $${state.costs.llmUsd.toFixed(6)}，生图 $${state.costs.imagesUsd.toFixed(6)}；未调用付费外网。`);
  if(process.argv.includes("--browser")) {
    mkdirSync('.local/verification',{recursive:true});writeFileSync('.local/agent-photo.png',png);writeFileSync('.local/agent-manual.docx',docx);
    process.env.AGENT_MOCK_URL=mockUrl;process.env.AGENT_TEST_DATABASE=isolated.href;process.env.AGENT_TEST_USER=user.id;process.env.E2E_BASE_URL='http://localhost:3105';process.env.AUTH_URL='http://localhost:3105';process.env.AUTH_TRUST_HOST='true';process.env.AGENT_TEST_DIST='1';
    nextProcess=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3105'],{env:process.env,stdio:['ignore','pipe','pipe'],windowsHide:true}); nextProcess.stdout?.on('data',chunk=>{if(String(chunk).includes('Error'))console.error(String(chunk));});nextProcess.stderr?.on('data',chunk=>console.error(String(chunk)));
    for(let i=0;i<60;i++){try{const res=await fetch('http://localhost:3105/login');if(res.ok)break;}catch{}await new Promise(r=>setTimeout(r,1000));if(i===59)throw new Error('浏览器验收服务未就绪');}
    const browserResult=await new Promise<number>(resolve=>{const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test','tests/agent.spec.ts'],{env:process.env,stdio:'inherit',windowsHide:true});child.on('exit',code=>resolve(code??1));}); if(browserResult)throw new Error('Agent浏览器验收失败');
  }
} finally {
  if(nextProcess?.pid){spawnSync('taskkill',['/PID',String(nextProcess.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});}
  await cleanup?.();await new Promise<void>(resolve=>mock.close(()=>resolve())); await pool.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);await pool.end();
}
