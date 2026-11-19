"use client";
import {useEffect,useState} from "react";
import {patternTypes,type VisualPattern} from "@/lib/visual-plan-rules";
import {studioFetch} from "./live-store";
import {TemplateGallery,TemplateProjectPicker} from "./saved-references";
import type {SavedReference} from "@/lib/saved-reference-rules";
import {ListingImport} from "./listing-import";
import {Button} from "./ui/button";
import {ChevronRight} from "@/components/icons/concept-icons";
const labels={scene_pattern:"场景经验",selling_point_pattern:"卖点表达",prop_pool:"配饰与陈列",slot_sequence:"图位顺序",case:"优秀案例"};
export function PatternLibrary(){
 const [tab,setTab]=useState("images"),[selectedTemplate,setSelectedTemplate]=useState<SavedReference|null>(null);
 const [entries,setEntries]=useState<VisualPattern[]>([]),[error,setError]=useState(""),[type,setType]=useState<(typeof patternTypes)[number]>("scene_pattern");
 useEffect(()=>{let active=true;void studioFetch<VisualPattern[]>("/api/studio/library").then(rows=>{if(active)setEntries(rows);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 return <main className="p-pattern-library"><div className="p-pattern-heading"><p className="p-subtle">收藏画面 · 复用灵感</p><h1 className="text-[length:var(--text-xl)] font-medium">模板库</h1><p className="p-subtle">保存好图与提示词，下次为类似产品继续使用。</p></div><div className="ws-template-tabs" role="tablist" aria-label="模板库内容"><Button role="tab" aria-selected={tab==="images"} variant={tab==="images"?"secondary":"ghost"} onClick={()=>setTab("images")}>图片模板</Button><Button role="tab" aria-selected={tab==="experience"} variant={tab==="experience"?"secondary":"ghost"} onClick={()=>setTab("experience")}>品类经验</Button></div>{tab==="images"?<TemplateGallery onUse={setSelectedTemplate}/>:<><ListingImport entries={entries} onImported={entry=>setEntries(rows=>[entry,...rows.filter(row=>row.id!==entry.id)])} onChange={async()=>{setEntries(await studioFetch<VisualPattern[]>("/api/studio/library"));setError("");}}/><div className="flex flex-wrap gap-2">{patternTypes.map(t=><Button key={t} variant={t===type?"secondary":"ghost"} onClick={()=>setType(t)}>{labels[t]} · {entries.filter(e=>e.type===t).length}</Button>)}</div>{error&&<p role="alert">{error}</p>}<div className="grid gap-4 md:grid-cols-2">{entries.filter(e=>e.type===type).map(e=><article key={e.id} className="p-pattern-card"><p className="p-subtle">{e.categories.join(" / ")} · {e.source}</p><h2 className="my-2 font-medium">{e.name}</h2>{e.status!=="ready"&&<p className="p-subtle">{e.status==="pending_images"?"原图待上传，暂不参与检索":"待人工确认"}</p>}<details><summary><ChevronRight size="sm" aria-hidden="true"/>查看内容</summary><pre className="mt-3 whitespace-pre-wrap break-words text-xs leading-6">{JSON.stringify(e.content,null,2)}</pre></details></article>)}</div></>}{selectedTemplate&&<TemplateProjectPicker template={selectedTemplate} onClose={()=>setSelectedTemplate(null)}/>}</main>;
}
