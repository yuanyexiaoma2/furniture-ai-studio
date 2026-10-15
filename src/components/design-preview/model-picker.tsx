"use client";
import {useEffect,useRef,useState} from "react";
import {ArrowUp,Bot,Check,ChevronDown,ImageIcon,LockKeyhole,MoreHorizontal,Plus,SlidersHorizontal,Sparkles} from "lucide-react";
import {models,modelRate,type MockModel,type ModelKind} from "@/design-preview/mock/models";
import {availableModels,estimateCost,resolveSelection,useModelStore} from "./model-store";
import {Button} from "./ui/button";
import {Popover,PopoverContent,PopoverTrigger} from "./ui/popover";
import {Switch} from "./ui/switch";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "./ui/select";
export function BrandIcon({model}:{model:MockModel}){return <span className="p-brand-icon" style={{"--brand":model.color} as React.CSSProperties} aria-hidden="true">{model.initial}</span>;}
export function ModelPicker({kind,scope,menu=false}:{kind:ModelKind;scope:string;menu?:boolean}){
 const state=useModelStore(),selected=resolveSelection(state,scope);
 const [open,setOpen]=useState(false);
 const list=availableModels(state,kind),current=models.find(m=>m.id===(kind==="agent"?selected.agentId:selected.imageId));
 const defaultImage=list.find(m=>m.id===state.defaults.image)?.id??list[0]?.id;
 const label=kind==="agent"?"智能体模型":"生图模型";
 function choose(id:string){
  const m=list.find(m=>m.id===id);if(!m)return;
  if(kind==="agent"){if(id!==selected.agentId)state.updateSelection(scope,{agentId:id},`已切换智能体为 ${m.name}`);setOpen(false);}
  else if(selected.auto){if(id===defaultImage)return;const imageIds=selected.imageIds.includes(id)?selected.imageIds.filter(n=>n!==id):[...selected.imageIds,id];state.updateSelection(scope,{imageIds},`自动出图范围已更新 · ${imageIds.length} 个模型`);}
  else {if(id!==selected.imageId)state.updateSelection(scope,{imageId:id},`已切换生图模型为 ${m.name}`);}
 }
 return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="ghost" className={`p-model-capsule ${menu?"p-model-menu-trigger":""} ${kind==="image"&&!selected.auto?"is-manual":""}`} aria-label={label}>{kind==="agent"?<Bot size={16}/>:<ImageIcon size={16}/>}<span className="p-model-label">{kind==="image"&&selected.auto?["Auto",selected.imageIds.length+" 个"].join(" \u00b7 "):current?.name??"暂无可用模型"}</span><ChevronDown size={14}/></Button></PopoverTrigger><PopoverContent side={kind==="image"?"right":"top"} align={kind==="image"?"center":"start"} sideOffset={12} collisionPadding={16} className={`p-portal p-model-panel p-model-${kind}`}><div>
 {kind==="agent"?<header><h3>智能体</h3><p>负责理解产品、规划图包、和你对话</p></header>:<><div className="p-model-segments"><Button className="active" variant="ghost"><ImageIcon size={16}/>图片</Button><Button disabled variant="ghost">视频<span>即将开放</span></Button></div><div className="p-auto-line"><div><strong><Sparkles size={15}/>Auto</strong><p>{selected.auto?"在已选模型中，按任务自动挑选":"选择一个模型，按你的指定创作"}</p></div><Switch aria-label="自动挑选生图模型" checked={selected.auto} onCheckedChange={auto=>state.updateSelection(scope,{auto},auto?"生图模型已切换为自动挑选":"生图模型已改为手动指定")}/></div></>}
 <div className="p-model-list" role={kind==="agent"||!selected.auto?"radiogroup":"group"} aria-label={label+"列表"}>{list.map(m=>{
  const checked=kind==="agent"?m.id===selected.agentId:selected.auto?selected.imageIds.includes(m.id):m.id===selected.imageId;
  const locked=kind==="image"&&selected.auto&&m.id===defaultImage;const rate=modelRate(m,selected.qualities[m.id]);
  return <div className={`p-model-entry ${checked?"is-checked":""}`} key={m.id}>
   <button className="p-model-row" role={kind==="agent"||!selected.auto?"radio":"checkbox"} aria-checked={checked} aria-disabled={locked||undefined} aria-label={m.name} onClick={()=>choose(m.id)}><BrandIcon model={m}/><span className="p-model-copy"><strong>{m.name}</strong><span>{m.description}</span>{kind==="image"&&<small>约 {rate.seconds} 秒 <i/>约 ${rate.price.toFixed(3).replace(/0$/,"")}</small>}</span><span className="p-model-row-end">{m.tag&&<em>{m.tag}</em>}{locked&&<LockKeyhole size={12}/>}<span className={`p-model-check ${selected.auto&&kind==="image"?"is-square":""}`}>{checked&&<Check size={13}/>}</span></span></button>
   {m.tiers&&checked&&<div className="p-quality-options" role="group" aria-label={m.name+"质量档"}>{m.tiers.map(t=><Button key={t.id} variant="ghost" aria-pressed={(selected.qualities[m.id]??"auto")===t.id} className={(selected.qualities[m.id]??"auto")===t.id?"active":""} onClick={()=>state.updateSelection(scope,{qualities:{...selected.qualities,[m.id]:t.id}})}>{t.label}</Button>)}</div>}
  </div>;
 })}{!list.length&&<p className="p-model-empty">暂无可用模型，请联系管理员。</p>}</div>
 <footer>{kind==="agent"?"管理员可以在后台调整可用模型":selected.auto?"默认模型始终保留，其余模型可自由组合":"已手动指定 · 本次创作使用所选模型"}</footer>
 </div></PopoverContent></Popover>;
}
export function ComposerToolbar({scope,count=4,ratio="1:1",onCount,onRatio,onAdd,onSend,disabled,extra,showCost=true}:{scope:string;count?:number;ratio?:string;onCount?:(n:number)=>void;onRatio?:(n:string)=>void;onAdd:()=>void;onSend:()=>void;disabled:boolean;showCost?:boolean;extra?:React.ReactNode}){
 const state=useModelStore(),selection=resolveSelection(state,scope);const bar=useRef<HTMLDivElement>(null);const [compact,setCompact]=useState(scope!=="home");
 useEffect(()=>{const observer=new ResizeObserver(entries=>setCompact(entries[0].contentRect.width<650));if(bar.current)observer.observe(bar.current);return()=>observer.disconnect();},[]);
 const canSend=!!selection.agentId&&!!selection.imageId&&!disabled;
 const parameters=<Popover><PopoverTrigger asChild><Button variant="ghost" className="p-model-capsule" aria-label="图片参数"><SlidersHorizontal size={16}/><span>{ratio} · {count} 张</span></Button></PopoverTrigger><PopoverContent className="p-portal p-parameter-panel" side="top"><div><h3>图片参数</h3><label>图片比例<Select value={ratio} onValueChange={onRatio}><SelectTrigger aria-label="图片比例"><SelectValue/></SelectTrigger><SelectContent className="p-portal">{["1:1","4:3","3:4","16:9","9:16"].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></label><label>生成张数<Select value={String(count)} onValueChange={v=>onCount?.(Number(v))}><SelectTrigger aria-label="生成张数"><SelectValue/></SelectTrigger><SelectContent className="p-portal">{[1,2,3,4].map(n=><SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent></Select></label></div></PopoverContent></Popover>;
 return <div className={`p-composer-toolbar ${compact?"is-compact":""}`} ref={bar} data-composer-scope={scope}>
 <Button variant="ghost" className="p-composer-add" aria-label="添加实拍" onClick={onAdd}><Plus size={18}/><span>添加</span></Button>
 <ModelPicker kind="agent" scope={scope}/>
 {!compact&&<ModelPicker kind="image" scope={scope}/>}
 {!compact&&scope!=="home"&&parameters}
 {(compact||extra)&&<Popover><PopoverTrigger asChild><Button variant="ghost" className="p-composer-more" size="icon" aria-label="更多创作选项"><MoreHorizontal size={18}/></Button></PopoverTrigger><PopoverContent className="p-portal p-composer-menu" side="top" align="start"><div><h3>创作选项</h3>{compact&&<ModelPicker menu kind="image" scope={scope}/>} {compact&&scope!=="home"&&parameters}{extra}</div></PopoverContent></Popover>}
 <span className="p-composer-spacer" aria-hidden="true"/>{showCost&&<span className="p-cost-estimate" aria-live="polite"><span>预计 </span>${estimateCost(state,scope,count).toFixed(scope==="home"?2:3)}</span>}
 <Button className="p-send-circle" size="icon" aria-label={scope==="home"?"发送并进入工作台":"发送创作要求"} disabled={!canSend} onClick={onSend}><ArrowUp size={20}/></Button>
 </div>;
}
