import "dotenv/config";
import test,{after} from "node:test";
import assert from "node:assert/strict";
import {kieImageModels,imageCandidate} from "../../src/lib/image-models";
import {buildKieImageInput,fitImageReferences,validateImageSelection} from "../../src/lib/image-model-input";
import {estimateImageUsd} from "../../src/lib/gateway-cost";
import {candidatesFor} from "../../src/lib/gateway-router";
import {KieProvider} from "../../src/lib/kie-provider";
import type {ImageRequest} from "../../src/lib/image-provider";
import {db} from "../../src/lib/db";
after(()=>db.$disconnect());

const request:ImageRequest={prompt:"保留木色、双柜门和五金位置",referenceImages:[{id:"a"},{id:"b"}],aspectRatio:"1:1",resolution:"2K",outputFormat:"png"};
test("缺省路由按用途选择：智能体ZenMux、生图和编辑KIE，显式网关偏好仍有效",()=>{
 assert.equal(candidatesFor("llm-agent","auto")[0].provider,"zenmux");assert.equal(candidatesFor("llm-vision","auto")[0].provider,"zenmux");
 for(const logical of ["scene-main","edit"] as const){assert.equal(candidatesFor(logical,"auto")[0].provider,"kie");assert.equal(candidatesFor(logical,"zenmux")[0].provider,"zenmux");}
});
test("五个生图模型实际提交各自的官方字段，无真实上传或付费调用",async()=>{
 for(const spec of kieImageModels){
  const provider=new KieProvider(spec.model);let body:Record<string,unknown>|undefined,submitted="";
  provider.uploadFile=async id=>"https://fixture.invalid/"+id;
  provider.submit=async(model,input)=>{submitted=model;body=input;return "local-task";};
  const result=await provider.generate(request);assert.equal(submitted,spec.model);assert.equal(result.kind,"pending");assert.equal(body?.prompt,request.prompt);
  const field=spec.format==="banana"?"image_input":spec.format==="gpt25"?"input_urls":"image_urls";
  assert.deepEqual(body?.[field],["https://fixture.invalid/a","https://fixture.invalid/b"]);
  assert.equal(body?.[spec.format==="qwen3"?"image_size":"aspect_ratio"],"1:1");
  for(const other of ["image_input","input_urls","image_urls"].filter(f=>f!==field))assert.equal(body?.[other],undefined);
 }
});
test("Qwen3限制在提交前检查，源图与蒙版优先保留，参考图费用进入预估",async()=>{
 const spec=kieImageModels.find(s=>s.id==="image-qwen3")!,candidate=imageCandidate(spec),provider=new KieProvider(spec.model);let uploads=0;
 provider.uploadFile=async()=>{uploads++;throw Error("不应上传");};
 await assert.rejects(provider.generate({...request,resolution:"4K"}),/不支持4K/);assert.equal(uploads,0);
 assert.throws(()=>validateImageSelection(candidate,"2K","4:5","提示词",2),/比例/);
 assert.throws(()=>validateImageSelection(candidate,"2K","1:1","字".repeat(5001),2),/5000/);
 const refs=fitImageReferences(candidate,[{id:"source"},{id:"mask"},{id:"photo1"},{id:"photo2"},{id:"photo3"}]);assert.deepEqual(refs.map(r=>r.id),["source","mask","photo1"]);
 assert.equal(estimateImageUsd(candidate,"2K","",Array.from({length:3},()=>({width:100,height:100}))),.0315);
 const input=buildKieImageInput(spec.model,{...request,outputFormat:"jpg"},["https://fixture.invalid/a"]);assert.equal(input.output_format,"jpeg");assert.equal(input.prompt_extend,false);
 assert.equal(estimateImageUsd(imageCandidate(kieImageModels.find(s=>s.id==="image-gpt-25")!),"2K"),.05);
});
