/* eslint-disable @next/next/no-img-element -- 首页静态任务封面。 */
"use client";
import {ArrowRight,ArrowLeftRight} from "@/components/icons/concept-icons";
export function TaskCover({kind}:{kind:"pack"|"variants"|"edit"}){
 if(kind==="pack")return <div className="r1-task-art r1-pack-art"><div className="r1-pack-original"><img src="/design-preview/sofa.webp" alt="产品实拍"/><span>实拍</span></div><ArrowRight size={20}/><div className="r1-pack-results">{["主图","场景","卖点","尺寸"].map((label,i)=><div key={label} className={"r1-pack-output r1-output-"+i}><img src={i===1?"/design-preview/r3-10.webp":"/design-preview/sofa.webp"} alt={label}/>{i===3&&<i className="r1-size-line"/>}<span>{label}</span></div>)}</div></div>;
 if(kind==="variants")return <div className="r1-task-art r1-color-art">{["#E8DECC","#919D9A","#B37F58"].map((color,i)=><div key={color}><div className="r1-color-photo" style={{left:-100*i+"%"}}><img src="/design-preview/sofa.webp" alt={["米白","雾灰","焦糖"][i]+"变体"}/><span className="w-variant-overlay" style={{background:color}}/></div><i style={{background:color}}/></div>)}</div>;
 return <div className="r1-task-art r1-edit-art"><img src="/design-preview/sofa.webp" alt="调整前的产品图"/><div className="r1-edit-after"><img src="/design-preview/sofa.webp" alt="调整后示意"/></div><i className="r1-edit-divider"><ArrowLeftRight size={16}/></i><span>调整前</span><span>调整后</span></div>;
}
