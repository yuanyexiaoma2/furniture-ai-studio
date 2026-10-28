/* eslint-disable @next/next/no-img-element -- 浏览器本地框选预览。 */
"use client";
import {useRef,useState} from "react";
import {Crop,Scan,Check} from "@/components/icons/concept-icons";
import {Button} from "../ui/button";
import {Input} from "../ui/input";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "../ui/dialog";
import {useLibraryStore} from "./library-store";
import type {Suggestion} from "@/design-preview/library/types";
export function PropCapture({imageId,image,onClose}:{imageId:string;image:string;onClose:()=>void}){
 const area=useRef<HTMLDivElement>(null),start=useRef<{x:number;y:number}|null>(null),[box,setBox]=useState<Suggestion["crop"]>(),[recognized,setRecognized]=useState(false),[fields,setFields]=useState({name:"陶瓷杯",keywordsEn:"ceramic coffee mug",shape:"圆柱",color:"奶油白",material:"陶瓷",tags:"边桌 卧室 自然"});
 function point(e:React.PointerEvent){const r=area.current!.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};}
 async function save(){if(!box)return;const img=new Image();img.src=image;await img.decode();const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.naturalWidth*box.width));canvas.height=Math.max(1,Math.round(img.naturalHeight*box.height));canvas.getContext("2d")!.drawImage(img,img.naturalWidth*box.x,img.naturalHeight*box.y,canvas.width,canvas.height,0,0,canvas.width,canvas.height);useLibraryStore.getState().suggestCapture("prop",imageId,canvas.toDataURL("image/webp"),box,{...fields,tags:fields.tags.split(/\s+/).filter(Boolean)});onClose();}
 return <Dialog open onOpenChange={v=>!v&&onClose()}><DialogContent className="p-portal l-prop-capture"><DialogHeader><DialogTitle>框选一个物体，存为道具</DialogTitle><DialogDescription>拖出选框，再确认名称和关键词。此处识别为本地样例演示。</DialogDescription></DialogHeader><div ref={area} className="l-crop-area" onPointerDown={e=>{start.current=point(e);e.currentTarget.setPointerCapture(e.pointerId);setRecognized(false);}} onPointerMove={e=>{if(!start.current)return;const p=point(e),a=start.current;setBox({x:Math.min(p.x,a.x),y:Math.min(p.y,a.y),width:Math.abs(p.x-a.x),height:Math.abs(p.y-a.y)});}} onPointerUp={()=>{start.current=null;}}><img src={image} alt="框选道具"/>{box&&<span style={{left:box.x*100+"%",top:box.y*100+"%",width:box.width*100+"%",height:box.height*100+"%"}}/>}<i><Crop size="sm"/>拖动框选物体</i></div>{!recognized?<Button disabled={!box||box.width<.02||box.height<.02} onClick={()=>setRecognized(true)}><Scan size="sm"/>识别框选内容</Button>:<><div className="l-capture-fields">{(["name","keywordsEn","shape","color","material","tags"] as const).map((key,i)=><label key={key}>{["名称","英文关键词","形状","颜色","材质","标签"][i]}<Input aria-label={"道具"+key} value={fields[key]} onChange={e=>setFields({...fields,[key]:e.target.value})}/></label>)}</div><Button disabled={!fields.name.trim()} onClick={()=>void save()}><Check size="sm"/>确认，生成收藏建议</Button></>}</DialogContent></Dialog>;
}
