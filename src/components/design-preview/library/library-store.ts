"use client";
/** 此文件虽沿用mock命名和旧原型状态，但被真实功能引用，不可删除。
 * 具体用途：首页readMockFiles把用户文件转为图片Data URL/文档文件名，供真实附件预览、逐个移除和原文件上传配对；画布也复用上传预览/引用。
 * 暂停的是假库展示，不是这些共享工具；后续将共享类型、真实附件预览和旧原型状态分别拆分改名。
 */
import {create} from "zustand";
import {createJSONStorage,persist} from "zustand/middleware";
import {seedLibrary,designer,administrator} from "@/design-preview/mock/library";
import {chooseFreshRecipe,PromptComposer,type ComposedPrompt,type ComposeInput} from "@/design-preview/library/prompt-composer";
import {assignedBrand,useWorkflowStore} from "../batch/workflow-store";
import {recognizeMockCategory} from "@/design-preview/library/category-recognition";
import {canReview,canView,guessMockAngle,normalizeDescription} from "@/design-preview/library/rules";
import type {Actor,CaptureKind,Category,GenerationRecipe,LibraryData,LibraryEntry,ProductPhoto,PrototypeTask,ShootingMode,ShotAngle,Suggestion} from "@/design-preview/library/types";
const id=(prefix:string)=>prefix+crypto.randomUUID().replaceAll("-","").slice(0,12).toUpperCase();
const stamp=()=>new Date().toISOString();
const clone=<T,>(x:T):T=>structuredClone(x);
const taskBase=(data:LibraryData,catId:string,mode:ShootingMode,photos:ProductPhoto[],documents:string[],templateId?:string):PrototypeTask=>{
 const category=data.categories.find(c=>c.id===catId)??data.categories[0];
 const product=clone(data.products.find(p=>p.categoryId===category.id)??data.products[0]);
 Object.assign(product,{categoryId:category.id,categoryIds:[category.id],name:category.name==="边桌"?"栖木 · 原木边桌":category.name+" · 新创作",shootingMode:mode,photos:clone(photos),visibility:"private",owner:designer.id});
 const template=data.scenes.find(s=>s.id===templateId&&s.categoryIds.includes(catId)&&canView(s,designer))??data.scenes.find(s=>s.categoryIds.includes(catId)&&canView(s,designer));
 return{id:id("T"),product,documentNames:documents,stage:"ready",templateId:template?.id??"",variables:{},recipeIds:[],messages:[{id:id("M"),role:"assistant",text:photos.length?"资料收好了。先选适合产品的场景，再一起挑出最好的画面。":"把产品实拍放进来，我会先整理特征，再给你一份图包方案。"}],suggestions:[],shootingPrompted:false,strictSkipped:false,singlePhotoAcknowledged:false,quickHintSeen:false,descriptionCounts:{},estimatedCost:0,feeConfirmed:false,createdAt:stamp()};
};
type State={data:LibraryData;draftCategoryId:string;draftMode:ShootingMode;draftPhotos:ProductPhoto[];draftDocuments:string[];draftTemplateId:string;draftVariables:Record<string,string>;task:PrototypeTask|null;planned:ComposedPrompt[];suppressed:Record<CaptureKind,boolean>;
 setDraftCategory:(id:string)=>void;setMode:(mode:ShootingMode,active?:boolean)=>void;ingest:(photos:ProductPhoto[],documents:string[],active?:boolean)=>void;setAngle:(id:string,angle:ShotAngle)=>void;
 removeDraftPhoto:(id:string)=>void;removeDraftDocument:(index:number)=>void;confirmCategory:(id?:string)=>void;chooseShootingMode:(mode:ShootingMode)=>void;startTask:(description?:string)=>void;startDemo:(categoryId?:string,mode?:ShootingMode)=>void;setTemplate:(id:string,variables?:Record<string,string>)=>void;skipStrict:()=>void;seenQuick:()=>void;acknowledgeSingle:()=>void;updateFeature:(key:string,value:string,locked:boolean)=>void;
 finishManualEdit:(imageId:string,images:{id:string;image:string}[],instruction:string,model?:string)=>void;appendMessage:(text:string)=>void;preparePlan:(count:number,cost:number)=>void;finishGeneration:(images:{id:string;image:string}[],model:string)=>void;
 suggestScene:(imageId:string,image:string)=>void;suggestCapture:(kind:"reference"|"prop",imageId:string,image:string,crop?:Suggestion["crop"],extracted?:Suggestion["extracted"])=>void;
 saveSuggestion:(id:string,name?:string)=>string;suppress:(id:string,forever?:boolean)=>void;recommend:(entryId:string)=>void;review:(entryId:string,approve:boolean,actor:Actor)=>void;updateCategory:(category:Category)=>void;reset:()=>void;
};
const initial=()=>({data:clone(seedLibrary),draftCategoryId:"C01",draftMode:"quick" as ShootingMode,draftPhotos:[],draftDocuments:[],draftTemplateId:"",draftVariables:{},task:null,planned:[],suppressed:{scene:false,reference:false,prop:false,snippet:false}});
export function libraryEntries(data:LibraryData):LibraryEntry[]{return[...data.scenes,...data.props,...data.propSets,...data.references,...data.snippets];}
export function composeInput(state:Pick<State,"data"|"task">,variables?:Record<string,string>):ComposeInput{
 const {data,task}=state;if(!task)throw new Error("先创建任务");
 const template=data.scenes.find(s=>s.id===task.templateId&&canView(s,designer));if(!template)throw new Error("请为这个品类选择一个可用场景");
 const groups=data.propSets.filter(g=>template.defaultPropSetIds.includes(g.id)&&canView(g,designer));
 const props=data.props.filter(p=>canView(p,designer)),selectedPropIds=[...new Set(groups.flatMap(g=>g.propIds.filter(id=>props.some(p=>p.id===id)).sort().slice(0,g.maxPick)))];
 const refs=data.references.filter(r=>canView(r,designer)&&r.categoryIds.includes(task.product.categoryId)&&template.tags.includes(r.spaceTag)).slice(0,1);
 return{brand:assignedBrand(task.product.sku),template,product:clone(task.product),propSets:groups,props,selectedPropIds,variables:variables??task.variables,references:refs,actor:designer};
}
export const useLibraryStore=create<State>()(persist((set,get)=>({
 ...initial(),
 setDraftCategory:categoryId=>{const category=get().data.categories.find(c=>c.id===categoryId);if(category)set({draftCategoryId:categoryId,draftMode:category.defaultShootingMode,draftTemplateId:""});},
 setMode:(mode,active=false)=>set(s=>active&&s.task?{task:{...s.task,product:{...s.task.product,shootingMode:mode},shootingChoicePending:false,strictSkipped:false,shootingPrompted:false}}:{draftMode:mode}),
 ingest:(photos,documents,active=false)=>set(s=>{if(active&&s.task){const recognized=recognizeMockCategory(s.data.categories,"",photos),classification=s.task.categoryConfirmed===false&&s.task.categorySource==="unknown"&&photos.length?{categorySuggestionId:recognized.categoryId,categorySource:recognized.source}:{};return{task:{...s.task,...classification,product:{...s.task.product,photos:[...s.task.product.photos,...photos]},documentNames:[...s.task.documentNames,...documents]}};}return{draftPhotos:[...s.draftPhotos,...photos],draftDocuments:[...s.draftDocuments,...documents]};}),
 setAngle:(photoId,angle)=>set(s=>s.task?{task:{...s.task,product:{...s.task.product,photos:s.task.product.photos.map(p=>p.id===photoId?{...p,angle,angleSource:"manual"}:p)}}}:{}),
 removeDraftPhoto:photoId=>set(s=>({draftPhotos:s.draftPhotos.filter(p=>p.id!==photoId)})),
 removeDraftDocument:index=>set(s=>({draftDocuments:s.draftDocuments.filter((_,i)=>i!==index)})),
 startTask:(description="")=>{const s=get(),recognized=recognizeMockCategory(s.data.categories,description,s.draftPhotos),task=taskBase(s.data,recognized.categoryId??s.draftCategoryId,"quick",s.draftPhotos,s.draftDocuments,s.draftTemplateId);task.product.name="新产品";Object.assign(task,{categoryConfirmed:false,categorySuggestionId:recognized.categoryId,categorySource:recognized.source,shootingChoicePending:false,variables:s.draftVariables,descriptionCounts:description.trim()?{[normalizeDescription(description)]:1}:{}});task.messages=[{id:id("M"),role:"assistant",text:s.draftPhotos.length?"资料收好了，先一起确认这件产品。":"先确认一下产品，再一起整理创作方向。"},...(description.trim()?[{id:id("M"),role:"user" as const,text:description.trim()}]:[])];set({task,planned:[]});useWorkflowStore.getState().dismiss();},
 confirmCategory:categoryId=>set(s=>{if(!s.task)return{};const category=s.data.categories.find(c=>c.id===(categoryId??s.task!.categorySuggestionId));if(!category)return{};const previous=s.task.product.categoryId,changed=previous!==category.id;if(s.task.categoryConfirmed!==false&&!changed)return{};const template=s.data.scenes.find(t=>t.id===s.task!.templateId&&t.categoryIds.includes(category.id)&&canView(t,designer))??s.data.scenes.find(t=>t.categoryIds.includes(category.id)&&canView(t,designer));return{planned:[],task:{...s.task,categoryConfirmed:true,categorySuggestionId:category.id,shootingChoicePending:category.defaultShootingMode==="strict",product:{...s.task.product,name:category.name+" · 新创作",categoryId:category.id,categoryIds:[category.id],tags:[category.name],shootingMode:"quick"},templateId:template?.id??"",variables:changed?{}:s.task.variables,stage:"ready",strictSkipped:false,shootingPrompted:false,messages:[...s.task.messages,{id:id("M"),role:"assistant",text:"已确认品类为"+category.name+"。"}]}};}),
 chooseShootingMode:mode=>set(s=>s.task&&s.task.categoryConfirmed!==false?{task:{...s.task,shootingChoicePending:false,product:{...s.task.product,shootingMode:mode},strictSkipped:false,shootingPrompted:false,messages:[...s.task.messages,{id:id("M"),role:"assistant",text:mode==="strict"?"好，按严格标准核对；缺少的实拍也可以先跳过。":"好，这次先快速开始，用现有资料继续。"}]}}:{}),
 startDemo:(catId="C01",mode)=>{const s=get(),p=s.data.products.find(p=>p.categoryId===catId)??s.data.products[0];set({task:taskBase(s.data,catId,mode??"quick",p.photos,[]),planned:[]});},
 setTemplate:(templateId,variables={})=>{const template=get().data.scenes.find(t=>t.id===templateId&&canView(t,designer));if(!template)return;const s=get();if(s.task&&template.categoryIds.includes(s.task.product.categoryId))set({task:{...s.task,templateId,stage:"ready",variables},planned:[]});else set({draftCategoryId:template.categoryIds[0],draftTemplateId:templateId,draftVariables:variables,draftMode:s.data.categories.find(c=>c.id===template.categoryIds[0])!.defaultShootingMode});},
 skipStrict:()=>set(s=>s.task?{task:{...s.task,strictSkipped:true,shootingPrompted:true,messages:[...s.task.messages,{id:id("M"),role:"assistant",text:"好，先按现有实拍继续。以后补充时，产品卡会一起更新。"}]}}:{}),
 seenQuick:()=>set(s=>s.task?{task:{...s.task,quickHintSeen:true}}:{}),
 acknowledgeSingle:()=>set(s=>s.task?{task:{...s.task,singlePhotoAcknowledged:true}}:{}),
 updateFeature:(key,value,locked)=>set(s=>s.task?{task:{...s.task,product:{...s.task.product,features:s.task.product.features.map(f=>f.key===key?{key,value,locked}:f)}}}:{}),
 finishManualEdit:(imageId,images,instruction,model)=>set(s=>{if(!s.task)return{};const parent=s.data.recipes.find(r=>r.imageId===imageId),input=composeInput(s,parent?.variables),previous={id:imageId,image:parent?.image??images[0].image},composed=PromptComposer.edit(input,previous,instruction);const source=parent??s.data.recipes.find(r=>s.task!.recipeIds.includes(r.id));if(!source)return{};const recipes=images.map(img=>({...clone(source),model:model??source.model,id:id("E"),imageId:img.id,image:img.image,parentRecipeId:parent?.id,createdAt:stamp(),finalPrompt:composed.finalPrompt,originalPhotoIds:composed.originalPhotoIds,productSnapshot:{features:clone(s.task!.product.features),dimensions:clone(s.task!.product.dimensions)}}));return{data:{...s.data,recipes:[...s.data.recipes,...recipes]},task:{...s.task,recipeIds:[...s.task.recipeIds,...recipes.map(r=>r.id)]}};}),
 appendMessage:text=>set(s=>{
  if(!s.task)return{};const recognized=recognizeMockCategory(s.data.categories,text,[]);const classification=s.task.categoryConfirmed===false&&recognized.categoryId?{categorySuggestionId:recognized.categoryId,categorySource:recognized.source}:{};const normalized=normalizeDescription(text),count=(s.task.descriptionCounts[normalized]??0)+1;
  const suggestion:Suggestion={id:id("A"),kind:"snippet",name:text.trim().slice(0,18),text:text.trim(),tags:[s.data.categories.find(c=>c.id===s.task!.product.categoryId)!.name],status:"suggested"};
  return{task:{...s.task,...classification,messages:[...s.task.messages,{id:id("M"),role:"user",text}],descriptionCounts:{...s.task.descriptionCounts,[normalized]:count},suggestions:count===2&&normalized.length>=6&&!s.suppressed.snippet?[...s.task.suggestions,suggestion]:s.task.suggestions}};
 }),
 preparePlan:(count,cost)=>{
  const s=get();if(!s.task)return;if(s.task.categoryConfirmed===false)throw new Error("先确认一下产品品类");if(s.task.shootingChoicePending)throw new Error("先确认这次的拍摄标准");const input=composeInput(s),plans:ComposedPrompt[]=[],reservations=clone(s.data.recipes);
  for(let i=0;i<Math.min(4,Math.max(1,count));i++){const plan=chooseFreshRecipe(input,reservations,new Date());plans.push(plan);reservations.push({...s.data.recipes[0],sku:s.task.product.sku,categoryId:s.task.product.categoryId,createdAt:stamp(),combinationKey:plan.combinationKey});}
  set({planned:plans,task:{...s.task,stage:"planned",variables:plans[0].variables,estimatedCost:cost,feeConfirmed:false,shootingPrompted:s.task.product.shootingMode==="strict"||s.task.shootingPrompted}});
 },
 finishGeneration:(images,model)=>set(s=>{
  if(!s.task||!s.planned.length)return{};const input=composeInput(s),createdAt=stamp();
  // 补拍后重新拼装冻结原始实拍，避免复用旧的参考列表。
  const recipes=images.map((img,i):GenerationRecipe=>{const planned=s.planned[i%s.planned.length],composed=PromptComposer.compose({...input,variables:planned.variables,selectedPropIds:planned.propIds,references:s.data.references.filter(r=>planned.refIds.includes(r.id))});return{id:id("E"),name:s.task!.product.name+" · 候选 "+(i+1),owner:designer.id,visibility:"private",tags:[s.task!.product.name],categoryIds:[s.task!.product.categoryId],createdAt,stats:{used:0,liked:0},sku:s.task!.product.sku,categoryId:s.task!.product.categoryId,templateId:s.task!.templateId,propIds:composed.propIds,variables:composed.variables,refIds:composed.refIds,model,finalPrompt:composed.finalPrompt,combinationKey:composed.combinationKey,originalPhotoIds:composed.originalPhotoIds,imageId:img.id,image:img.image,productSnapshot:{features:clone(s.task!.product.features),dimensions:clone(s.task!.product.dimensions)},templateSnapshot:{skeleton:input.template.skeleton,fixed:clone(input.template.fixed)}};});
  return{data:{...s.data,recipes:[...s.data.recipes,...recipes],scenes:s.data.scenes.map(t=>t.id===s.task!.templateId?{...t,stats:{...t.stats,used:t.stats.used+images.length}}:t)},task:{...s.task,stage:"generated",recipeIds:[...s.task.recipeIds,...recipes.map(r=>r.id)],feeConfirmed:true,messages:[...s.task.messages,{id:id("M"),role:"assistant",text:"候选已经放到画布了。喜欢的设为终稿，想修改哪一处，选中图片告诉我就好。"}]}};
 }),
 suggestScene:(imageId,image)=>set(s=>{
  if(!s.task||s.suppressed.scene||s.task.suggestions.some(a=>a.kind==="scene"&&a.imageId===imageId))return{};
  const recipe=s.data.recipes.find(r=>r.imageId===imageId),template=s.data.scenes.find(t=>t.id===recipe?.templateId);if(!recipe||!template)return{};
  const category=s.data.categories.find(c=>c.id===s.task!.product.categoryId)!;
  return{task:{...s.task,suggestions:[...s.task.suggestions,{id:id("A"),kind:"scene",imageId,image,recipeId:recipe.id,name:template.tags.find(t=>["卧室","客厅","浴室","书房"].includes(t))+"·"+category.name+"·柔光",tags:[category.name,...template.tags.filter(t=>t!==category.name)],status:"suggested"}]}};
 }),
 suggestCapture:(kind,imageId,image,crop,extracted)=>set(s=>s.task&&!s.suppressed[kind]?{task:{...s.task,suggestions:[...s.task.suggestions,{id:id("A"),kind,imageId,image,crop,extracted,name:extracted?.name??(kind==="prop"?"陶瓷杯":"自然柔光 · 空间参考"),tags:extracted?.tags??[s.data.categories.find(c=>c.id===s.task!.product.categoryId)!.name,"卧室","自然"],status:"suggested"}]}}:{}),
 saveSuggestion:(suggestionId,name)=>{
  const s=get(),suggestion=s.task?.suggestions.find(a=>a.id===suggestionId);if(!suggestion||suggestion.status!=="suggested")return"";
  const entryId=id(({scene:"S",reference:"R",prop:"P",snippet:"K"} as const)[suggestion.kind]),entryBase={id:entryId,name:name?.trim()||suggestion.name,owner:designer.id,visibility:"private" as const,tags:suggestion.tags,categoryIds:[s.task!.product.categoryId],createdAt:stamp(),stats:{used:0,liked:0}},data={...s.data};
  if(suggestion.kind==="scene"){const recipe=s.data.recipes.find(r=>r.id===suggestion.recipeId)!,source=s.data.scenes.find(t=>t.id===recipe.templateId)!;data.scenes=[{...clone(source),...entryBase,kind:"scene",skeleton:recipe.templateSnapshot.skeleton,fixed:recipe.templateSnapshot.fixed,coverImage:suggestion.image!,sourceRecipeId:recipe.id},...s.data.scenes];}
  if(suggestion.kind==="reference")data.references=[{...entryBase,kind:"reference",image:suggestion.image!,source:"画布保存",spaceTag:"卧室",styleTag:"自然",lightingTag:"柔和晨光",categoryTags:[s.data.categories.find(c=>c.id===s.task!.product.categoryId)!.name],usedBy:suggestion.recipeId?[suggestion.recipeId]:[],score:90},...s.data.references];
  if(suggestion.kind==="prop")data.props=[{...clone(s.data.props[0]),...entryBase,kind:"prop",refImages:[suggestion.image!],name:entryBase.name,keywordsEn:suggestion.extracted?.keywordsEn??"ceramic coffee mug",shape:suggestion.extracted?.shape??"圆柱",color:suggestion.extracted?.color??"奶油白",material:suggestion.extracted?.material??"陶瓷",size:"小",sceneTags:["卧室","客厅"],categoryTags:[s.data.categories.find(c=>c.id===s.task!.product.categoryId)!.name]},...s.data.props];
  if(suggestion.kind==="snippet")data.snippets=[{...entryBase,kind:"snippet",text:suggestion.text!,usageCount:2},...s.data.snippets];
  set({data,task:{...s.task!,suggestions:s.task!.suggestions.map(a=>a.id===suggestionId?{...a,name:entryBase.name,status:"saved",entryId}:a)}});return entryId;
 },
 suppress:(suggestionId,forever=false)=>set(s=>{const suggestion=s.task?.suggestions.find(a=>a.id===suggestionId);return suggestion?{task:{...s.task!,suggestions:s.task!.suggestions.map(a=>a.id===suggestionId?{...a,status:"dismissed"}:a)},...(forever?{suppressed:{...s.suppressed,[suggestion.kind]:true}}:{})}:{};}),
 recommend:entryId=>set(s=>{
  const entry=libraryEntries(s.data).find(e=>e.id===entryId);if(!entry||entry.owner!==designer.id||entry.visibility!=="private")return{};
  const data=clone(s.data);for(const rows of [data.scenes,data.props,data.propSets,data.references,data.snippets])for(const row of rows)if(row.id===entryId)row.visibility="pending";return{data};
 }),
 review:(entryId,approve,actor)=>set(s=>{
  if(!canReview(actor))throw new Error("仅管理员或模板编辑可审核");
  const data=clone(s.data);for(const rows of [data.scenes,data.props,data.propSets,data.references,data.snippets])for(const row of rows)if(row.id===entryId&&row.visibility==="pending")row.visibility=approve?"public":"private";return{data};
 }),
 updateCategory:category=>set(s=>({data:{...s.data,categories:s.data.categories.map(c=>c.id===category.id?clone(category):c)}})),
 reset:()=>set(initial()),
}),{name:"furniture-preview-library-8a",storage:createJSONStorage(()=>typeof window!=="undefined"?window.localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}),version:1,skipHydration:true}));
export async function readMockFiles(files:File[]):Promise<{photos:ProductPhoto[];documents:string[]}>{
 const photos:ProductPhoto[]=[],documents:string[]=[];
 for(const file of files){if(file.type.startsWith("image/")){const image=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file);});photos.push({id:id("O"),image,name:file.name,angle:guessMockAngle(file.name,photos.length),original:true,angleSource:"mock",source:"upload"});}else documents.push(file.name);}
 return{photos,documents};
}
export function originalPhotoReferences(){const state=useLibraryStore.getState();return(state.task?.product.photos??state.data.products[0].photos).map(p=>p.image);}
export const reviewActor=administrator;
