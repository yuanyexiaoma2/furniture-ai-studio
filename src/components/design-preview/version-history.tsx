/* eslint-disable @next/next/no-img-element -- 读取鉴权后的版本原图。 */
"use client";
import {useState} from "react";
import {useLiveStore,studioFetch} from "./live-store";
import {Button} from "./ui/button";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "./ui/dialog";
import {toast} from "sonner";
export function VersionHistory(){
 const live=useLiveStore(),snapshot=live.snapshot,[compare,setCompare]=useState<{before:string;after:string;name:string}|null>(null),[busy,setBusy]=useState(false);
 const edited=snapshot?.pack.slots.filter(s=>s.jobs.some(j=>j.input.sourceAssetId))??[];
 if(!snapshot||!edited.length)return null;
 async function rollback(slotId:string,assetId:string){setBusy(true);try{await studioFetch("/api/products/"+snapshot!.product.id+"/pack",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"final",slotId,assetId})});await live.load(snapshot!.product.id);toast.success("已切换终稿版本，所有候选仍然保留");}catch(e){toast.error(e instanceof Error?e.message:"回退失败");}finally{setBusy(false);}}
 return <><details className="l-shooting-card"><summary>修改版本 · 对比与回退</summary>{edited.map(slot=><section key={slot.id}><h4 className="my-3 font-medium">{slot.name}</h4>{[...slot.jobs].reverse().filter(j=>j.assets.length).map((job,i)=><div key={job.id} className="mb-2 rounded-lg border p-3 text-sm"><p>版本 {i+1} · {job.input.sourceAssetId?job.input.editMode==="masked"?"局部修改":"整图修改":"初次生成"}</p>{job.assets.map(a=><div key={a.id} className="mt-2 flex flex-wrap gap-2">{!!job.input.sourceAssetId&&<Button size="sm" variant="outline" onClick={()=>setCompare({before:String(job.input.sourceAssetId),after:a.id,name:slot.name})}>与修改前对比</Button>}<Button size="sm" variant="ghost" disabled={busy||slot.finalAssetId===a.id} onClick={()=>void rollback(slot.id,a.id)}>{slot.finalAssetId===a.id?"当前终稿":slot.finalAssetId?"回退为终稿":"设为终稿"}</Button></div>)}</div>)}</section>)}</details><Dialog open={!!compare} onOpenChange={open=>{if(!open)setCompare(null);}}><DialogContent className="p-portal" style={{maxWidth:"90vw",width:1200}}><DialogHeader><DialogTitle>{compare?.name} · 修改前后</DialogTitle><DialogDescription>左侧为修改前，右侧为新版本；关闭后可在版本列表切换终稿。</DialogDescription></DialogHeader>{compare&&<div className="grid grid-cols-2 gap-4"><figure><img className="max-h-[70vh] w-full object-contain" src={"/api/assets/"+compare.before} alt="修改前"/><figcaption>修改前</figcaption></figure><figure><img className="max-h-[70vh] w-full object-contain" src={"/api/assets/"+compare.after} alt="修改后"/><figcaption>修改后</figcaption></figure></div>}</DialogContent></Dialog></>;
}
