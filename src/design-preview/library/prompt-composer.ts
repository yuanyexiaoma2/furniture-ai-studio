import type {Actor,GenerationRecipe,Product,Prop,PropSet,ReferenceImage,SceneTemplate} from "./types";
import {canView,recentRecipes} from "./rules";
import type {BrandStyle} from "../workflows/types";
import {brandConstraints} from "../workflows/rules";
export type ComposeInput={dimensionsUnknown?:boolean;brand?:BrandStyle;template:SceneTemplate;product:Product;propSets:PropSet[];props:Prop[];variables:Record<string,string>;references?:ReferenceImage[];selectedPropIds?:string[];actor:Actor};
export type ComposedPrompt={finalPrompt:string;propIds:string[];variables:Record<string,string>;refIds:string[];originalPhotoIds:string[];referenceInputs:{id:string;image:string;kind:"original"|"style"|"previous"}[];combinationKey:string};
export class PromptError extends Error{constructor(public code:string,message:string){super(message);this.name="PromptError";}}
function fail(code:string,message:string):never{throw new PromptError(code,message);}
const unique=(ids:string[])=>[...new Set(ids)].sort();
export function combinationKey(templateId:string,propIds:string[],variables:Record<string,string>,refIds:string[]){return JSON.stringify({templateId,propIds:unique(propIds),variables:Object.fromEntries(Object.entries(variables).sort(([a],[b])=>a.localeCompare(b,"en"))),refIds:unique(refIds)});}
export class PromptComposer {
 static compose(input:ComposeInput):ComposedPrompt {
  const {template,product,actor}=input;
  if(!canView(template,actor))fail("FORBIDDEN","无权使用该模板");
  if(!template.categoryIds.includes(product.categoryId))fail("CATEGORY_MISMATCH","场景与产品品类不匹配");
  if(!product.photos.length||product.photos.some(p=>p.original!==true||!p.image))fail("ORIGINAL_REQUIRED","至少需要一张原始实拍");
  const reserved=["product","props"],allowed=new Set([...reserved,...template.variables.map(v=>v.key)]),slots=[...template.skeleton.matchAll(/\{([^{}]+)\}/g)].map(m=>m[1]);
  if(slots.some(k=>!allowed.has(k))||!reserved.every(k=>slots.includes(k)))fail("INVALID_SKELETON","模板含未知占位符或缺少产品/道具占位符");
  if(Object.keys(input.variables).some(k=>!template.variables.some(v=>v.key===k)))fail("INVALID_VARIABLE","存在未声明的变量");
  const variables=Object.fromEntries(template.variables.map(v=>{const value=input.variables[v.key]??v.options[0]?.value;if(!v.options.some(o=>o.value===value))fail("INVALID_VARIABLE","变量值不在可选范围："+v.key);return[v.key,value];}));
  const sets=[...input.propSets].sort((a,b)=>a.id.localeCompare(b.id,"en"));
  for(const group of sets){if(!canView(group,actor)||!group.categoryIds.includes(product.categoryId))fail("INVALID_PROP_SET","道具组不可用或品类不匹配");if(!Number.isInteger(group.maxPick)||group.maxPick<1)fail("INVALID_PROP_SET","道具组选择上限无效");}
  const propIds=unique(input.selectedPropIds??sets.flatMap(g=>[...g.propIds].sort().slice(0,g.maxPick)));
  for(const group of sets)if(propIds.filter(id=>group.propIds.includes(id)).length>group.maxPick)fail("TOO_MANY_PROPS","超过道具组最大选取数");
  const selectedProps:Prop[]=propIds.map(id=>{if(!sets.some(g=>g.propIds.includes(id)))return fail("UNKNOWN_PROP","道具不属于所选道具组");const prop=input.props.find(p=>p.id===id);if(!prop||!canView(prop,actor)||!prop.categoryIds.includes(product.categoryId))return fail("UNKNOWN_PROP","道具不存在或不可用");return prop;});
  const refs=[...(input.references??[])].sort((a,b)=>a.id.localeCompare(b.id,"en"));if(refs.some(r=>!canView(r,actor)))fail("FORBIDDEN","参考图不可用");
  const features=[...product.features].sort((a,b)=>a.key.localeCompare(b.key,"zh-CN")),dimensions=product.dimensions;
  if(!input.dimensionsUnknown&&[dimensions.width,dimensions.depth,dimensions.height].some(v=>!Number.isFinite(v)||v<=0))fail("INVALID_DIMENSIONS","尺寸必须是正数");
  const description=`${product.name}; ${features.map(f=>f.key+": "+f.value).join("; ")}; ${input.dimensionsUnknown?"dimensions unknown; do not add measurement claims":"dimensions: "+dimensions.width+" × "+dimensions.depth+" × "+dimensions.height+" "+dimensions.unit}`;
  const propText=selectedProps.length?selectedProps.map(p=>`${p.keywordsEn} (${p.shape}, ${p.color}, ${p.material}, ${p.size})`).join("; "):"no additional props",values:Record<string,string>={...variables,product:description,props:propText};
  const text=template.skeleton.replace(/\{([^{}]+)\}/g,(_,key:string)=>values[key]),originalPhotoIds=unique(product.photos.map(p=>p.id)),locked=features.filter(f=>f.locked).map(f=>f.key+": "+f.value).join("; ");
  const finalPrompt=[text,...template.fixed,brandConstraints(input.brand),"Locked product features: "+(locked||"follow the original product photographs")+".","Original identity references: "+originalPhotoIds.join(", ")+".",...(refs.length?["Environment references only: "+refs.map(r=>r.id).join(", ")+"."]:[])].map(s=>s.trim()).filter(Boolean).join("\n");
  return{finalPrompt,propIds,variables,refIds:unique(refs.map(r=>r.id)),originalPhotoIds,referenceInputs:[...[...product.photos].sort((a,b)=>a.id.localeCompare(b.id,"en")).map(p=>({id:p.id,image:p.image,kind:"original" as const})),...refs.map(r=>({id:r.id,image:r.image,kind:"style" as const}))],combinationKey:combinationKey(template.id,propIds,variables,refs.map(r=>r.id))};
 }
 static edit(input:ComposeInput,previous:{id:string;image:string},instruction:string):ComposedPrompt{
  if(!instruction.trim())fail("USER_REQUEST_REQUIRED","修图需要美工明确提出要求");
  const result=this.compose(input);return{...result,finalPrompt:result.finalPrompt+"\nRequested local change: "+instruction.trim()+".\nKeep all locked product features; original product photographs remain the identity source.",referenceInputs:[...result.referenceInputs,{...previous,kind:"previous"}]};
 }
}
export function chooseFreshRecipe(input:ComposeInput,recipes:GenerationRecipe[],now:Date):ComposedPrompt{
 const used=new Set(recentRecipes(recipes,input.product.sku,input.product.categoryId,now).map(r=>r.combinationKey)),variables=input.template.variables;let tested=0;
 function search(index:number,values:Record<string,string>):ComposedPrompt|undefined{
  if(tested>=1000)return;
  if(index===variables.length){tested++;const candidate=PromptComposer.compose({...input,variables:values});return used.has(candidate.combinationKey)?undefined:candidate;}
  const v=variables[index],preferred=input.variables[v.key],options=[...v.options].sort((a,b)=>Number(b.value===preferred)-Number(a.value===preferred));
  for(const o of options){const found=search(index+1,{...values,[v.key]:o.value});if(found)return found;}
 }
 const result=search(0,{});if(!result)fail("NO_FRESH_COMBINATION","这些组合最近都用过，换一个场景或道具组再试。");return result;
}
