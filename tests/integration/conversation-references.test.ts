import "dotenv/config";
import {test,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {db} from "../../src/lib/db";
import {agentSession} from "../../src/lib/agent-state";
import {executeAgentTool,runAgentTurn,type AgentChat} from "../../src/lib/planning-agent";
import {inspectStudioProduct} from "../../src/lib/studio-main";
import {saveConversationImages,conversationImageState,currentEditReferences} from "../../src/lib/conversation-images";
import {DEFAULT_AGENT} from "../../src/lib/agent-default";
import type {chatWithGateway} from "../../src/lib/llm-router";
after(()=>db.$disconnect());
test("首页首次识别同时区分产品/参考；不明用途只问一句；对话用途可跨轮保存（无模型/存储请求）",async()=>{
 if(!process.env.DATABASE_URL||!["localhost","127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname))throw Error("仅允许本地测试数据库");
 const run=randomUUID();let userId="",productId="";
 try{
  userId=(await db.user.create({data:{name:"引用链路测试",email:run+"@example.invalid",passwordHash:"not-a-login",monthlyQuota:0}})).id;
  const product=await db.product.create({data:{sku:"REF-"+run,name:"测试架",category:"待确认",dimensions:"未知",materials:"木",colors:"木色",sellingPoints:["第一张产品实拍，第二张只参考光线"],createdById:userId}});productId=product.id;
  const photos:Awaited<ReturnType<typeof db.asset.create>>[]=[];for(let i=0;i<2;i++)photos.push(await db.asset.create({data:{productId,createdById:userId,type:"style_ref",storageKey:"verification/reference/"+run+"/"+i,width:10,height:10,createdAt:new Date(Date.now()+i*10)}}));
  for(let i=0;i<2;i++)await db.productDocument.create({data:{productId,createdById:userId,type:"image",filename:"fixture-"+i+".png",mime:"image/png",storageKey:photos[i].storageKey,assetId:photos[i].id,parseStatus:"ready",imageType:"unclassified"}});
  const session=await agentSession(productId,userId);let calls=0,ambiguous=false;
  const chat:typeof chatWithGateway=async(_logical,input)=>{calls++;assert.equal(input.images?.length,2);assert.match(String(input.messages[0].content),/不能进入产品身份/);return {result:{text:JSON.stringify({categoryId:null,categoryName:"鞋架",name:"实拍产品",photos:[{ref:"I1",angle:"front",role:"product"},{ref:"I2",angle:"unknown",role:ambiguous?"unknown":"reference",purpose:ambiguous?"":"只参考光线"}],fields:[{field:"structureAndParts",value:"实拍架结构"}]}),toolCalls:[],usage:{inputTokens:0,outputTokens:0,totalTokens:0}},candidate:DEFAULT_AGENT.candidate,fallback:false,warnings:[],attemptId:"local-fixture"};};
  ambiguous=true;await inspectStudioProduct(productId,userId,chat);assert.equal(calls,1);
  assert.equal(await db.agentCard.count({where:{sessionId:session.id}}),0);
  const question=await db.chatMessage.findFirstOrThrow({where:{sessionId:session.id,role:"assistant"},orderBy:{createdAt:"desc"}});assert.match((question.content as {text:string}).text,/是产品图还是参考图/);
  const plain=await executeAgentTool(session.id,"ask_user",{questions:[{question:"这是什么图",options:[],allowFreeText:true}]});assert("plainQuestion"in plain);assert.equal(await db.agentCard.count({where:{sessionId:session.id,kind:"questions"}}),0);
  let turns=0;const deltas:string[]=[];
  const turnChat:AgentChat=async input=>{turns++;assert(input.images?.some(i=>i.id===photos[1].id));return {candidate:DEFAULT_AGENT.candidate,fallback:false,warnings:[],attemptId:"local-turn",result:{text:"",usage:{inputTokens:0,outputTokens:0,totalTokens:0},toolCalls:[{id:"plain-question",type:"function",function:{name:"ask_user",arguments:JSON.stringify({questions:[{question:"这是产品还是参考",options:[],allowFreeText:true}]})}}]}};};
  await runAgentTurn(productId,userId,"这张图怎么使用",randomUUID(),e=>{if(e.type==="delta")deltas.push(e.text??"");},undefined,turnChat,{referenceAssetIds:[photos[1].id]});
  assert.equal(turns,1);assert.match(deltas.join(""),/是产品图还是参考图/);assert.equal(await db.agentCard.count({where:{sessionId:session.id,kind:"questions"}}),0);
  const history=await db.chatMessage.findMany({where:{sessionId:session.id},orderBy:[{createdAt:"asc"},{id:"asc"}]});assert.deepEqual(history.slice(-2).map(m=>m.role),["tool","assistant"]);
  await saveConversationImages(session.id,[{assetId:photos[1].id,role:"reference",purpose:"只参考光线"}]);
  assert.deepEqual((await conversationImageState(session.id)).unresolved,[]);
  const settings=(await db.agentSession.findUniqueOrThrow({where:{id:session.id}})).settings;
  assert.equal((settings as {conversationImages:{role:string}[]}).conversationImages.filter(i=>i.role==="reference").length,1);
  assert.equal((await db.asset.findUniqueOrThrow({where:{id:photos[0].id}})).type,"photo");
  assert.equal((await db.asset.findUniqueOrThrow({where:{id:photos[1].id}})).type,"style_ref");
  const draft=(await db.agentSession.findUniqueOrThrow({where:{id:session.id}})).profileDraft as {structureAndParts:{sources:{id:string}[]}};assert.equal(draft.structureAndParts.sources[0].id,photos[0].id);
  await db.agentSession.update({where:{id:session.id},data:{settings:{}}});ambiguous=false;await inspectStudioProduct(productId,userId,chat);assert.equal(calls,2);assert.equal(await db.agentCard.count({where:{sessionId:session.id,kind:"category",status:"pending"}}),1);
  await assert.rejects(saveConversationImages(session.id,[{assetId:"foreign",role:"reference",purpose:"构图"}]),/当前对话/);
  const override=[{assetId:photos[1].id,purpose:"只参考光线"}];assert.deepEqual(await currentEditReferences(session.id,"unused-source",override),override);
  assert.equal(await db.generationJob.count({where:{productId}}),0);assert.equal(await db.llmCall.count({where:{productId}}),0);
 }finally{
  if(productId){await db.chatMessage.deleteMany({where:{productId}});await db.agentCard.deleteMany({where:{session:{productId}}});await db.agentSession.deleteMany({where:{productId}});await db.productDocument.deleteMany({where:{productId}});await db.asset.deleteMany({where:{productId}});await db.product.delete({where:{id:productId}});}
  if(userId)await db.user.delete({where:{id:userId}});
 }
});
