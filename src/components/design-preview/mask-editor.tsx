"use client";
import {forwardRef,useRef,useState,useImperativeHandle} from "react";
import Konva from "konva";
import {Stage,Layer,Line} from "react-konva";
import {NodeToolbar,Position} from "@xyflow/react";
import {Brush,Eraser,Undo2,Trash2} from "@/components/icons/concept-icons";
import {demoSession,estimateCost,useModelStore} from "./model-store";
import {Button} from "./ui/button";
import {Slider} from "./ui/slider";
import type {MaskExportHandle} from "./contracts";
type Stroke={tool:"brush"|"eraser";size:number;points:number[]};
type Props={action:string;src:string;width:number;height:number;onConfirm:(mask:Blob)=>void|boolean|Promise<void|boolean>;onCancel:()=>void};
const MaskEditor=forwardRef<MaskExportHandle,Props>(function MaskEditor({action,src,width,height,onConfirm,onCancel},ref){
 const quote=estimateCost(useModelStore(),demoSession,1);
 const [strokes,setStrokes]=useState<Stroke[]>([]),[tool,setTool]=useState<"brush"|"eraser">('brush'),[size,setSize]=useState(18),[maskColor]=useState(()=>typeof window==='undefined'?'':getComputedStyle(document.documentElement).getPropertyValue('--p-mask').trim());
 const drawing=useRef(false),stage=useRef<Konva.Stage>(null);
 const [submitting,setSubmitting]=useState(false);
 async function exportMask(){
  const image=new window.Image();image.src=src;await image.decode();
  // 画布缩略图使用居中cover；把笔迹逆变换回原图像素，未展示的区域保持黑色。
  const scale=Math.max(width/image.naturalWidth,height/image.naturalHeight),offsetX=(image.naturalWidth*scale-width)/2,offsetY=(image.naturalHeight*scale-height)/2;
  const container=document.createElement('div');const output=new Konva.Stage({container,width:image.naturalWidth,height:image.naturalHeight});const layer=new Konva.Layer();
  const css=getComputedStyle(document.documentElement);const white=css.getPropertyValue('--p-mask-export').trim(),black=css.getPropertyValue('--p-mask-empty').trim();
  layer.add(new Konva.Rect({width:image.naturalWidth,height:image.naturalHeight,fill:black}));
  strokes.forEach(line=>layer.add(new Konva.Line({points:line.points.map((value,index)=>(value+(index%2?offsetY:offsetX))/scale),stroke:line.tool==='brush'?white:black,strokeWidth:line.size/scale,lineCap:'round',lineJoin:'round',tension:.3})));
  output.add(layer);layer.draw();const blob=await new Promise<Blob>((resolve,reject)=>output.toCanvas().toBlob(b=>b?resolve(b):reject(new Error('蒙版导出失败')),'image/png'));output.destroy();return blob;
 }
 useImperativeHandle(ref,()=>({exportMask}));
 return <><NodeToolbar isVisible position={Position.Top} offset={20}><div className="p-mask-tools nodrag"><span>{action==='paint'?'局部重绘':'消除'} · 画笔 {size}px</span><Slider aria-label="画笔大小" value={[size]} onValueChange={v=>setSize(v[0])} min={4} max={60} step={1}/><Button variant={tool==='brush'?'secondary':'ghost'} size="icon" className="p-icon-button" aria-label="画笔" onClick={()=>setTool('brush')}><Brush size={16}/></Button><Button variant={tool==='eraser'?'secondary':'ghost'} size="icon" className="p-icon-button" aria-label="橡皮" onClick={()=>setTool('eraser')}><Eraser size={16}/></Button><Button variant="ghost" size="icon" className="p-icon-button" aria-label="撤销笔迹" onClick={()=>setStrokes(s=>s.slice(0,-1))}><Undo2 size={16}/></Button><Button variant="ghost" size="icon" className="p-icon-button" aria-label="清空蒙版" onClick={()=>setStrokes([])}><Trash2 size={16}/></Button></div></NodeToolbar>
 <div className="p-mask-editor nodrag nopan nowheel"><Stage ref={stage} width={width} height={height} onMouseDown={()=>{drawing.current=true;const p=stage.current?.getPointerPosition();if(p)setStrokes(s=>[...s,{tool,size,points:[p.x,p.y,p.x+.1,p.y+.1]}]);}} onTouchStart={e=>{e.evt.preventDefault();drawing.current=true;const p=stage.current?.getPointerPosition();if(p)setStrokes(s=>[...s,{tool,size,points:[p.x,p.y]}]);}} onMouseMove={()=>{if(!drawing.current)return;const p=stage.current?.getPointerPosition();if(p)setStrokes(s=>s.map((line,i)=>i===s.length-1?{...line,points:[...line.points,p.x,p.y]}:line));}} onTouchMove={e=>{e.evt.preventDefault();if(!drawing.current)return;const p=stage.current?.getPointerPosition();if(p)setStrokes(s=>s.map((line,i)=>i===s.length-1?{...line,points:[...line.points,p.x,p.y]}:line));}} onMouseUp={()=>drawing.current=false} onMouseLeave={()=>drawing.current=false} onTouchEnd={()=>drawing.current=false}><Layer>{strokes.map((line,i)=><Line key={i} points={line.points} stroke={maskColor} opacity={.55} strokeWidth={line.size} lineCap="round" lineJoin="round" tension={.3} globalCompositeOperation={line.tool==='eraser'?'destination-out':'source-over'}/>)}</Layer></Stage></div>
 <NodeToolbar isVisible position={Position.Bottom} align="end" offset={16}><div className="p-editor-footer"><Button variant="outline" disabled={submitting} onClick={onCancel}>取消</Button><Button disabled={submitting||!strokes.some(s=>s.tool==='brush')} onClick={async()=>{setSubmitting(true);try{await onConfirm(await exportMask());}catch{/* 保留笔迹，错误由工作台统一提示。 */}finally{setSubmitting(false);}}}>{submitting?"正在提交…":`确认 · 约 $${quote.toFixed(2)}`}</Button></div></NodeToolbar></>;
});
export default MaskEditor;
