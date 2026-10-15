"use client";
import {create} from "zustand";
import {persist} from "zustand/middleware";
import {models,modelRate,type ModelKind,type Quality} from "@/design-preview/mock/models";
export const demoSession="demo-sofa";
export type ModelSelection={webEnabled?:boolean;resolution?:"auto"|"1K"|"2K"|"4K";agentId:string;auto:boolean;imageIds:string[];imageId:string;qualities:Record<string,Quality>};
type Availability={enabled:boolean;visible:boolean};
type ModelState={
 availability:Record<string,Availability>;defaults:Record<ModelKind,string>;home:ModelSelection;
 sessions:Record<string,ModelSelection>;events:Record<string,string[]>;
 startSession:(id:string,fresh?:boolean)=>void;
 updateSelection:(scope:string,patch:Partial<ModelSelection>,message?:string)=>void;
 configure:(id:string,patch:Partial<Availability>)=>void;setDefault:(id:string)=>void;
 reset:()=>void;
};
const defaults={agent:models.find(m=>m.kind==="agent"&&m.isDefault)!.id,image:models.find(m=>m.kind==="image"&&m.isDefault)!.id};
const initialSelection:ModelSelection={agentId:defaults.agent,auto:true,imageIds:[defaults.image],imageId:defaults.image,qualities:{}};
const initial=()=>({availability:Object.fromEntries(models.map(m=>[m.id,{enabled:m.enabled,visible:m.visible}])),defaults:{...defaults},home:{...initialSelection,qualities:{}},sessions:{},events:{}});
export function availableModels(state:Pick<ModelState,"availability">,kind:ModelKind){
 return models.filter(m=>m.kind===kind&&(state.availability[m.id]?.enabled??m.enabled)&&(state.availability[m.id]?.visible??m.visible));
}
export function resolveSelection(state:Pick<ModelState,"availability"|"defaults"|"home"|"sessions">,scope:string):ModelSelection {
 const raw=scope==="home"?state.home:state.sessions[scope]??state.home;
 const agents=availableModels(state,"agent"),images=availableModels(state,"image");
 const defaultImage=images.find(m=>m.id===state.defaults.image)?.id??images[0]?.id??"";
 const agentId=agents.some(m=>m.id===raw.agentId)?raw.agentId:agents.find(m=>m.id===state.defaults.agent)?.id??agents[0]?.id??"";
 const imageIds=[...new Set([defaultImage,...raw.imageIds.filter(id=>images.some(m=>m.id===id))])].filter(Boolean);
 return {...raw,webEnabled:raw.webEnabled??true,resolution:raw.resolution??"auto",agentId,imageIds,imageId:images.some(m=>m.id===raw.imageId)?raw.imageId:defaultImage};
}
export const useModelStore=create<ModelState>()(persist((set,get)=>({
 ...initial(),
 startSession:(id,fresh=false)=>{if(!fresh&&get().sessions[id])return;const selected=resolveSelection(get(),"home");set(s=>({sessions:{...s.sessions,[id]:{...selected,imageIds:[...selected.imageIds],qualities:{...selected.qualities}}},...(fresh?{events:{...s.events,[id]:[]}}:{})}));},
 updateSelection:(scope,patch,message)=>set(s=>{
  const next={...resolveSelection(s,scope),...patch};
  return {...(scope==="home"?{home:next}:{sessions:{...s.sessions,[scope]:next}}),...(scope!=="home"&&message?{events:{...s.events,[scope]:[...(s.events[scope]??[]),message]}}:{})};
 }),
 configure:(id,patch)=>set(s=>({availability:{...s.availability,[id]:{...s.availability[id],...patch}}})),
 setDefault:id=>{const model=models.find(m=>m.id===id);if(model)set(s=>({defaults:{...s.defaults,[model.kind]:id},availability:{...s.availability,[id]:{enabled:true,visible:true}}}));},
 reset:()=>set(initial()),
}),{name:"furniture-preview-models-v3",version:1,skipHydration:true}));
export function estimateCost(state:ModelState,scope:string,count:number){
 const selected=resolveSelection(state,scope);const agent=models.find(m=>m.id===selected.agentId);
 const imageModels=models.filter(m=>selected.auto?selected.imageIds.includes(m.id):m.id===selected.imageId);
 const imagePrice=Math.max(0,...imageModels.map(m=>modelRate(m,selected.qualities[m.id]).price));
 return (agent?.price??0)+imagePrice*count;
}
