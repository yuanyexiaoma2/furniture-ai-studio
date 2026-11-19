import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import {saveReference,listSavedReferences,reuseReference} from "../../src/lib/saved-references";
import {savedGenerationSnapshot,templatePrompt,filterTemplates,savedReferenceSchema,savedReferenceInput} from "../../src/lib/saved-reference-rules";
type IO=NonNullable<Parameters<typeof reuseReference>[3]>;

test("收藏保存真实生成快照、重复保存更新同一条记录，并按用户隔离",async()=>{
 const records=new Map<string,Record<string,unknown>>();let completed=true;
 const io={db:{
  asset:{findFirst:async()=>({id:"result",productId:"old"})},
  generationJob:{findFirst:async()=>completed?{id:"job",model:"mock-image",input:{prompt:"旧产品的提示词",visualPlan:{slot:{scene:"窗边"}},referenceUsage:[{assetId:"photo",role:"product",purpose:"产品"}],promptReferences:[{assetId:"style",purpose:"道具",mode:"prompt_only"}],resolution:"2K",selectedCandidate:{apiKey:"must-not-save"}}}:null},
  studioLibraryEntry:{upsert:async({create,update,where}:{create:Record<string,unknown>;update:Record<string,unknown>;where:{id:string}})=>{records.set(where.id,records.has(where.id)?{...records.get(where.id),...update}:create);return records.get(where.id);},findMany:async()=>[...records.values()]}
 }} as unknown as IO;
 const first=await saveReference("user-a",{productId:"old",assetId:"result",name:"窗边",purpose:"参考摆放"},io);
 const next=await saveReference("user-a",{productId:"old",assetId:"result",name:"窗边新版",purpose:"参考光线"},io);
 assert.equal(first.id,next.id);assert.equal(records.size,1);assert.equal(next.prompt,"旧产品的提示词");assert.equal(next.references.length,2);
 assert(!JSON.stringify(next).includes("must-not-save"));assert.equal((await listSavedReferences("user-a",io))[0].name,"窗边新版");assert.deepEqual(await listSavedReferences("user-b",io),[]);
 completed=false;
 await assert.rejects(saveReference("user-a",{productId:"old",assetId:"result",name:"图",purpose:"光线"},io),/已完成/);
});

test("复用收藏把参考复制到当前产品，保留现有用途并阻止他人读取",async()=>{
 const saved={version:1,ownerId:"user-a",productId:"old",assetId:"result",jobId:"job",name:"窗边",purpose:"只借鉴道具摆放",createdAt:"2026-11-11",prompt:"旧产品红色金属柜",references:[],model:"mock",resolution:"2K"};
 let existing:unknown=null,copies=0,message:unknown,settings:unknown,available=true;
 const session={id:"current-session",settings:{resolution:"4K",conversationImages:[{assetId:"existing",role:"reference",purpose:"现有参考",mode:"image"}]}};
 const tx={
  $queryRaw:async()=>[],
  asset:{upsert:async({create}:{create:unknown})=>{existing=create;}},
  agentSession:{findUniqueOrThrow:async()=>session,update:async({data}:{data:unknown})=>{settings=data;}},
  chatMessage:{upsert:async(input:unknown)=>{message=input;}},
 };
 const io={db:{
  studioLibraryEntry:{findFirst:async()=>({id:"saved",data:saved})},
  asset:{findFirst:async()=>available?{id:"result",productId:"old",storageKey:"old/result",width:100,height:100}:null,findUnique:async()=>existing},
  $transaction:async(fn:(value:typeof tx)=>Promise<unknown>)=>fn(tx)
 },session:async()=>session,storage:{read:async()=>({bytes:Buffer.from("local fixture"),mime:"image/png"}),write:async()=>{copies++;}}} as unknown as IO;
 await assert.rejects(reuseReference("user-b","saved","new",io),/不属于当前账号/);assert.equal(copies,0);
 const result=await reuseReference("user-a","saved","new",io);
 assert.match(result.assetId,/^savedref-/);assert.equal(copies,1);assert.equal((existing as {productId:string}).productId,"new");
 const updated=(settings as {settings:{resolution:string;conversationImages:{assetId:string;mode:string;purpose:string}[]}}).settings;
 assert.equal(updated.resolution,"4K");assert.equal(updated.conversationImages.length,2);assert.equal(updated.conversationImages[1].mode,"prompt_only");
 assert(JSON.stringify(message).includes("当前产品实拍"));assert(!JSON.stringify(message).includes(saved.prompt));
 await reuseReference("user-a","saved","new",io);assert.equal(copies,1);
 available=false;await assert.rejects(reuseReference("user-a","saved","new",io),/原图已不可用/);
});

test("老记录无参考字段仍能收藏，任意上游字段不进入收藏",()=>{
 assert.deepEqual(savedGenerationSnapshot({prompt:"画面",apiKey:"secret",resolution:"2K"}),{prompt:"画面",references:[],plan:null,appearanceChange:null,resolution:"2K"});
});

test("模板保留原始提示词，复用版本可独立修改；旧收藏仍可检索",()=>{
 const base={version:1,ownerId:"a",productId:"p",assetId:"i",jobId:"j",name:"玄关留白",purpose:"自然光",createdAt:"today",prompt:"原始产品描述",references:[],model:"mock",resolution:"2K"};
 const old={...savedReferenceSchema.parse(base),id:"old"},current={...savedReferenceSchema.parse({...base,category:"鞋架",scene:"玄关",reusablePrompt:"修改后的模板描述"}),id:"new"};
 assert.equal(templatePrompt(old),base.prompt);assert.equal(templatePrompt(current),"修改后的模板描述");assert.equal(current.prompt,base.prompt);
 assert.deepEqual(filterTemplates([old,current],"","","","鞋架").map(r=>r.id),["new","old"]);
 assert.deepEqual(filterTemplates([old,current],"修改后","鞋架","玄关").map(r=>r.id),["new"]);assert.equal(filterTemplates([old,current],"","桌子").length,0);
 assert(!savedReferenceInput.safeParse({productId:"p",assetId:"i",name:"模板",purpose:"场景",reusablePrompt:"a".repeat(20001)}).success);
});
