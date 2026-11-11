/* eslint-disable @next/next/no-img-element -- 收藏图片通过鉴权接口读取。 */
"use client";
import {useEffect,useState} from "react";
import {toast} from "sonner";
import type {SavedReference} from "@/lib/saved-reference-rules";
import {studioFetch,useLiveStore} from "./live-store";
import {useCanvasSession} from "./canvas-session";
import {usePreviewStore} from "./store";
import {Button} from "./ui/button";
import {Input} from "./ui/input";
import {Textarea} from "./ui/textarea";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "./ui/dialog";

const fail=(e:unknown)=>toast.error(e instanceof Error?e.message:"收藏操作失败");
export function SaveReferenceDialog({assetId,label,onClose}:{assetId:string;label:string;onClose:()=>void}){
 const product=useLiveStore(s=>s.snapshot?.product),[name,setName]=useState(label),[purpose,setPurpose]=useState("参考场景、道具摆放、构图和光线；产品替换为当前实拍产品"),[busy,setBusy]=useState(false);
 async function save(){if(!product||busy)return;setBusy(true);try{await studioFetch("/api/studio/saved-references",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save",data:{productId:product.id,assetId,name,purpose}})});toast.success("已保存图片、提示词和方案，可从我的收藏复用");onClose();}catch(e){fail(e);}finally{setBusy(false);}}
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent className="p-portal ws-save-dialog" data-workspace-flow><DialogHeader><DialogTitle>收藏这张图</DialogTitle><DialogDescription>连同生成提示词、参考和方案一起保存，不调用模型。</DialogDescription></DialogHeader><img className="ws-save-image" src={"/api/assets/"+assetId} alt={label}/><label>收藏名称<Input aria-label="收藏名称" value={name} maxLength={120} onChange={e=>setName(e.target.value)} disabled={busy}/></label><label>下次借鉴什么<Textarea aria-label="收藏用途" value={purpose} maxLength={1000} onChange={e=>setPurpose(e.target.value)} disabled={busy}/></label><Button onClick={()=>void save()} disabled={busy||!name.trim()||!purpose.trim()}>{busy?"保存中…":"保存到我的收藏"}</Button></DialogContent></Dialog>;
}

export function SavedReferences({onClose}:{onClose:()=>void}){
 const productId=useLiveStore(s=>s.snapshot?.product.id),[rows,setRows]=useState<SavedReference[]>([]),[query,setQuery]=useState(""),[loading,setLoading]=useState(true),[error,setError]=useState(""),[busy,setBusy]=useState<string|null>(null);
 useEffect(()=>{let active=true;studioFetch<SavedReference[]>("/api/studio/saved-references").then(data=>{if(active)setRows(data);}).catch(e=>{if(active)setError(e instanceof Error?e.message:"读取失败");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
 async function reuse(row:SavedReference){if(!productId||busy)return;setBusy(row.id);try{const result=await studioFetch<{assetId:string}>("/api/studio/saved-references",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"reuse",id:row.id,productId})});await useLiveStore.getState().load(productId);const store=usePreviewStore.getState();if(!store.nodes.some(n=>n.id===result.assetId))store.restoreHidden(useCanvasSession.getState().baseNodes,result.assetId);if(!usePreviewStore.getState().nodes.some(n=>n.id===result.assetId))throw Error("参考已带入，请刷新工作台后继续选择");usePreviewStore.getState().addReference(result.assetId);toast.success("参考与用途已带入，继续告诉搭档要用于哪个场景");onClose();}catch(e){fail(e);}finally{setBusy(null);}}
 const matches=rows.filter(row=>(row.name+row.purpose).toLowerCase().includes(query.trim().toLowerCase()));
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent className="p-portal ws-library-dialog" data-workspace-flow><DialogHeader><DialogTitle>我的收藏</DialogTitle><DialogDescription>选用图片与用途作为参考，产品身份以当前实拍为准。</DialogDescription></DialogHeader><Input aria-label="搜索收藏" placeholder="搜索名称或用途…" value={query} onChange={e=>setQuery(e.target.value)}/>{loading?<p role="status">正在读取收藏…</p>:error?<p role="alert">{error}</p>:!matches.length?<p>{rows.length?"没有匹配的收藏":"选中满意的生成图，点“收藏”，下次就能在这里复用。"}</p>:<div className="ws-saved-grid">{matches.map(row=><article key={row.id}><img src={"/api/assets/"+row.assetId} alt={row.name}/><h3>{row.name}</h3><p>{row.purpose}</p><details><summary>查看保存的提示词</summary><pre>{row.prompt||"此历史记录没有提示词"}</pre><small>保留作追溯，不直接套用旧产品描述。</small></details><Button disabled={!productId||!!busy} onClick={()=>void reuse(row)}>{busy===row.id?"带入中…":"用作当前产品参考"}</Button></article>)}</div>}</DialogContent></Dialog>;
}
