/* eslint-disable @next/next/no-img-element -- 本地功能示意与鉴权图片。 */
"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowRight,ArrowLeftRight} from "@/components/icons/concept-icons";
import type {StudioSnapshot} from "@/lib/studio-main";
import {studioFetch} from "./studio-fetch";
import {Button} from "./ui/button";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "./ui/dialog";

const features=[
 {id:"pack",title:"套图生成"},
 {id:"recolor",title:"同款换色"},
 {id:"expand",title:"智能扩图"},
 {id:"cutout",title:"产品抠图"},
 {id:"direct",title:"单张生图"},
] as const;
export type HomeTool=typeof features[number]["id"];
type EditTool=Exclude<HomeTool,"pack"|"direct">;

function FeatureCover({id}:{id:HomeTool}){
 const asset="/design-preview/home-banana/";
 // 套图和单张封面保持实拍构图，场景用扩图补齐横向画幅。
 if(id==="pack")return <div className="home-banana-art home-banana-pack">{["refine-wide","pack-stairway-wide","pack-foyer-wide","direct-entryway-wide"].map(name=><div key={name}><img src={asset+name+".webp"} alt=""/></div>)}</div>;
 if(id==="recolor"||id==="cutout"){
  const before=id==="cutout"?"refine-before":"expand",after=id;
  return <div className="home-banana-art home-banana-compare"><img src={asset+before+".webp"} alt=""/><div className={"home-banana-after"+(id==="cutout"?" home-banana-alpha":"")}><img src={asset+after+".webp"} alt=""/></div><i className="home-banana-divider"><ArrowLeftRight size="sm"/></i></div>;
 }
 if(id==="expand")return <div className="home-banana-art home-banana-expand"><img src={asset+"expand.webp"} alt=""/><div className="home-banana-extent"><i/><i/></div></div>;
 return <div className="home-banana-art"><img src={asset+"direct-entryway-wide.webp"} alt=""/></div>;
}

export function HomeTools({disabled,onPack}:{disabled:boolean;onPack:()=>void}){
 const router=useRouter();
 return <section className="home-tools" aria-labelledby="home-tools-title"><div className="home-tools-heading"><h2 id="home-tools-title">常用功能</h2></div><div className="home-tools-grid">{features.map(feature=><button key={feature.id} className="home-tool-card" disabled={disabled} aria-label={feature.title} onClick={()=>{if(feature.id==="pack")onPack();else router.push("/tools/"+feature.id);}}><div className={"home-tool-cover home-tool-cover-"+feature.id} aria-hidden="true"><FeatureCover id={feature.id}/></div><div className="home-tool-caption"><h3>{feature.title}</h3></div></button>)}</div></section>;
}

export function ToolImagePicker({tool,onClose}:{tool:EditTool;onClose:()=>void}){
 const router=useRouter(),[products,setProducts]=useState<{id:string;name:string;sku:string}[]>([]),[productId,setProductId]=useState(""),[snapshot,setSnapshot]=useState<StudioSnapshot|null>(null),[imageId,setImageId]=useState(""),[loading,setLoading]=useState(true),[error,setError]=useState(""),[attempt,setAttempt]=useState(0);
 const title=features.find(f=>f.id===tool)!.title;
 useEffect(()=>{let active=true;
  const request=productId?studioFetch<StudioSnapshot>("/api/studio/"+encodeURIComponent(productId)).then(data=>{if(active)setSnapshot(data);}):studioFetch<typeof products>("/api/studio").then(data=>{if(active)setProducts(data);});
  request.catch(e=>{if(active)setError(e instanceof Error?e.message:"读取失败，请重试");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
 },[productId,attempt]);
 const images=snapshot?.pack.slots.flatMap(slot=>slot.jobs.filter(job=>job.status==="success").flatMap(job=>job.assets.map(asset=>({id:asset.id,label:slot.name}))))??[];
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="p-portal home-tool-picker"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>选择项目中已生成的图片，进入{tool==="expand"?"扩图":"修改"}面板。原图保留，新结果另存为一个版本。</DialogDescription></DialogHeader><label className="home-tool-product">选择产品<select aria-label="功能目标产品" value={productId} onChange={e=>{setLoading(true);setError("");setSnapshot(null);setImageId("");setProductId(e.target.value);}}><option value="">请选择已有产品</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></label>{loading?<p role="status">正在读取…</p>:error?<div role="alert"><p>{error}</p><Button variant="outline" onClick={()=>{setLoading(true);setError("");setAttempt(n=>n+1);}}>重新加载</Button></div>:!productId?<p className="p-subtle">{products.length?"选择产品后，这里会展示可继续处理的图片。":"还没有产品，请先用套图生成或单张生图开始创作。"}</p>:images.length?<div className="home-tool-images" role="group" aria-label="选择要处理的图片">{images.map((image,index)=><button key={image.id} aria-label={image.label+" · 图片 "+(index+1)} aria-pressed={imageId===image.id} onClick={()=>setImageId(image.id)}><img src={"/api/assets/"+image.id} alt={image.label}/><span>{image.label} · {index+1}</span></button>)}</div>:<p className="p-subtle">这个产品还没有可处理的生成图。可以先打开项目继续创作。</p>}<div className="home-tool-picker-footer"><Button variant="outline" onClick={onClose}>取消</Button>{productId&&!loading&&!error&&!images.length?<Button onClick={()=>router.push("/workspace?"+new URLSearchParams({sku:productId}))}>打开项目</Button>:<Button disabled={loading||!!error||!productId||!imageId} onClick={()=>router.push("/workspace?"+new URLSearchParams({sku:productId,tool,image:imageId}))}>进入{tool==="expand"?"扩图":"修改"}<ArrowRight size="sm"/></Button>}</div></DialogContent></Dialog>;
}
