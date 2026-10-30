/* eslint-disable @next/next/no-img-element -- 图片信息使用当前产品的鉴权资源。 */
import type {ReferenceUse} from "@/lib/generation-references";
const labels={product:"产品实拍",reference:"参考图",source:"编辑原图",mask:"编辑蒙版"};
export function ImageReferenceInfo({usage,omitted=[],limit,route}:{route?:{provider?:string|null;model?:string|null;fallback?:boolean;switchReason?:string};usage?:ReferenceUse[];omitted?:ReferenceUse[];limit?:number}){
 if(!usage&&!route?.provider)return null;
 const references=usage?.filter(r=>r.role==="reference")??[];
 return <details className="p-subtle"><summary>使用参考图 {references.length} 张{omitted.length?` · 超限省略 ${omitted.length} 张`:""}</summary>{route?.provider&&<p>实际网关：{route.provider} · {route.model}{route.fallback?" · 已切换":" · 未切换"}{route.switchReason?"；原因："+route.switchReason:""}</p>}{references.length===0&&<p>本次未使用风格参考图</p>}<div className="t11-message-references">{references.map((r,i)=><a key={r.assetId} href={"/api/assets/"+r.assetId} target="_blank" rel="noreferrer" title={r.purpose}><img src={"/api/assets/"+r.assetId} alt={"本次参考图"+(i+1)+" · "+r.purpose}/><span>{r.purpose}</span></a>)}</div><p>实际输入：{usage?.map(r=>labels[r.role]).join("、")}{limit?`；模型上限 ${limit} 张`:""}</p>{omitted.map((r,i)=><p key={r.assetId}>未传入：{labels[r.role]} {i+1} · {r.purpose}（优先保留产品实拍，超过模型上限）</p>)}</details>;
}
