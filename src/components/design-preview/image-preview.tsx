/* eslint-disable @next/next/no-img-element -- 预览服务端原图，保留真实像素。 */
"use client";

import {useEffect,useRef,useState} from "react";
import {Maximize,ZoomIn,ZoomOut} from "@/components/icons/concept-icons";
import {Button} from "./ui/button";
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from "./ui/dialog";

export type PreviewImage={id:string;src:string;label:string};

export function ImagePreview({image,onClose}:{image:PreviewImage;onClose:()=>void}){
 const stage=useRef<HTMLDivElement>(null);
 const [bounds,setBounds]=useState({width:0,height:0}),[natural,setNatural]=useState({width:0,height:0}),[scale,setScale]=useState<number|null>(null),[failed,setFailed]=useState(false);
 const fit=natural.width&&bounds.width?Math.min((bounds.width-48)/natural.width,(bounds.height-48)/natural.height,1):1;
 const zoom=scale??Math.max(.01,fit);
 useEffect(()=>{
  if(!stage.current)return;
  const observer=new ResizeObserver(([entry])=>setBounds({width:entry.contentRect.width,height:entry.contentRect.height}));
  observer.observe(stage.current);return()=>observer.disconnect();
 },[natural.width]);
 function changeZoom(next:number){setScale(Math.max(.1,Math.min(4,next)));}
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="p-portal p-image-preview-dialog nodrag nopan nowheel" onKeyDown={event=>event.stopPropagation()}>
  <DialogHeader><DialogTitle>图片预览</DialogTitle><DialogDescription>{image.label}</DialogDescription></DialogHeader>
  <div className="p-image-preview-stage" ref={stage}>
   {failed?<p role="alert">图片加载失败，请关闭后重试。</p>:<div className="p-image-preview-surface"><img src={image.src} alt={image.label} draggable={false} onLoad={event=>setNatural({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})} onError={()=>setFailed(true)} style={{width:natural.width?natural.width*zoom:undefined,height:natural.height?natural.height*zoom:undefined,visibility:natural.width&&bounds.width?"visible":"hidden"}}/></div>}
  </div>
  <div className="p-image-preview-footer"><span>{natural.width?`${natural.width} × ${natural.height} px`:failed?"":"正在加载原图…"}</span><div role="group" aria-label="图片预览缩放">
   <Button variant="ghost" size="icon" aria-label="缩小图片" disabled={!natural.width||zoom<=.1} onClick={()=>changeZoom(zoom/1.25)}><ZoomOut size="md"/></Button>
   <output aria-label="图片缩放比例">{Math.round(zoom*100)}%</output>
   <Button variant="ghost" size="icon" aria-label="放大图片" disabled={!natural.width||zoom>=4} onClick={()=>changeZoom(zoom*1.25)}><ZoomIn size="md"/></Button>
   <Button variant="ghost" disabled={!natural.width} aria-pressed={scale===1} onClick={()=>setScale(1)}>原始尺寸</Button>
   <Button variant="ghost" disabled={!natural.width} aria-pressed={scale===null} onClick={()=>setScale(null)}><Maximize size="md"/>适应窗口</Button>
  </div><span className="p-image-preview-hint">Esc 关闭 · 放大后可滚动查看</span></div>
 </DialogContent></Dialog>;
}
