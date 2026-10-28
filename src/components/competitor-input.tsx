/* eslint-disable @next/next/no-img-element -- 竞品图片通过鉴权接口读取。 */
"use client";
import {useEffect,useState} from "react";
import {Button} from "@/components/ui/button";
type Inputs={assetIds:string[];links:string[]};
export function CompetitorInput({productId,readonly=false}:{productId:string;readonly?:boolean}){
 const [input,setInput]=useState<Inputs>({assetIds:[],links:[]}),[links,setLinks]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 useEffect(()=>{void fetch("/api/products/"+productId+"/competitors").then(async r=>{if(!r.ok)throw Error("读取竞品资料失败");return r.json();}).then(d=>{setInput(d);setLinks(d.links.join("\n"));}).catch(e=>setNotice(e.message));},[productId]);
 async function save(files?:FileList|null){setBusy(true);setNotice("");try{
 let assetIds=input.assetIds;
 if(files?.length){const f=new FormData();Array.from(files).forEach(file=>f.append("images",file));const r=await fetch("/api/products/"+productId+"/competitors",{method:"POST",body:f});const d=await r.json();if(!r.ok)throw Error(d.error);assetIds=[...assetIds,...d.assetIds];setInput(v=>({...v,assetIds}));}
 const next={assetIds,links:links.split(/\n/).map(s=>s.trim()).filter(Boolean)};
 const r=await fetch("/api/products/"+productId+"/competitors",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(next)});const d=await r.json();if(!r.ok)throw Error(d.error);setInput(d);setNotice("竞品参考已保存；下次规划逐张拆解。");
 }catch(e){setNotice(e instanceof Error?e.message:"保存失败");}finally{setBusy(false);}}
 return <section className="workspace-panel space-y-3 p-5"><h2>竞品参考 · 图片优先</h2><p className="text-sm text-muted-foreground">建议上传 5–10 张竞品截图，最多 10 张。商品页链接可留作来源；能直接读取的图片链接会用于看图，页面受限时请补截图。联网文字仅作补充参考。</p><div className="flex flex-wrap gap-2">{input.assetIds.map(id=><div key={id}><img width={90} height={90} className="h-24 w-24 rounded object-cover" src={"/api/assets/"+id} alt="竞品参考"/>{!readonly&&<button type="button" onClick={()=>setInput(v=>({...v,assetIds:v.assetIds.filter(a=>a!==id)}))}>移除</button>}</div>)}</div><label className="block">竞品链接（每行一个）<textarea aria-label="竞品链接" className="mt-1 w-full rounded border p-2" rows={3} value={links} disabled={readonly||busy} onChange={e=>setLinks(e.target.value)}/></label>{!readonly&&<div className="flex gap-3"><label>上传竞品截图<input aria-label="上传竞品截图" type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={busy||input.assetIds.length>=10} onChange={e=>{void save(e.target.files);e.target.value="";}}/></label><Button disabled={busy} onClick={()=>void save()}>保存竞品参考</Button></div>}<p role="status">{notice}</p></section>;
}
