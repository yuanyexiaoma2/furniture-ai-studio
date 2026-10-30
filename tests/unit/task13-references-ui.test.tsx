import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {SlotReferences} from "../../src/components/design-preview/slot-references";
import {ImageReferenceInfo} from "../../src/components/design-preview/image-reference-info";
import {VisualPlanCard} from "../../src/components/design-preview/visual-plan-card";
import {fixture} from "../fixtures/visual-plan";
Object.assign(globalThis,{React});
const images=[{assetId:"style-a",role:"reference" as const,purpose:"光线"},{assetId:"style-b",role:"reference" as const,purpose:"构图"},{assetId:"photo",role:"product" as const,purpose:"产品身份"}];
test("图位卡显示参考缩略图、用途、移除和当前对话替换选项，排除产品图",()=>{
 const html=renderToStaticMarkup(<SlotReferences name="门厅" references={[{assetId:"style-a",purpose:"光线"}]} images={images} disabled={false} onChange={()=>{}}/>);
 assert(html.includes('/api/assets/style-a'));assert(html.includes('去掉参考图'));assert(html.includes('替换参考图'));assert(html.includes('style-b'));assert(!html.includes('value="photo"'));assert(!html.includes('role="dialog"'));
});
test("已有两张时不再提供添加第三张；方案卡的图位实际接入参考编辑器",()=>{
 const references=images.filter(i=>i.role==="reference").map(({assetId,purpose})=>({assetId,purpose}));
 const html=renderToStaticMarkup(<SlotReferences name="门厅" references={references} images={images} disabled={false} onChange={()=>{}}/>);assert(!html.includes('添加参考图'));
 const plan={...structuredClone(fixture),conversationImages:images,slots:[{...fixture.slots[0],references}]};
 const card=renderToStaticMarkup(<VisualPlanCard cardId="card" initial={plan} busy={false} act={async()=>{}}/>);assert(card.includes('/api/assets/style-a'));assert(card.includes('/api/assets/style-b'));assert(card.includes('确认并冻结方案'));
});
test("图片信息展示实际使用的参考和超限省略，产品实拍不误报为风格参考",()=>{
 const html=renderToStaticMarkup(<ImageReferenceInfo usage={[{assetId:"photo",role:"product",purpose:"身份"},{assetId:"style-a",role:"reference",purpose:"光线"}]} omitted={[{assetId:"style-b",role:"reference",purpose:"构图"}]} limit={3}/>);
 assert(html.includes('使用参考图 1 张'));assert(html.includes('/api/assets/style-a'));assert(!html.includes('/api/assets/photo'));assert(!html.includes('/api/assets/style-b'));assert(html.includes('未传入：参考图'));assert(html.includes('构图'));assert(html.includes('模型上限 3 张'));
});
