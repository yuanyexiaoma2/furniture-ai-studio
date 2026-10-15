import test from "node:test";
import assert from "node:assert/strict";
import {useLibraryStore,libraryEntries} from "../../src/components/design-preview/library/library-store";
import {administrator,designer,librarian} from "../../src/design-preview/mock/library";
import {coverage} from "../../src/design-preview/library/rules";
test("快速档两张实拍直接规划，配方逐张冻结且不重复",()=>{
 const s=useLibraryStore;s.getState().reset();const photos=s.getState().data.products[0].photos.slice(0,2);
 s.getState().ingest(photos,["规格.pdf"]);s.getState().startTask();s.getState().preparePlan(4,.124);
 assert.equal(s.getState().planned.length,4);assert.equal(new Set(s.getState().planned.map(p=>p.combinationKey)).size,4);
 s.getState().finishGeneration([1,2,3,4].map(i=>({id:"test-"+i,image:"/mock-"+i+".webp"})),"mock-model");
 const task=s.getState().task!;assert.equal(task.stage,"generated");assert.equal(task.strictSkipped,false);
 for(const recipe of s.getState().data.recipes.filter(r=>task.recipeIds.includes(r.id))){assert.deepEqual(recipe.originalPhotoIds,[...photos.map(p=>p.id)].sort());assert(recipe.finalPrompt.includes("Locked product features"));}
});
test("终稿沉淀移除产品描述，个人->待审->公共，角色限制",()=>{
 const s=useLibraryStore;s.getState().suggestScene("test-1","/mock-1.webp");
 const suggestion=s.getState().task!.suggestions[0];assert.equal(suggestion.kind,"scene");
 const entryId=s.getState().saveSuggestion(suggestion.id,"卧室·边桌·我的晨光");
 const scene=s.getState().data.scenes.find(e=>e.id===entryId)!;
 assert.equal(scene.visibility,"private");assert(scene.skeleton.includes("{product}"));assert(!scene.skeleton.includes("栖木"));assert(scene.sourceRecipeId);
 s.getState().recommend(entryId);assert.equal(s.getState().data.scenes.find(e=>e.id===entryId)!.visibility,"pending");
 assert.throws(()=>s.getState().review(entryId,true,designer),/仅管理员/);
 s.getState().review(entryId,true,librarian);assert.equal(s.getState().data.scenes.find(e=>e.id===entryId)!.visibility,"public");
});
test("严格档 5/7 可跳过，补拍与手动标签实时更新",()=>{
 const s=useLibraryStore;s.getState().startDemo("C02","strict");const category=s.getState().data.categories[1];
 assert.equal(coverage(s.getState().task!.product,category).present,5);
 s.getState().skipStrict();s.getState().preparePlan(1,.03);assert.equal(s.getState().task!.stage,"planned");
 s.getState().ingest([{...s.getState().task!.product.photos[0],id:"OEXTRA",angle:"back"}],[],true);
 assert.equal(coverage(s.getState().task!.product,category).present,6);
 s.getState().setAngle("OEXTRA","hardware");assert.equal(coverage(s.getState().task!.product,category).present,6);
 s.getState().setMode("quick",true);s.getState().seenQuick();assert.equal(s.getState().task!.quickHintSeen,true);
});
test("描述第二次出现提示片段，同类不再提示按用户持久化",()=>{
 const s=useLibraryStore;s.getState().startDemo();s.getState().appendMessage("自然光、少一点装饰");
 assert.equal(s.getState().task!.suggestions.length,0);
 s.getState().appendMessage("自然光、少一点装饰");const suggestion=s.getState().task!.suggestions[0];assert.equal(suggestion.kind,"snippet");
 const entryId=s.getState().saveSuggestion(suggestion.id);assert.equal(s.getState().data.snippets.find(e=>e.id===entryId)!.visibility,"private");
 s.getState().suppress(suggestion.id,true);s.getState().startDemo();s.getState().appendMessage("让光线更柔和一些");s.getState().appendMessage("让光线更柔和一些");
 assert.equal(s.getState().task!.suggestions.length,0);
});
test("道具框选保存保留修订语义和裁切来源，参考保存默认个人",()=>{
 const s=useLibraryStore;s.getState().suggestCapture("prop","I01","data:image/webp;base64,MOCK",{x:.1,y:.2,width:.3,height:.4},{name:"玻璃花瓶",keywordsEn:"clear glass vase",shape:"圆柱",color:"透明",material:"玻璃",tags:["边桌","卧室"]});
 const suggestion=s.getState().task!.suggestions.at(-1)!;const entryId=s.getState().saveSuggestion(suggestion.id);
 const prop=s.getState().data.props.find(p=>p.id===entryId)!;assert.equal(prop.material,"玻璃");assert.equal(prop.keywordsEn,"clear glass vase");assert.equal(prop.visibility,"private");
 s.getState().suggestCapture("reference","I01","/mock.webp");const reference=s.getState().task!.suggestions.at(-1)!;const refId=s.getState().saveSuggestion(reference.id);assert.equal(s.getState().data.references.find(r=>r.id===refId)!.visibility,"private");
});
test("品类默认标准影响新任务，详情变量选择进入拼装器",()=>{
 const s=useLibraryStore,c=s.getState().data.categories[0];s.getState().updateCategory({...c,defaultShootingMode:"strict"});s.getState().setDraftCategory(c.id);assert.equal(s.getState().draftMode,"strict");
 s.getState().setTemplate("S01",{palette:"sand beige and walnut brown"});assert.equal(s.getState().task!.variables.palette,"sand beige and walnut brown");
 s.getState().review(libraryEntries(s.getState().data).find(e=>e.visibility==="pending")!.id,false,administrator);
 s.getState().reset();
});

test("连续手动修图每轮都携带全部原始实拍，完整图片路径不重复拼接",async()=>{
 const {usePreviewStore,imagePath}=await import("../../src/components/design-preview/store");
 const s=useLibraryStore;s.getState().reset();s.getState().startDemo();s.getState().preparePlan(1,.036);
 s.getState().finishGeneration([{id:"EDITBASE",image:"/design-preview/r3-25.webp"}],"mock-model");
 usePreviewStore.getState().restoreTask([{id:"EDITBASE",image:"/design-preview/r3-25.webp"}]);
 assert.equal(imagePath("/design-preview/r3-25.webp"),"/design-preview/r3-25.webp");
 for(let round=0;round<2;round++){const image=usePreviewStore.getState().nodes.filter(n=>n.type==="picture").at(-1)!;
 await usePreviewStore.getState().simulate(image.id,"paint",request=>{assert.equal(request.originalPhotoReferences.length,5);assert.equal(request.originalImage,"/design-preview/r3-25.webp");assert(request.productReferences.includes(request.originalPhotoReferences[0]));});
 const result=s.getState().data.recipes.at(-1)!;assert.equal(result.originalPhotoIds.length,5);assert(result.parentRecipeId);assert.equal(result.image,"/design-preview/r3-25.webp");assert.notEqual(result.model,"mock-model");
 }
 s.getState().startTask();await assert.rejects(()=>usePreviewStore.getState().simulate("EDITBASE","erase"),/原始实拍/);s.getState().reset();usePreviewStore.getState().reset();
});
