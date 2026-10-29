"use client";
import {useEffect,useRef,useState} from "react";
import {usePreviewStore,type StudioNode} from "./store";
import {applyCanvasLayout,applyingCanvasLayout,useCanvasSession} from "./canvas-session";
import {captureLayoutHistory} from "./canvas-layout-history";
import type {CanvasLayout} from "@/lib/canvas-rules";

export function useCanvasHistory(live:boolean,productId:string){
 const commands=useRef({undo:()=>{},redo:()=>{}}),[available,setAvailable]=useState({undo:false,redo:false});
 useEffect(()=>{
  let present:CanvasLayout|null=null,past:CanvasLayout[]=[],future:CanvasLayout[]=[],applying=false,registry="";
  const bases=new Map<string,StudioNode>();
  const notify=()=>setAvailable({undo:past.length>0,redo:future.length>0});
  function observe(){
   const state=usePreviewStore.getState(),session=useCanvasSession.getState();
   if(live&&(!session.hydrated||!session.dataReady))return;
   for(const n of live?session.baseNodes:state.nodes)if(n.type!=="note")bases.set(n.id,n);
   const ids=live?[...session.registryIds].sort().join("|"):"prototype";
   const next=captureLayoutHistory(state.nodes,state.hiddenIds);
   if(!present||registry!==ids||applyingCanvasLayout){registry=ids;present=next;past=[];future=[];notify();return;}
   if(applying||state.nodes.some(n=>n.dragging)||JSON.stringify(next)===JSON.stringify(present))return;
   past=[...past,present].slice(-50);present=next;future=[];notify();
  }
  function move(direction:"undo"|"redo"){
   const session=useCanvasSession.getState();
   if(live&&(!session.canWrite||!session.hydrated||!session.dataReady))return;
   observe();const stack=direction==="undo"?past:future,target=stack.at(-1);if(!target||!present)return;
   if(direction==="undo"){past=past.slice(0,-1);future=[...future,present];}else{future=future.slice(0,-1);past=[...past,present];}
   // 基础节点始终取最新数据：撤销布局不会把已完成任务变回生成中。
   const current=usePreviewStore.getState();for(const n of live?session.baseNodes:current.nodes)if(n.type!=="note")bases.set(n.id,n);
   applying=true;present=target;usePreviewStore.setState({nodes:applyCanvasLayout([...bases.values()],target),hiddenIds:target.hiddenIds,selected:[],contextId:null});applying=false;notify();
  }
  commands.current={undo:()=>move("undo"),redo:()=>move("redo")};observe();
  const unsub=usePreviewStore.subscribe(observe),sessionUnsub=useCanvasSession.subscribe((n,p)=>{if(n.hydrated!==p.hydrated||n.dataReady!==p.dataReady||n.registryIds!==p.registryIds)observe();});
  return()=>{unsub();sessionUnsub();commands.current={undo:()=>{},redo:()=>{}};};
 },[live,productId]);
 return {...available,undoLayout:()=>commands.current.undo(),redoLayout:()=>commands.current.redo()};
}
