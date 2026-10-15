"use client";
import {useEffect,useState} from "react";
import {toast} from "sonner";
import {studioFetch} from "./live-store";
import {useModelStore} from "./model-store";
import {BrandIcon} from "./model-picker";
import {Switch} from "./ui/switch";
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from "./ui/table";
import type {MockModel} from "@/design-preview/mock/models";
type Row=MockModel&{configured:boolean;probe:{toolCalls?:number;formatCorrect?:number;parameterCorrect?:number;contextStable?:number}};
export function RealModelAdmin({search}:{search:string}){
 const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState("");
 async function load(){try{setRows((await studioFetch<{models:Row[]}>("/api/studio/models?admin=1")).models);}catch(e){setError(e instanceof Error?e.message:"读取失败");}}
 useEffect(()=>{void studioFetch<{models:Row[]}>("/api/studio/models?admin=1").then(r=>setRows(r.models)).catch(e=>setError(e.message));},[]);
 async function visible(row:Row,value:boolean){try{await studioFetch("/api/studio/models",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:row.id,visible:value})});await load();useModelStore.getState().setCatalog((await studioFetch<{models:MockModel[]}>("/api/studio/models")).models);}catch(e){toast.error(e instanceof Error?e.message:"保存失败");}}
 return <div className="p-admin-table">{error&&<p role="alert">{error}</p>}<Table><TableHeader><TableRow><TableHead>模型</TableHead><TableHead>类型</TableHead><TableHead>能力探测</TableHead><TableHead>对美工可见</TableHead><TableHead>可用状态</TableHead></TableRow></TableHeader><TableBody>{rows.filter(r=>r.name.toLowerCase().includes(search.toLowerCase())).map(r=><TableRow key={r.id}><TableCell><div className="p-admin-model-name"><BrandIcon model={r}/><strong>{r.name}</strong></div></TableCell><TableCell>{r.kind==="agent"?"智能体":"生图"}</TableCell><TableCell>{r.kind==="agent"?(r.probe.toolCalls===20?String(r.probe.parameterCorrect??0)+"/20 参数正确 · "+String(r.probe.contextStable??0)+"/20 上下文":"待验证"):"已接通生成队列"}</TableCell><TableCell><Switch aria-label={r.name+"对美工可见"} checked={r.visible} onCheckedChange={v=>void visible(r,v)}/></TableCell><TableCell>{r.configured?"已配置":"待配置凭据"}</TableCell></TableRow>)}</TableBody></Table></div>;
}
