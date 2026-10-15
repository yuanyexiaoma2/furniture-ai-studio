"use client";
import {create} from "zustand";
import {createJSONStorage,persist} from "zustand/middleware";
import {seedLibrary,designer,administrator} from "@/design-preview/mock/library";
import {chooseFreshRecipe,PromptComposer,type ComposedPrompt,type ComposeInput} from "@/design-preview/library/prompt-composer";
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
 startTask:()=>void;startDemo:(categoryId?:string,mode?:ShootingMode)=>void;setTemplate:(id:string,variables?:Record<string,string>)=>void;skipStrict:()=>void;seenQuick:()=>void;acknowledgeSingle:()=>void;updateFeature:(key:string,value:string,locked:boolean)=>void;
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
 return{template,product:clone(task.product),propSets:groups,props,selectedPropIds,variables:variables??task.variables,references:refs,actor:designer};
}
export const useLibraryStore=create<State>()(persist((set,get)=>({
 ...initial(),
 setDraftCategory:categoryId=>{const category=get().data.categories.find(c=>c.id===categoryId);if(category)set({draftCategoryId:categoryId,draftMode:category.defaultShootingMode,draftTemplateId:""});},
 setMode:(mode,active=false)=>set(s=>active&&s.task?{task:{...s.task,product:{...s.task.product,shootingMode:mode},strictSkipped:false,shootingPrompted:false}}:{draftMode:mode}),
 ingest:(photos,documents,active=false)=>set(s=>active&&s.task?{task:{...s.task,product:{...s.task.product,photos:[...s.task.product.photos,...photos]},documentNames:[...s.task.documentNames,...documents]}}:{draftPhotos:[...s.draftPhotos,...photos],draftDocuments:[...s.draftDocuments,...documents]}),
 setAngle:(photoId,angle)=>set(s=>s.task?{task:{...s.task,product:{...s.task.product,photos:s.task.product.photos.map(p=>p.id===photoId?{...p,angle,angleSource:"manual"}:p)}}}:{}),
 startTask:()=>{const s=get();set({task:{...taskBase(s.data,s.draftCategoryId,s.draftMode,s.draftPhotos,s.draftDocuments,s.draftTemplateId),variables:s.draftVariables},planned:[]});},
 startDemo:(catId="C01",mode)=>{const s=get(),p=s.data.products.find(p=>p.categoryId===catId)??s.data.products[0];set({task:taskBase(s.data,catId,mode??s.data.categories.find(c=>c.id===catId)!.defaultShootingMode,p.photos,[]),planned:[]});},
 setTemplate:(templateId,variables={})=>{const template=get().data.scenes.find(t=>t.id===templateId&&canView(t,designer));if(!template)return;const s=get();if(s.task&&template.categoryIds.includes(s.task.product.categoryId))set({task:{...s.task,templateId,stage:"ready",variables},planned:[]});else set({draftCategoryId:template.categoryIds[0],draftTemplateId:templateId,draftVariables:variables,draftMode:s.data.categories.find(c=>c.id===template.categoryIds[0])!.defaultShootingMode});},
 skipStrict:()=>set(s=>s.task?{task:{...s.task,strictSkipped:true,shootingPrompted:true,messages:[...s.task.messages,{id:id("M"),role:"assistant",text:"好，先按现有实拍继续。以后补充时，产品卡会一起更新。"}]}}:{}),
 seenQuick:()=>set(s=>s.task?{task:{...s.task,quickHintSeen:true}}:{}),
 acknowledgeSingle:()=>set(s=>s.task?{task:{...s.task,singlePhotoAcknowledged:true}}:{}),
 updateFeature:(key,value,locked)=>set(s=>s.task?{task:{...s.task,product:{...s.task.product,features:s.task.product.features.map(f=>f.key===key?{key,value,locked}:f)}}}:{}),
 finishManualEdit:(imageId,images,instruction,model)=>set(s=>{if(!s.task)return{};const parent=s.data.recipes.find(r=>r.imageId===imageId),input=composeInput(s,parent?.variables),previous={id:imageId,image:parent?.image??images[0].image},composed=PromptComposer.edit(input,previous,instruction);const source=parent??s.data.recipes.find(r=>s.task!.recipeIds.includes(r.id));if(!source)return{};const recipes=images.map(img=>({...clone(source),model:model??source.model,id:id("E"),imageId:img.id,image:img.image,parentRecipeId:parent?.id,createdAt:stamp(),finalPrompt:composed.finalPrompt,originalPhotoIds:composed.originalPhotoIds,productSnapshot:{features:clone(s.task!.product.features),dimensions:clone(s.task!.product.dimensions)}}));return{data:{...s.data,recipes:[...s.data.recipes,...recipes]},task:{...s.task,recipeIds:[...s.task.recipeIds,...recipes.map(r=>r.id)]}};}),
 appendMessage:text=>set(s=>{
  if(!s.task)return{};const normalized=normalizeDescription(text),count=(s.task.descriptionCounts[normalized]??0)+1;
  const suggestion:Suggestion={id:id("A"),kind:"snippet",name:text.trim().slice(0,18),text:text.trim(),tags:[s.data.categories.find(c=>c.id===s.task!.product.categoryId)!.name],status:"suggested"};
  return{task:{...s.task,messages:[...s.task.messages,{id:id("M"),role:"user",text}],descriptionCounts:{...s.task.descriptionCounts,[normalized]:count},suggestions:count===2&&normalized.length>=6&&!s.suppressed.snippet?[...s.task.suggestions,suggestion]:s.task.suggestions}};
 }),
 preparePlan:(count,cost)=>{
  const s=get();if(!s.task)return;const input=composeInput(s),plans:ComposedPrompt[]=[],reservations=clone(s.data.recipes);
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
