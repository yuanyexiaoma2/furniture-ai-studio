import test from "node:test";
import assert from "node:assert/strict";
// 固定个人阶段的关闭状态；服务测试不连接数据库、不允许联网或模型请求。
for(const key of ["LIBRARY_IMPORT","LIBRARY_PATTERNS","LIBRARY_RETRIEVAL","WEB_RESEARCH","CASE_EXTRACTION"])process.env["NEXT_PUBLIC_FEATURE_"+key]="false";
process.env.DATABASE_URL??="postgresql://fixture:fixture@127.0.0.1:1/task12a_no_database";
const features=await import("../../src/lib/project-features");
const {llmAgentTools,agentToolSchemas}=await import("../../src/lib/agent-tool-schemas");
const {retrieveLibrary,researchCompetitors}=await import("../../src/lib/visual-planning");
const {webSearch}=await import("../../src/lib/web-search");
const {proposeExcellentCase}=await import("../../src/lib/visual-case");
const {importListingFolder,approveListingImport}=await import("../../src/lib/listing-import");
const {composeVisualSlot}=await import("../../src/lib/visual-plan-rules");
const savedFetch=globalThis.fetch;let networkCalls=0;
globalThis.fetch=async()=>{networkCalls++;throw Error("本轮测试禁止联网/模型请求");};
test.after(()=>{globalThis.fetch=savedFetch;assert.equal(networkCalls,0);});

test("所有暂停开关关闭，旧会话webEnabled=true也不能向Agent暴露搜索工具",()=>{
 assert(Object.values(features).every(v=>v===false));
 assert(!llmAgentTools(true).some(t=>t.function.name==="web_search"));
 const tool=llmAgentTools().find(t=>t.function.name==="propose_image_pack")!;
 const shape=tool.function.parameters as {properties:Record<string,unknown>};
 assert.deepEqual(Object.keys(shape.properties),["reason"]);
 assert(agentToolSchemas.propose_image_pack.safeParse({reason:"先与用户讨论方案"}).success);
});
test("经验库与竞品研究在数据查询前直接跳过，不依赖产品/库数据",async()=>{
 const library=await retrieveLibrary("不存在的品类",["不存在的卖点"]);
 assert.deepEqual(library.entries,[]);assert.match(library.note,/暂停/);
 const research=await researchCompetitors("missing-product","missing-user",{} as Parameters<typeof researchCompetitors>[2]);
 assert.equal(research.status,"skipped");assert.deepEqual(research.references,[]);assert.deepEqual(research.sources,[]);
});
test("Listing导入、审核、案例AI提炼和搜索在任何模型/数据读写之前拒绝",async()=>{
 let analyzed=0;
 for(const action of [()=>importListingFolder("missing-user","家具",[],async()=>{analyzed++;throw Error("不应分析");}),()=>approveListingImport("missing-user","missing-entry",[]),()=>proposeExcellentCase("missing-product","missing-user","missing-asset"),()=>webSearch("missing-session","missing-user","家具",3,true)]){
  await assert.rejects(action(),error=>error instanceof Error&&error.message.includes("暂停")&&(error as {status?:number}).status===403);
 }
 assert.equal(analyzed,0);
});
test("非层架产品的通用提示词不会自动带入层数、层间距或拆下层板规则",()=>{
 const text=composeVisualSlot({key:"one",name:"单图",slotType:"scene",sellingPoint:"产品用途",scene:"用户指定空间",props:[],display:"按当前实拍",camera:"用户选择角度",light:"自然光",palette:"当前资料颜色",composition:"完整产品",needs_post:false,postNotes:"",evidence:["identityLock"],notes:"",combinationKey:""});
 assert(!/层数|层间距|洗衣机|层板|长靴|半透明/.test(text));assert.match(text,/部件数量和尺寸比例保持不变/);
});

test("真实目录覆盖旧mock回退，模型选择和既有前端费用估算仍按目录运行",async()=>{
 const {models}=await import("../../src/design-preview/mock/models");
 const {useModelStore,availableModels,estimateCost}=await import("../../src/components/design-preview/model-store");
 const saved=useModelStore.getState();
 try{
  const agent={...models.find(m=>m.kind==="agent")!,id:"fixture-agent",isDefault:true,price:.002};
  const image={...models.find(m=>m.kind==="image")!,id:"fixture-image",isDefault:true,pricesByResolution:{"2K":.03,"4K":.06},referenceImagePrice:.01};
  useModelStore.getState().setCatalog([agent,image]);
  useModelStore.getState().updateSelection("home",{agentId:agent.id,imageId:image.id,imageIds:[image.id],auto:false,resolution:"2K"});
  assert.deepEqual(availableModels(useModelStore.getState(),"agent").map(m=>m.id),[agent.id]);
  assert.deepEqual(availableModels(useModelStore.getState(),"image").map(m=>m.id),[image.id]);
  assert(Math.abs(estimateCost(useModelStore.getState(),"home",1)-.062)<1e-9);
  useModelStore.getState().updateSelection("home",{resolution:"4K"});
  assert(Math.abs(estimateCost(useModelStore.getState(),"home",2)-.182)<1e-9);
 }finally{useModelStore.setState(saved);}
});
test("保留的readMockFiles仍按真实文件生成预览和附件名，支持附件逐项移除",async()=>{
 const {readMockFiles,useLibraryStore}=await import("../../src/components/design-preview/library/library-store");
 const savedReader=Object.getOwnPropertyDescriptor(globalThis,"FileReader"),saved=useLibraryStore.getState();
 class LocalFileReader{
  result:string|null=null;onload:(()=>void)|null=null;onerror:((error:unknown)=>void)|null=null;
  readAsDataURL(file:File){void file.arrayBuffer().then(bytes=>{this.result="data:"+file.type+";base64,"+Buffer.from(bytes).toString("base64");this.onload?.();}).catch(error=>this.onerror?.(error));}
 }
 Object.defineProperty(globalThis,"FileReader",{configurable:true,value:LocalFileReader});
 try{
  const bytes=new Uint8Array([137,80,78,71]);
  const files=[new File([bytes],"商品正面.png",{type:"image/png"}),new File(["真实参数"],"商品参数.txt",{type:"text/plain"})];
  const result=await readMockFiles(files);
  assert.equal(result.photos.length,1);assert.equal(result.photos[0].name,"商品正面.png");assert.equal(result.photos[0].source,"upload");assert.equal(result.photos[0].image,"data:image/png;base64,iVBORw==");assert.deepEqual(result.documents,["商品参数.txt"]);
  useLibraryStore.setState({draftPhotos:[],draftDocuments:[]});useLibraryStore.getState().ingest(result.photos,result.documents);
  assert.equal(useLibraryStore.getState().draftPhotos.length,1);assert.equal(useLibraryStore.getState().draftDocuments.length,1);
  useLibraryStore.getState().removeDraftPhoto(result.photos[0].id);useLibraryStore.getState().removeDraftDocument(0);
  assert.equal(useLibraryStore.getState().draftPhotos.length,0);assert.equal(useLibraryStore.getState().draftDocuments.length,0);
 }finally{useLibraryStore.setState(saved);if(savedReader)Object.defineProperty(globalThis,"FileReader",savedReader);else Reflect.deleteProperty(globalThis,"FileReader");}
});
