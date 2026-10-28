"use client";
import {useEffect,useState} from "react";
export function ProductSupplement({productId,readonly}:{productId:string;readonly:boolean}){
 const [docs,setDocs]=useState<{id:string;filename:string;parseStatus:string}[]>([]),[note,setNote]=useState(""),[busy,setBusy]=useState(false);
 async function load(){const r=await fetch("/api/products/"+productId+"/documents");if(r.ok)setDocs(await r.json());}
 useEffect(()=>{void fetch("/api/products/"+productId+"/documents").then(r=>r.json()).then(d=>{if(Array.isArray(d))setDocs(d);}).catch(()=>setNote("读取补充资料失败"));},[productId]);
 return <section className="workspace-panel space-y-3 p-5"><h2>补充图与参数文件</h2><p>主图和主要角度请在实拍管理中排序；细节图、材质图和参数文档放在这里。</p>{!readonly&&<input type="file" multiple aria-label="上传补充资料" disabled={busy} accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx,.csv" onChange={async e=>{const files=Array.from(e.target.files??[]);e.target.value="";if(!files.length)return;setBusy(true);try{const f=new FormData();files.forEach(file=>f.append("files",file));const r=await fetch("/api/products/"+productId+"/documents",{method:"POST",body:f}),d=await r.json();if(!r.ok)throw Error(d.error);setNote(d.results.some((x:{error?:string})=>x.error)?"部分资料解析失败，请检查文件":"已保存补充资料");await load();}catch(e){setNote(e instanceof Error?e.message:"上传失败");}finally{setBusy(false);}}}/>}<ul>{docs.map(d=><li key={d.id}>{d.filename} · {d.parseStatus==="ready"?"已就绪":d.parseStatus==="failed"?"解析失败":"解析中"}</li>)}</ul><p role="status">{note}</p></section>;
}
