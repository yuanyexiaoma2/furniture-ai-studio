import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import sharp from "sharp";
import {adaptCategoryPatterns} from "../../src/lib/category-pattern-seed";
import {retrievePatterns,validateVisualPlan,composeVisualSlot,sanitizePrompt,wrapImagePrompt,IMAGE_CONTENT_RULE} from "../../src/lib/visual-plan-rules";
import {compositeMaskedEdit} from "../../src/lib/masked-edit";
import {fixture} from "../fixtures/visual-plan";

const raw=JSON.parse(readFileSync("docs/seeds/shoe-rack-vertical.json","utf8")),entries=adaptCategoryPatterns(raw);
test("种子转换：五种类型齐全，产品身份和具体尺寸不进入经验库",()=>{
 assert.equal(entries.length,24);assert.equal(new Set(entries.map(e=>e.type)).size,5);
 const text=JSON.stringify(entries);for(const value of ["132","32.5","19cm","13.5cm","2根白色立柱","7块原木色层板","sku_identity"])assert.equal(text.includes(value),false,value);
 assert.ok(entries.every(e=>e.is_sample===false&&e.source==="用户提供"));
});
test("检索：排除示例和待上传案例",()=>{const result=retrievePatterns([...entries,{...entries[0],id:"sample",is_sample:true}],"鞋架",["窄空间"]);assert.equal(result.entries.length,15);assert.ok(result.entries.every(e=>e.id!=="sample"&&e.status==="ready"));});
test("检索：缺同品类时明确相近品类；无关联不乱用",()=>{assert.match(retrievePatterns(entries,"书架",[]).note,/相近品类/);assert.equal(retrievePatterns(entries,"餐桌",[]).entries.length,0);});
test("方案：场景去重、道具去重、同 SKU combinationKey 去重",()=>{
 const p=validateVisualPlan(fixture);assert.ok(p.slots[0].combinationKey);
 assert.throws(()=>validateVisualPlan(p,[p.slots[0].combinationKey]),/组合重复/);
 assert.throws(()=>validateVisualPlan({...p,slots:[p.slots[0],{...p.slots[0],key:"other",props:["花瓶"]}]}),/场景图/);
 assert.throws(()=>validateVisualPlan({...p,slots:[p.slots[0],{...p.slots[0],key:"other",scene:"衣帽间"}]}),/道具重复/);
});
test("方案：拒绝伪造依据、重复图位",()=>{assert.throws(()=>validateVisualPlan({...fixture,slots:[{...fixture.slots[0],evidence:["fake"]}]}),/依据/);assert.throws(()=>validateVisualPlan({...fixture,slots:[fixture.slots[0],fixture.slots[0]]}),/图位标识/);});
test("最终摄影意图：后期说明、内部依据不进入提示词",()=>{const text=composeVisualSlot(fixture.slots[0]);assert.ok(text.includes("干净摄影底图"));assert.equal(text.includes("scene-a"),false);assert.equal(text.includes("尺寸后期添加"),false);});
test("sanitizePrompt：去掉 SKU、内部 ID 和物理尺寸，保留结构事实",()=>{
 const text=sanitizePrompt("SKU: WN81XJ01G2，productId=cmv9b8fmb0000o4v8eym7cy21。高132cm，28x28cm，间距13.5厘米，8层架，原木纹理",["WN81XJ01G2"]);
 assert.doesNotMatch(text,/WN81|cmv9|132|13\.5|28x28/);assert.match(text,/8层/);assert.match(text,/原木纹理/);
});
test("最终限制只追加一次",()=>{const once=wrapImagePrompt("摄影输入"),twice=wrapImagePrompt(once);assert.equal(twice,once);assert.equal(twice.split(IMAGE_CONTENT_RULE).length,2);});
test("蒙版合成：黑色区域逐像素保留，白色区域替换",async()=>{
 const original=await sharp({create:{width:4,height:4,channels:3,background:"#ff0000"}}).png().toBuffer(),generated=await sharp({create:{width:4,height:4,channels:3,background:"#0000ff"}}).png().toBuffer();
 const mask=await sharp(Buffer.from([255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]),{raw:{width:4,height:4,channels:1}}).png().toBuffer();
 const result=await sharp(await compositeMaskedEdit(original,generated,mask)).raw().toBuffer();assert.deepEqual([...result.slice(0,3)],[0,0,255]);for(let i=3;i<result.length;i+=3)assert.deepEqual([...result.slice(i,i+3)],[255,0,0]);
});
test("蒙版尺寸不符拒绝合成",async()=>{const image=await sharp({create:{width:4,height:4,channels:3,background:"white"}}).png().toBuffer(),mask=await sharp({create:{width:2,height:2,channels:3,background:"black"}}).png().toBuffer();await assert.rejects(compositeMaskedEdit(image,image,mask),/尺寸/);});
