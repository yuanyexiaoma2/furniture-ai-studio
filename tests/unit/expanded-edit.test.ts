import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { expansionFromPreview, containExpansion, validateExpansion, expansionAspectRatio } from "../../src/lib/expansion-rules";
import { expansionGuide, compositeExpandedEdit } from "../../src/lib/expanded-edit";
import { ZenMuxImageProvider } from "../../src/lib/zenmux-image-provider";
import { KieProvider } from "../../src/lib/kie-provider";
import { imageCandidate, kieImageModels, zenmuxImageModels } from "../../src/lib/image-models";
import type { ImageRequest } from "../../src/lib/image-provider";

const extent={width:16,height:9,offsetX:4,offsetY:2};
const original=()=>sharp({create:{width:8,height:4,channels:4,background:{r:60,g:100,b:150,alpha:.5}}}).png().toBuffer();
test("扩图预览按原图像素换算并取整，拖动范围完整包含原图",()=>{
 const source={x:228,y:114,width:200,height:100},natural={width:2000,height:1000};
 assert.deepEqual(expansionFromPreview({x:200,y:100,width:280,height:140},source,natural),{width:2800,height:1400,offsetX:280,offsetY:140});
 const box=containExpansion({x:300.3,y:150.7,width:400,height:200},source);
 const expanded=expansionFromPreview(box,source,natural);
 assert(Number.isInteger(expanded.offsetX)&&Number.isInteger(expanded.offsetY));
 assert(expanded.offsetX+natural.width<=expanded.width&&expanded.offsetY+natural.height<=expanded.height);
 assert.throws(()=>validateExpansion({width:16000,height:16000,offsetX:0,offsetY:0},natural),/6400万/);
 assert.throws(()=>validateExpansion({width:2100,height:1100,offsetX:200,offsetY:0},natural),/完整包含/);
});
test("扩图引导图具有真实画布尺寸，原图按指定位置放置",async()=>{
 const image=await original(),guide=await expansionGuide(image,extent);
 const meta=await sharp(guide).metadata();assert.equal(meta.width,16);assert.equal(meta.height,9);
 const pixel=await sharp(guide).extract({left:0,top:0,width:1,height:1}).removeAlpha().raw().toBuffer();assert.deepEqual([...pixel],[255,255,255]);
 const region=await sharp(guide).extract({left:4,top:2,width:8,height:4}).ensureAlpha().raw().toBuffer();
 assert.deepEqual(region,await sharp(image).ensureAlpha().raw().toBuffer());
});
test("扩图输出尺寸准确，原图区域含透明通道逐像素不变，仅新增区域采用模型结果",async()=>{
 const image=await original(),generated=await sharp({create:{width:32,height:18,channels:3,background:"red"}}).png().toBuffer();
 const output=await compositeExpandedEdit(image,generated,extent),meta=await sharp(output).metadata();
 assert.equal(meta.width,16);assert.equal(meta.height,9);
 assert.deepEqual(await sharp(output).extract({left:4,top:2,width:8,height:4}).ensureAlpha().raw().toBuffer(),await sharp(image).ensureAlpha().raw().toBuffer());
 assert.deepEqual([...await sharp(output).extract({left:0,top:0,width:1,height:1}).ensureAlpha().raw().toBuffer()],[255,0,0,255]);
});
test("所有模型扩图选用已登记比例，自定义范围保持精确输出尺寸",()=>{
 for(const spec of kieImageModels)assert.equal(expansionAspectRatio({width:1600,height:900,offsetX:0,offsetY:0},imageCandidate(spec)),"16:9");
 for(const spec of zenmuxImageModels)assert.equal(expansionAspectRatio({width:1600,height:900,offsetX:0,offsetY:0},spec.candidate),"16:9");
});
test("KIE上传收到源图扩展变换，产品实拍不发生变换",async()=>{
 const provider=new KieProvider(kieImageModels[0].model),uploads:unknown[]=[];
 provider.uploadFile=async(id,_force,_max,expansion)=>{uploads.push({id,expansion});return "https://fixture.invalid/"+id;};
 provider.submit=async(_model,body)=>{assert.equal(body.aspect_ratio,"16:9");return "test-task";};
 await provider.generate({prompt:"扩图",referenceImages:[{id:"source",expansion:extent},{id:"photo"}],aspectRatio:"16:9",resolution:"4K",outputFormat:"png"});
 assert.deepEqual(uploads,[{id:"source",expansion:extent},{id:"photo",expansion:undefined}]);
});
test("ZenMux两种协议收到实际扩展画布字节，回退保持参考顺序和所选分辨率",async()=>{
 const previous=process.env.ZENMUX_API_KEY;process.env.ZENMUX_API_KEY="local-test";
 try{
  const image=await original(),guide=await expansionGuide(image,extent);
  const request:ImageRequest={prompt:"扩图",referenceImages:[{id:"source",expansion:extent},{id:"photo"}],aspectRatio:"16:9",resolution:"4K",outputFormat:"png"};
  for(const model of ["google/gemini-nano-banana-2.1","openai/gpt-image-2.5-sunburst"]){
   let verified=false;
   const verify=(bytes:string[])=>{assert.deepEqual(bytes.map(b=>Buffer.from(b,"base64")),[guide,image]);verified=true;};
   const provider=new ZenMuxImageProvider(model,{models:{
    generateContent:async body=>{const contents=body.contents as {parts:{inlineData?:{data:string}}[]}[];verify(contents[0].parts.flatMap(p=>p.inlineData?[p.inlineData.data]:[]));assert.equal(body.config?.imageConfig?.imageSize,"4K");return {candidates:[{content:{parts:[{inlineData:{data:image.toString("base64")}}]}}]};},
    editImage:async body=>{verify(body.referenceImages.map(r=>((r as unknown as {referenceImage:{imageBytes:string}}).referenceImage.imageBytes)));assert.equal(body.config?.httpOptions?.extraBody?.resolution,"4K");return {generatedImages:[{image:{imageBytes:image.toString("base64")}}]};},
   }},async()=>({bytes:Buffer.from(image),mime:"image/png"}));
   await provider.generate(request);assert(verified);
  }
 }finally{if(previous===undefined)delete process.env.ZENMUX_API_KEY;else process.env.ZENMUX_API_KEY=previous;}
});
