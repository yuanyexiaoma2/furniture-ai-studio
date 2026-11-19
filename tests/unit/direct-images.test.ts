import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import {directImageSchema,directReferenceSnapshot} from "../../src/lib/direct-image-rules";
import {prepareDirectImage} from "../../src/lib/direct-image-generation";
import {prepareEditInput} from "../../src/lib/scene-generation";
import {buildKieImageInput} from "../../src/lib/image-model-input";
import {imageCandidate,kieImageModels} from "../../src/lib/image-models";
import type {Prisma} from "../../src/generated/prisma/client";

const candidate=imageCandidate(kieImageModels[0]);
const selection={modelId:"image-banana",prompt:"手绘一把红色椅子",aspectRatio:"1:1" as const,resolution:"2K" as const,referenceAssetIds:[]};
test("新上传图片可直接换色、扩图和抠图，冻结原图及扩展参数，无需生成任务或Agent档案",async()=>{
 const asset={id:"upload",productId:"p",type:"style_ref",width:512,height:512,storageKey:"original",deletedAt:null};
 const tx={$executeRaw:async()=>{},studioLibraryEntry:{findUnique:async()=>null},product:{findUnique:async()=>({id:"p",sku:"SKU",assets:[]})},asset:{findUnique:async()=>asset,findUniqueOrThrow:async()=>asset,findMany:async({where}:{where:{id:{in:string[]}}})=>where.id.in.includes(asset.id)?[asset]:[]},productIdentityVersion:{findFirst:async()=>null}} as unknown as Prisma.TransactionClient;
 const edits=[{tool:"recolor" as const,sourceAssetId:"upload",appearanceChange:{description:"黑色木纹",environment:"keep" as const}},{tool:"expand" as const,sourceAssetId:"upload",expansion:{width:768,height:512,offsetX:128,offsetY:0}},{tool:"cutout" as const,sourceAssetId:"upload"}];
 for(const edit of edits){
  const p=await prepareDirectImage(tx,{...selection,productId:"p",edit},candidate,async()=>({width:512,height:512}));
  assert.equal(p.input.generationMode,"direct");assert.deepEqual(p.input.referenceAssetIds,["upload"]);assert.equal(p.input.referenceUsage[0].role,"source");
  assert.equal((p.input as Record<string,unknown>).sourceAssetId,"upload");
  if(edit.tool==="expand")assert.deepEqual((p.input as Record<string,unknown>).expansion,edit.expansion);
  if(edit.tool==="recolor")assert.deepEqual((p.input as Record<string,unknown>).appearanceChange,edit.appearanceChange);
 }
 const original={...selection,productId:"p",edit:edits[2]};
 const before=await prepareDirectImage(tx,original,candidate);asset.storageKey="changed";const after=await prepareDirectImage(tx,original,candidate);assert.notEqual(before.fingerprint,after.fingerprint);
 asset.productId="other";await assert.rejects(prepareDirectImage(tx,original,candidate),/有效的上传图片/);
 asset.productId="p";asset.type="generated";await assert.rejects(prepareDirectImage(tx,original,candidate),/有效的上传图片/);
 asset.type="style_ref";Object.assign(asset,{deletedAt:new Date()});await assert.rejects(prepareDirectImage(tx,original,candidate),/有效的上传图片/);
 assert(!directImageSchema.safeParse({...selection,edit:edits[2]}).success);
 assert(!directImageSchema.safeParse({...original,referenceAssetIds:["other"]}).success);
 assert(!directImageSchema.safeParse({...original,edit:{...edits[0],expansion:edits[1].expansion}}).success);
});
test("单张纯文字输入不要求产品档案、实拍或Agent，Nano Banana请求允许零张图",async()=>{
 const tx={} as Prisma.TransactionClient;
 const prepared=await prepareDirectImage(tx,selection,candidate);
 assert.equal(prepared.input.generationMode,"direct");assert.equal(prepared.input.prompt,selection.prompt);assert.deepEqual(prepared.input.referenceAssetIds,[]);
 const body=buildKieImageInput(candidate.model,{prompt:prepared.input.prompt,referenceImages:[],aspectRatio:"1:1",resolution:"2K",outputFormat:"png"},[]);
 assert.deepEqual(body.image_input,[]);assert.equal(prepared.estimate,.03);
 assert.throws(()=>buildKieImageInput(kieImageModels[1].model,{prompt:"文字",referenceImages:[],aspectRatio:"1:1",resolution:"2K",outputFormat:"png"},[]),/需要1至/);
});
test("单张参考图冻结顺序并实际进入请求，跨商品或已删除图片拒绝，不静默省略",async()=>{
 const assets=[{id:"b",storageKey:"b",width:512,height:512},{id:"a",storageKey:"a",width:512,height:512}];
 const tx={studioLibraryEntry:{findUnique:async()=>null},product:{findUnique:async()=>({id:"p"})},asset:{findMany:async()=>assets}} as unknown as Prisma.TransactionClient;
 const prepared=await prepareDirectImage(tx,{...selection,productId:"p",referenceAssetIds:["a","b"]},candidate);
 assert.deepEqual(prepared.input.referenceAssetIds,["a","b"]);assert.deepEqual(prepared.input.referenceUsage.map(r=>r.assetId),["a","b"]);
 assets.pop();await assert.rejects(prepareDirectImage(tx,{...selection,productId:"p",referenceAssetIds:["a","b"]},candidate),/已删除或不属于/);
 assert.throws(()=>directReferenceSnapshot(imageCandidate(kieImageModels[4]),Array.from({length:4},(_,i)=>({assetId:String(i),role:"reference",purpose:"参考"}))),/不会静默省略/);
 assert(!directImageSchema.safeParse({...selection,referenceAssetIds:["a","a"]}).success);
});
test("纯文字成图可以继续编辑，不要求伪造产品实拍，普通产品修图仍必须保留实拍",async()=>{
 const source={id:"job",productId:"p",status:"success",resultAssetIds:["result"],input:{generationMode:"direct",identityTraits:"保留源图内容",referenceUsage:[]}};
 const asset={id:"result",productId:"p",type:"generated",width:512,height:512,deletedAt:null};
 const tx={$executeRaw:async()=>{},product:{findUnique:async()=>({id:"p",sku:"SKU",assets:[]})},generationJob:{findUnique:async()=>source,findUniqueOrThrow:async()=>source},asset:{findUnique:async()=>asset,findUniqueOrThrow:async()=>asset,findMany:async()=>[]},productIdentityVersion:{findFirst:async()=>null}} as unknown as Prisma.TransactionClient;
 const prepared=await prepareEditInput(tx,"p","把背景换成白色","1:1","2K",{sourceJobId:"job",sourceAssetId:"result"},candidate);
 assert.equal(prepared.input.generationMode,"direct");assert.deepEqual(prepared.input.referenceAssetIds,["result"]);assert.equal(prepared.input.sourceAssetId,"result");
 source.input.generationMode="planned";
 await assert.rejects(prepareEditInput(tx,"p","修改","1:1","2K",{sourceJobId:"job",sourceAssetId:"result"},candidate),/修图必须包含原始实拍/);
});

test("模板生成结果连续修改仍按原顺序保留产品实拍和场景参考",async()=>{
 const result={id:"result",productId:"p",type:"generated",width:512,height:512,deletedAt:null},photo={...result,id:"photo",type:"photo"},style={...result,id:"style",type:"style_ref"};
 const source={id:"job",productId:"p",status:"success",resultAssetIds:["result"],input:{generationMode:"direct",identityTraits:"保留当前产品",referenceUsage:[{assetId:"photo",role:"product",purpose:"产品"},{assetId:"style",role:"reference",purpose:"光线"}]}};
 const tx={$executeRaw:async()=>{},product:{findUnique:async()=>({id:"p",sku:"SKU",assets:[photo]})},generationJob:{findUnique:async()=>source,findUniqueOrThrow:async()=>source},asset:{findUnique:async()=>result,findUniqueOrThrow:async()=>result,findMany:async({where}:{where:{id:{in:string[]}}})=>[photo,style].filter(a=>where.id.in.includes(a.id))},productIdentityVersion:{findFirst:async()=>null}} as unknown as Prisma.TransactionClient;
 const edited=await prepareEditInput(tx,"p","调整光线","1:1","2K",{sourceJobId:"job",sourceAssetId:"result"},candidate);
 assert.deepEqual(edited.input.referenceAssetIds,["result","photo","style"]);assert.deepEqual(edited.input.referenceUsage.map(r=>r.role),["source","product","reference"]);
});
