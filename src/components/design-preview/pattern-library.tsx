"use client";
import {useEffect,useState} from "react";
import {patternTypes,type VisualPattern} from "@/lib/visual-plan-rules";
import {studioFetch} from "./live-store";
import {ListingImport} from "./listing-import";
import {Button} from "./ui/button";
import {ChevronRight} from "@/components/icons/concept-icons";
const labels={scene_pattern:"场景经验",selling_point_pattern:"卖点表达",prop_pool:"配饰与陈列",slot_sequence:"图位顺序",case:"优秀案例"};
export function PatternLibrary(){
 const [entries,setEntries]=useState<VisualPattern[]>([]),[error,setError]=useState(""),[type,setType]=useState<(typeof patternTypes)[number]>("scene_pattern");
 useEffect(()=>{let active=true;void studioFetch<VisualPattern[]>("/api/studio/library").then(rows=>{if(active)setEntries(rows);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 return <main className="p-pattern-library"><div className="p-pattern-heading"><p className="p-subtle">品类视觉经验</p><h1 className="text-[length:var(--text-xl)] font-medium">模板库</h1><p className="p-subtle">积累画面表达；具体产品外观由每次实拍分析决定。示例数据已排除检索。</p></div><ListingImport entries={entries} onChange={async()=>setEntries(await studioFetch<VisualPattern[]>("/api/studio/library"))}/><div className="flex flex-wrap gap-2">{patternTypes.map(t=><Button key={t} variant={t===type?"secondary":"ghost"} onClick={()=>setType(t)}>{labels[t]} · {entries.filter(e=>e.type===t).length}</Button>)}</div>{error&&<p role="alert">{error}</p>}<div className="grid gap-4 md:grid-cols-2">{entries.filter(e=>e.type===type).map(e=><article key={e.id} className="p-pattern-card"><p className="p-subtle">{e.categories.join(" / ")} · {e.source}</p><h2 className="my-2 font-medium">{e.name}</h2>{e.status!=="ready"&&<p className="p-subtle">{e.status==="pending_images"?"原图待上传，暂不参与检索":"待人工确认"}</p>}<details><summary><ChevronRight size="sm" aria-hidden="true"/>查看内容</summary><pre className="mt-3 whitespace-pre-wrap break-words text-xs leading-6">{JSON.stringify(e.content,null,2)}</pre></details></article>)}</div></main>;
}
