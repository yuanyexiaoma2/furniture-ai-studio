import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import {fixture} from "../fixtures/visual-plan";
import {validateVisualPlan,bindPlanningReferences,referenceAdaptationChanged,requiresDirections} from "../../src/lib/visual-plan-rules";
import {prepareSceneInput,prepareEditInput} from "../../src/lib/scene-generation";
import {confirmVisualPlan} from "../../src/lib/visual-planning";
import {requireResolvedImages,currentEditReferences} from "../../src/lib/conversation-images";
import {KieProvider} from "../../src/lib/kie-provider";
import {ZenMuxImageProvider} from "../../src/lib/zenmux-image-provider";
import {imageCandidate,kieImageModels} from "../../src/lib/image-models";
import {conversationImageSchema,imageReferenceLimit,selectGenerationReferences,requestFromGenerationInput,inheritedReferences,type SlotReference} from "../../src/lib/generation-references";
import type {Prisma} from "../../src/generated/prisma/client";
import type {ModelCandidate} from "../../src/lib/models.config";
import {prepareAgentEdit} from "../../src/lib/agent-actions";
import {databaseCircuit} from "../../src/lib/gateway-circuit";

const styles:SlotReference[]=[{assetId:"style-a",purpose:"只参考右侧柔和光线"},{assetId:"style-b",purpose:"只参考冷灰环境色调"}];
const candidate=imageCandidate(kieImageModels[0]);
const qwen=imageCandidate(kieImageModels.find(s=>s.id==="image-qwen3")!);
function context(references:SlotReference[]=styles){
 const assets=[...["photo-a","photo-b"].map(id=>({id,productId:"product-a",type:"photo",deletedAt:null,width:100,height:100})),...styles.map(r=>({id:r.assetId,productId:"product-a",type:"style_ref",deletedAt:null,width:100,height:100})),{id:"source",productId:"product-a",type:"generated",deletedAt:null,width:100,height:100},{id:"mask",productId:"product-a",type:"mask",deletedAt:null,width:100,height:100}];
 const product={id:"product-a",sku:"SECRET-SKU",identityTraits:"已有身份",assets:assets.filter(a=>a.type==="photo")};
 const plan=validateVisualPlan({...structuredClone(fixture),conversationImages:references.map(r=>({...r,role:"reference"})),identityLock:{...fixture.identityLock,referenceAssetIds:product.assets.map(a=>a.id)},slots:bindPlanningReferences([{...fixture.slots[0],references}],references.map(r=>({...r,role:"reference"})))});
 const frozen={plan,slot:plan.slots[0],confirmationCardId:"confirmed-card"};
 let sourceInput:Record<string,unknown>={};
 const find=({where}: {where:{id:string}})=>assets.find(a=>a.id===where.id);
 const match=({where}: {where:{id:{in:string[]};productId?:string;type?:string|{not:string};deletedAt?:null}})=>assets.filter(a=>where.id.in.includes(a.id)&&(!where.productId||a.productId===where.productId)&&(!where.type||(typeof where.type==="string"?a.type===where.type:a.type!==where.type.not))&&(!("deletedAt"in where)||a.deletedAt===null));
 const tx={$executeRaw:async()=>{},product:{findUnique:async()=>product},asset:{findMany:async(a:Parameters<typeof match>[0])=>match(a),count:async(a:Parameters<typeof match>[0])=>match(a).length,findUnique:async(a:Parameters<typeof find>[0])=>find(a),findUniqueOrThrow:async(a:Parameters<typeof find>[0])=>{const r=find(a);if(!r)throw Error("不存在");return r;}},productIdentityVersion:{findUnique:async()=>null,findFirst:async()=>null},generationJob:{findUnique:async()=>({id:"job",productId:product.id,status:"success",resultAssetIds:["source"],input:sourceInput}),findUniqueOrThrow:async()=>({input:sourceInput})}} as unknown as Prisma.TransactionClient;
 return {tx,assets,plan,frozen,setSource:(input:Record<string,unknown>)=>{sourceInput=input;}};
}
async function scene(c=candidate){const state=context();return {...state,prepared:await prepareSceneInput(state.tx,"product-a","不读可变旧意图","1:1",c,"2K",state.frozen)};}
async function kieBody(input:Record<string,unknown>,c=candidate){
 const provider=new KieProvider(c.model);let body:Record<string,unknown>|undefined;
 provider.uploadFile=async id=>"https://fixture.invalid/"+id+".png";
 provider.submit=async(_model,value)=>{body=value;return "mock-task";};
 await provider.generate(requestFromGenerationInput(input));return body!;
}

test("无参考方案直接使用具体陈列生成，不因第4图位要求额外方向或参考图",async()=>{
 const s=context([]),slot={...s.frozen.slot,key:"slot-4",scene:"玄关门侧的窄墙面",props:["素面收纳盘"],display:"收纳盘放在台面右后方，左侧留空，露出把手和完整轮廓",camera:"与台面齐平的前侧视角",references:[]};
 const frozen={...s.frozen,slot,plan:{...s.plan,slots:[slot]}};
 assert.equal(requiresDirections(slot,3),false);
 const confirmed=await confirmVisualPlan(s.tx,"product-a",frozen.plan);assert.equal(confirmed.slots.length,1);
 const prepared=await prepareSceneInput(s.tx,"product-a","忽略旧提示词","1:1",candidate,"2K",frozen);
 const body=await kieBody(prepared.input);
 assert.match(String(body.prompt),/收纳盘放在台面右后方/);assert.match(String(body.prompt),/左侧留空/);assert.equal(body.resolution,"2K");
 assert.deepEqual(requestFromGenerationInput(prepared.input).referenceImages.map(i=>i.id),["photo-a","photo-b"]);
});

test("扩图冻结真实范围并改变最终KIE比例，原实拍和风格引用保持顺序",async()=>{
 const s=await scene();s.setSource(s.prepared.input);
 const extent={width:160,height:120,offsetX:30,offsetY:10};
 const prepared=await prepareEditInput(s.tx,"product-a","向左右扩展背景","1:1","4K",{sourceJobId:"job",sourceAssetId:"source"},candidate,[],undefined,extent);
 assert.equal(prepared.input.aspect_ratio,"4:3");assert.equal(prepared.input.editMode,"expanded");assert.deepEqual(prepared.input.expansion,extent);
 const request=requestFromGenerationInput(prepared.input);assert.deepEqual(request.referenceImages[0],{id:"source",expansion:extent});assert(request.referenceImages.slice(1).every(r=>!r.expansion));
 const body=await kieBody(prepared.input);assert.equal(body.aspect_ratio,"4:3");assert.equal(body.resolution,"4K");assert.match(String(body.prompt),/只补全新增区域/);
 await assert.rejects(prepareEditInput(s.tx,"product-a","扩展","1:1","2K",{sourceJobId:"job",sourceAssetId:"source"},candidate,["mask"],undefined,extent),/不能同时/);
});

test("对话修改的1K、2K、4K与Auto设置进入实际KIE请求和费用估算",async t=>{
 const previous=process.env.KIE_API_KEY;process.env.KIE_API_KEY="local-test";
 t.mock.method(databaseCircuit,"isOpen",async()=>false);
 try{
  const s=await scene();s.setSource(s.prepared.input);
  const tx=s.tx as unknown as {generationJob:{findFirst:()=>Promise<unknown>};imagePack:{findFirst:()=>Promise<unknown>}};
  tx.generationJob.findFirst=async()=>({id:"job",slot:{id:"slot",packId:"pack",aspectRatio:"1:1",deletedAt:null}});
  tx.imagePack={findFirst:async()=>({id:"pack"})};
  for(const resolution of ["1K","2K","4K","auto"] as const){
   const result=await prepareAgentEdit(s.tx,"product-a",{operation:"edit_image",assetId:"source",instruction:"只修改背景"},{resolution});
   const expected=resolution==="auto"?"2K":resolution;
   assert.equal((await kieBody(result.input)).resolution,expected);
   assert.equal(result.estimate,({"1K":.02,"2K":.03,"4K":.045})[expected]);
  }
 }finally{if(previous===undefined)delete process.env.KIE_API_KEY;else process.env.KIE_API_KEY=previous;}
});
test("当前全部模型输入上限均有登记；未知模型不退化成文字参考",()=>{
 assert.deepEqual(kieImageModels.map(s=>imageReferenceLimit(imageCandidate(s))),[10,16,10,8,3]);
 assert.equal(imageReferenceLimit({provider:"zenmux",model:"google/gemini-nano-banana-2.1"}),14);
 assert.throws(()=>imageReferenceLimit({provider:"kie",model:"unknown"}),/多图.*不会改成文字/);
});
test("参考用途必填，产品图无需填写参考用途",()=>{
 assert(conversationImageSchema.safeParse({assetId:"a",role:"product"}).success);
 assert(!conversationImageSchema.safeParse({assetId:"a",role:"reference",purpose:" "}).success);
 assert(!conversationImageSchema.safeParse({assetId:"a",role:"guess"}).success);
});
test("不明用途只返回一句澄清，不创建卡片、不发起生成；编辑原图可明确识别为源图",async()=>{
 const state={images:[],assetIds:["unknown"],unresolved:["unknown"]};
 await assert.rejects(requireResolvedImages("s",[],async()=>state),/这张图是产品图还是参考图？/);
 assert.deepEqual(await requireResolvedImages("s",["unknown"],async()=>state),state);
});
test("修改的新参考必须在对话声明，省略沿用、空数组清空，源图不会冒充风格参考",async()=>{
 const saved:unknown[]=[];
 const deps={read:async()=>({images:styles.map(r=>({...r,role:"reference" as const})),assetIds:["source",...styles.map(r=>r.assetId)],unresolved:["source"]}),save:async(_id:string,raw:unknown)=>{saved.push(raw);return {images:[],instruction:""};}};
 assert.equal(await currentEditReferences("s","source",undefined,deps),undefined);
 assert.deepEqual(saved[0],[{assetId:"source",role:"source",purpose:"待编辑原图"}]);
 assert.deepEqual(await currentEditReferences("s","source",[styles[1]],deps),[styles[1]]);
 assert.deepEqual(await currentEditReferences("s","source",[],deps),[]);
 await assert.rejects(currentEditReferences("s","source",[{assetId:"foreign",purpose:"光线"}],deps),/当前对话说明用途/);
});
test("方案每图位最多两张参考且不得使用未在对话声明或重复的图片",()=>{
 const {plan}=context();
 assert.throws(()=>validateVisualPlan({...plan,slots:[{...plan.slots[0],references:[...styles,styles[0]]}]}));
 assert.throws(()=>validateVisualPlan({...plan,slots:[{...plan.slots[0],references:[styles[0],styles[0]]}]}),/重复/);
 assert.throws(()=>validateVisualPlan({...plan,slots:[{...plan.slots[0],references:[{assetId:"foreign",purpose:"光线"}]}]}),/当前对话/);
 assert.throws(()=>selectGenerationReferences(candidate,["photo-a"],[{assetId:"photo-a",purpose:"构图"}]),/同一图片/);
});
test("冻结、报价输入和最终KIE提交都保留实拍与图位参考及逐张用途（零外网）",async()=>{
 const s=await scene();assert.deepEqual(await confirmVisualPlan(s.tx,"product-a",s.plan),s.plan);
 assert.deepEqual(s.prepared.input.referenceAssetIds,["photo-a","photo-b","style-a","style-b"]);
 const body=await kieBody(s.prepared.input);assert.deepEqual(body.image_input,["photo-a","photo-b","style-a","style-b"].map(id=>"https://fixture.invalid/"+id+".png"));
 assert.match(String(body.prompt),/第1张：产品实拍/);assert.match(String(body.prompt),/第3张：参考图，仅参考：只参考右侧柔和光线/);assert.match(String(body.prompt),/不能把参考图中的家具/);
 assert.doesNotMatch(String(body.prompt),/style-a|photo-a|SECRET-SKU/);
 assert.deepEqual(s.prepared.input.visualPlan.slot.references,styles);
});
test("所有KIE模型的最终请求确实带图，不以文字描述冒充图片",async()=>{
 for(const spec of kieImageModels){const c=imageCandidate(spec),s=await scene(c),body=await kieBody(s.prepared.input,c);const field=spec.format==="banana"?"image_input":spec.format==="gpt25"?"input_urls":"image_urls";assert.deepEqual(body[field],s.prepared.input.referenceAssetIds.map(id=>"https://fixture.invalid/"+id+".png"));}
});
test("Qwen超限先保留产品图，再按顺序保留参考图，并记录省略，费用仍按原公式计入实际输入数",async()=>{
 const s=await scene(qwen);assert.deepEqual(s.prepared.input.referenceAssetIds,["photo-a","photo-b","style-a"]);
 assert.deepEqual(s.prepared.input.omittedReferences.map(r=>r.assetId),["style-b"]);assert.equal(s.prepared.input.referenceLimit,3);
 assert.doesNotMatch(s.prepared.input.prompt,/只参考冷灰环境色调/);assert.equal(s.prepared.estimate,.0315);
 const body=await kieBody(s.prepared.input,qwen);assert.equal((body.image_urls as string[]).length,3);
});
test("已冻结参考不随会话后来修改，移除和替换在再次冻结时生效",async()=>{
 const s=await scene(),frozen=structuredClone(s.frozen);s.plan.conversationImages![0].purpose="后来的用途";
 const unchanged=await prepareSceneInput(s.tx,"product-a","其它旧意图","1:1",candidate,"2K",frozen);assert.deepEqual(unchanged.input,s.prepared.input);
 const changed=structuredClone(frozen);changed.plan.slots[0].references=[];changed.slot=changed.plan.slots[0];const empty=await prepareSceneInput(s.tx,"product-a","旧意图","1:1",candidate,"2K",changed);assert.deepEqual(empty.input.referenceAssetIds,["photo-a","photo-b"]);
});
test("跨产品和删除的参考在冻结或生成前被拒绝，不提交模型",async()=>{
 const s=context();s.assets.find(a=>a.id==="style-b")!.productId="foreign";
 await assert.rejects(confirmVisualPlan(s.tx,"product-a",s.plan),/参考图已删除或不属于/);
 await assert.rejects(prepareSceneInput(s.tx,"product-a","场景","1:1",candidate,"2K",s.frozen),/参考图已删除或不属于/);
});
test("整图、再来一张和蒙版修改继承实际用过的参考，最终请求包含它们",async()=>{
 for(const masks of [[],["mask"]]){const s=await scene();s.setSource(s.prepared.input);
  const edit=await prepareEditInput(s.tx,"product-a","只改环境","1:1","2K",{sourceJobId:"job",sourceAssetId:"source"},candidate,masks);
  assert.deepEqual(inheritedReferences(edit.input),styles);assert.equal(edit.input.identityTraits,s.prepared.input.identityTraits);
  assert.deepEqual(edit.input.referenceAssetIds,["source",...masks,"photo-a","photo-b","style-a","style-b"]);
  const body=await kieBody(edit.input);assert.deepEqual(body.image_input,edit.input.referenceAssetIds.map(id=>"https://fixture.invalid/"+id+".png"));
  assert.match(edit.input.prompt,/风格参考只参考明确指定方面/);
 }
});
test("修改指定新参考替换原参考；空数组明确清空；不把原图未使用的超限参考带回来",async()=>{
 const s=await scene(qwen);s.setSource(s.prepared.input);
 const edit=async(refs?:SlotReference[])=>prepareEditInput(s.tx,"product-a","调整光线","1:1","2K",{sourceJobId:"job",sourceAssetId:"source"},candidate,[],refs);
 assert.deepEqual(inheritedReferences((await edit()).input),[styles[0]]);
 assert.deepEqual(inheritedReferences((await edit([styles[1]])).input),[styles[1]]);
 assert.deepEqual(inheritedReferences((await edit([])).input),[]);
});
test("ZenMux最终Gemini请求使用inlineData传入每张实图，顺序和用途一致",async()=>{
 const c={provider:"zenmux",model:"google/gemini-nano-banana-2.1",supportsTools:false,pricing:{currency:"USD",imageTokens:{"2K":1680},imageOutputPerMillion:30,inputPerMillion:1.5}} as ModelCandidate;
 const s=await scene(c),old=process.env.ZENMUX_API_KEY;process.env.ZENMUX_API_KEY="local-fixture";
 let body:unknown;
 try{const provider=new ZenMuxImageProvider(c.model,{models:{generateContent:async value=>{body=value;return {candidates:[{content:{parts:[{inlineData:{data:Buffer.from("fake-image").toString("base64")}}]}}]};}}},async id=>({bytes:Buffer.from("fixture:"+id),mime:"image/png"}));
 await provider.generate(requestFromGenerationInput(s.prepared.input));
 const parts=(body as {contents:{parts:{text?:string;inlineData?:{data:string}}[]}[]}).contents[0].parts;
 assert.equal(parts[0].text,s.prepared.input.prompt);assert.deepEqual(parts.slice(1).map(p=>Buffer.from(p.inlineData!.data,"base64").toString()),["photo-a","photo-b","style-a","style-b"].map(id=>"fixture:"+id));
 }finally{if(old===undefined)delete process.env.ZENMUX_API_KEY;else process.env.ZENMUX_API_KEY=old;}
});
test("请求顺序与用途元数据不一致时停止，不能带错参考",()=>{
 assert.throws(()=>requestFromGenerationInput({referenceAssetIds:["b"],referenceUsage:[{assetId:"a",role:"product",purpose:"锁定产品"}]}),/顺序不一致/);
});

test("反推适配冻结来源，KIE只接收实拍和完整画面文字；连续修改不重新带入参考图",async()=>{
 const refs=styles.map(r=>({...r,mode:"prompt_only" as const})),s=context(refs);
 s.plan.slots[0].display="书籍集中在左下方，右侧留空，不遮挡产品";
 s.plan.slots[0].palette="环境与道具自由配色，与产品本色协调；产品颜色保持实拍";
 await confirmVisualPlan(s.tx,"product-a",s.plan);
 const prepared=await prepareSceneInput(s.tx,"product-a","旧意图","1:1",candidate,"2K",s.frozen);
 assert.deepEqual(prepared.input.referenceAssetIds,["photo-a","photo-b"]);
 assert.deepEqual(prepared.input.promptReferences,refs);
 assert.deepEqual(prepared.input.omittedReferences,[]);
 const body=await kieBody(prepared.input);
 assert.equal((body.image_input as string[]).length,2);
 assert.match(String(body.prompt),/书籍集中在左下方/);
 assert.match(String(body.prompt),/环境与道具自由配色/);
 assert.doesNotMatch(String(body.prompt),/第3张|style-a|style-b/);
 s.setSource(prepared.input);
 const edit=await prepareEditInput(s.tx,"product-a","只把书移到右边，其余保留","1:1","2K",{sourceJobId:"job",sourceAssetId:"source"},candidate);
 assert.deepEqual(edit.input.referenceAssetIds,["source","photo-a","photo-b"]);
 assert.deepEqual(inheritedReferences(edit.input),refs);
 assert.deepEqual((await kieBody(edit.input)).image_input,["source","photo-a","photo-b"].map(id=>"https://fixture.invalid/"+id+".png"));
 s.setSource(edit.input);
 const second=await prepareEditInput(s.tx,"product-a","稍微提亮","1:1","2K",{sourceJobId:"job",sourceAssetId:"source"},candidate);
 assert.deepEqual(second.input.promptReferences,refs);
});

test("反推来源不占图片限额，图片参考与反推可混用，明确清空会清掉两种来源",async()=>{
 const refs=[{...styles[0],mode:"prompt_only" as const},styles[1]],s=context(refs);
 const prepared=await prepareSceneInput(s.tx,"product-a","旧意图","1:1",qwen,"2K",s.frozen);
 assert.deepEqual(prepared.input.referenceAssetIds,["photo-a","photo-b","style-b"]);
 assert.deepEqual(prepared.input.promptReferences,[refs[0]]);
 assert.deepEqual(prepared.input.omittedReferences,[]);
 assert.equal(prepared.estimate,.0315);
 s.setSource(prepared.input);
 const edit=await prepareEditInput(s.tx,"product-a","只修改光线","1:1","2K",{sourceJobId:"job",sourceAssetId:"source"},candidate,[],[]);
 assert.deepEqual(inheritedReferences(edit.input),[]);
});

test("多张参考分别绑定图位，不强迫图位4另选方向，允许按参考复用池外道具",()=>{
 const refs=styles.map(r=>({...r,mode:"prompt_only" as const}));
 const images=refs.map(r=>({...r,role:"reference" as const}));
 const slots=bindPlanningReferences(refs.map((r,i)=>({...fixture.slots[0],key:`slot-${i+4}`,references:[r],evidence:[r.assetId],props:["参考图中的托盘"]})),images);
 const plan=validateVisualPlan({...fixture,conversationImages:images,propPool:["花瓶"],slots});
 assert.deepEqual(plan.slots.map(s=>s.references?.map(r=>r.assetId)),[["style-a"],["style-b"]]);
 assert.equal(requiresDirections(plan.slots[0],3),false);
});

test("反推后更换参考或用途必须更新文字；不能把旧描述当作新参考的适配结果",()=>{
 const s=context(styles.map(r=>({...r,mode:"prompt_only" as const})));
 assert.equal(referenceAdaptationChanged(s.plan.slots[0]),false);
 s.plan.slots[0].references![0].purpose="改为参考左侧光线";
 assert.equal(referenceAdaptationChanged(s.plan.slots[0]),true);
 assert.throws(()=>validateVisualPlan(s.plan),/按意见重写/);
});

test("反推参考仍检查归属和删除，不因未传给生图而绕过验证",async()=>{
 const s=context(styles.map(r=>({...r,mode:"prompt_only" as const})));
 s.assets.find(a=>a.id==="style-a")!.deletedAt=new Date() as unknown as null;
 await assert.rejects(confirmVisualPlan(s.tx,"product-a",s.plan),/已删除/);
 await assert.rejects(prepareSceneInput(s.tx,"product-a","意图","1:1",candidate,"2K",s.frozen),/已删除/);
});
