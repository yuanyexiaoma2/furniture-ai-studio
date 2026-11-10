/* eslint-disable @next/next/no-img-element -- 版本缩略图使用已有资产接口，不产生模型调用。 */
"use client";
import {Check,LoaderCircle,ChevronDown} from "@/components/icons/concept-icons";
import {progressLabel,progressSummary} from "@/lib/agent-progress";
import type {AgentEvent} from "@/lib/planning-agent";
import type {StudioSnapshot} from "@/lib/studio-main";
import {useLiveStore} from "./live-store";

export function CanvasHistory({onFocus}:{onFocus?:(id:string)=>void}){
 const snapshot=useLiveStore(s=>s.snapshot);
 const rows=snapshot?.agent.tools.slice(-20).reverse()??[];
 return <div className="t11-canvas-history">
 {snapshot?.pack.slots.map(slot=>{const versions=slot.jobs.filter(j=>!j.retriedById).flatMap<{asset:{id:string}|null;source:unknown}>(job=>job.assets.length?job.assets.map(a=>({asset:a,source:job.input.sourceAssetId})):[{asset:null,source:null}]);return versions.length>0&&<section key={slot.id}><h4>{slot.name}</h4>{versions.map((v,i)=>({...v,number:i+1})).reverse().map(v=>v.asset&&<button type="button" className="p-canvas-version" key={v.asset.id} onClick={()=>onFocus?.(v.asset!.id)}><img loading="lazy" src={"/api/assets/"+v.asset.id} alt=""/><span className="p-version-copy"><strong>版本 {v.number} · {v.source?"修改":"生成"}</strong><small>{v.asset.id===slot.finalAssetId?"当前终稿":"点击定位到画布"}</small></span>{v.asset.id===slot.finalAssetId&&<Check size="sm"/>}</button>)}</section>;})}
 {!snapshot?.pack.slots.some(s=>s.jobs.some(j=>j.assets.length))&&<p className="p-subtle">生成后在这里找回每个版本。定位已隐藏的图片会将它恢复到画布。</p>}
 <details><summary>处理记录</summary>{rows.map(t=><div key={t.id}><span>{progressLabel(t.name)}</span><small>{t.status==="running"?"进行中":t.status==="failed"?"未完成":"已完成"}</small></div>)}</details>
 </div>;
}

export function WorkspaceProgress({snapshot,events}:{snapshot:StudioSnapshot;events:AgentEvent[]}){
 const entries=new Map(snapshot.agent.tools.map(t=>[t.callId,{id:t.callId,name:t.name,status:t.status,summary:t.error??progressSummary(t.result),result:t.result}]));
 for(const e of events){if(!e.callId||!e.name)continue;const previous=entries.get(e.callId);if(previous?.status!=="running"&&previous?.status&&e.status==="running")continue;entries.set(e.callId,{id:e.callId,name:e.name,status:e.status??"running",summary:e.summary??previous?.summary??"正在处理…",result:previous?.result??null});}
 const tools=[...entries.values()].slice(-6),jobs=snapshot.pack.slots.flatMap(s=>s.jobs.filter(j=>!j.retriedById).map(j=>({id:j.id,name:s.name,status:j.status}))).slice(-6);
 if(!tools.length&&!jobs.length)return null;
 return <section className="t11-progress" aria-label="创作执行进度"><div className="t11-progress-heading"><span>创作进度</span><small>刷新后可继续查看</small></div>
 {tools.map(t=><details key={t.id} className={"t11-progress-step "+t.status}><summary>{t.status==="running"?<LoaderCircle size="sm" className="animate-spin"/>:t.status==="failed"?<span className="t11-step-error">!</span>:<Check size="sm"/>}<span>{progressLabel(t.name)}</span><small>{t.status==="running"?"进行中":t.status==="failed"?"未完成":"已完成"}</small><ChevronDown size="sm"/></summary><p>{t.summary}</p></details>)}
 {jobs.length>0&&<div className="t11-generation-progress">{jobs.map(j=><div key={j.id}><span className={"p-dot "+(j.status==="success"?"p-dot-success":j.status==="failed"?"p-dot-warning":"p-dot-busy")}/><span>{j.name}</span><small>{({pending:"排队中",running:"生成中",success:"候选已就绪",failed:"生成未完成",cancelled:"已取消"} as Record<string,string>)[j.status]}</small></div>)}</div>}
 {snapshot.agent.cards.some(c=>c.status==="pending"&&c.kind!=="cost")&&<p className="t11-awaiting">下一步等待你确认下方卡片</p>}
 </section>;
}
