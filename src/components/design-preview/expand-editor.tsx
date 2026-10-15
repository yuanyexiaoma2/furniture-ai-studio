"use client";
import {useEffect,useRef,useState} from "react";
import {Stage,Layer,Rect,Image as KonvaImage,Transformer} from "react-konva";
import Konva from "konva";
import {demoSession,estimateCost,useModelStore} from "./model-store";
import {Button} from "./ui/button";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "./ui/dialog";
import {X} from "@/components/icons/concept-icons";
export default function ExpandEditor({src,onCancel,onConfirm}:{src:string;onCancel:()=>void;onConfirm:(extent:{width:number;height:number;offsetX:number;offsetY:number})=>void}){
 const quote=estimateCost(useModelStore(),demoSession,1);
 const [image,setImage]=useState<HTMLImageElement|null>(null),[ratio,setRatio]=useState('自定义'),[box,setBox]=useState({x:160,y:80,width:340,height:220}),[stroke]=useState(()=>getComputedStyle(document.documentElement).getPropertyValue('--p-selection').trim());
 const rect=useRef<Konva.Rect>(null),transformer=useRef<Konva.Transformer>(null);
 useEffect(()=>{const img=new window.Image();img.onload=()=>setImage(img);img.src=src;return()=>{img.onload=null;};},[src]);
 // Dialog 的 Portal 晚于父组件挂载；图片就绪后再绑定变换框，确保拖动手柄可用。
 useEffect(()=>{if(rect.current)transformer.current?.nodes([rect.current]);},[image]);
 function preset(value:string){setRatio(value);setBox(value==='1:1'?{x:200,y:25,width:300,height:300}:value==='4:3'?{x:160,y:55,width:400,height:300}:value==='16:9'?{x:100,y:35,width:520,height:292}:box);}
 return <Dialog open onOpenChange={open=>!open&&onCancel()}><DialogContent className="p-portal p-expand-dialog"><DialogDescription className="sr-only">拖动边框调整扩展范围，原图始终保留。</DialogDescription><div className="p-expand-modal"><div className="p-expand-heading"><DialogTitle>扩展画面</DialogTitle><div className="p-inline-options">{['1:1','4:3','16:9','自定义'].map(v=><Button key={v} variant={ratio===v?'secondary':'ghost'} onClick={()=>preset(v)}>{v}</Button>)}<Button size="icon" variant="ghost" aria-label="取消扩图" onClick={onCancel}><X size={16}/></Button></div></div><div className="p-expand-stage"><Stage width={680} height={380}><Layer>{image&&<KonvaImage image={image} x={228} y={114} width={224} height={180}/>}<Rect ref={rect} {...box} stroke={stroke} strokeWidth={2} dash={[6,5]} draggable onDragEnd={e=>setBox(s=>({...s,x:e.target.x(),y:e.target.y()}))} onTransformEnd={()=>{if(!rect.current)return;const r=rect.current;setBox({x:r.x(),y:r.y(),width:Math.max(224,r.width()*r.scaleX()),height:Math.max(180,r.height()*r.scaleY())});r.scaleX(1);r.scaleY(1);setRatio('自定义');}}/><Transformer ref={transformer} rotateEnabled={false} keepRatio={ratio!=='自定义'} borderStroke={stroke} anchorStroke={stroke} boundBoxFunc={(oldBox,next)=>Math.abs(next.width)<224||Math.abs(next.height)<180?oldBox:next}/></Layer></Stage></div><div className="p-expand-footer"><span className="p-subtle">拖动边框调整范围 · 原图保留</span><div className="p-inline-options"><Button variant="outline" onClick={onCancel}>取消</Button><Button onClick={()=>onConfirm({width:Math.round(box.width),height:Math.round(box.height),offsetX:228-box.x,offsetY:114-box.y})}>确认 · 约 ${quote.toFixed(2)}</Button></div></div></div></DialogContent></Dialog>;
}
