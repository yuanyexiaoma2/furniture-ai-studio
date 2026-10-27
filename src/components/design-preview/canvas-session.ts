"use client";
import {useEffect} from "react";
import {create} from "zustand";
import {canvasLayoutSchema,emptyCanvasLayout,type CanvasLayout} from "@/lib/canvas-rules";
import {usePreviewStore,type StudioNode} from "./store";

type State={dataReady:boolean;hydrated:boolean;productId:string;revision:number;layout:CanvasLayout;viewport:CanvasLayout["viewport"];registryIds:string[];baseNodes:StudioNode[];status:"loading"|"saved"|"dirty"|"saving"|"error"|"conflict";message:string;canWrite:boolean;flush:()=>Promise<void>;reload:()=>Promise<void>};
export const useCanvasSession=create<State>(()=>({dataReady:false,hydrated:false,productId:"",revision:0,layout:emptyCanvasLayout(),viewport:null,registryIds:[],baseNodes:[],status:"loading",message:"",canWrite:true,flush:async()=>{},reload:async()=>{}}));
export let applyingCanvasLayout=false;
export function applyCanvasLayout(nodes:StudioNode[],layout:CanvasLayout){
 const positions=new Map(layout.nodes.map(n=>[n.id,n])),hidden=new Set(layout.hiddenIds);
 const next=nodes.filter(n=>n.type!=="note"&&!hidden.has(n.id)&&!hidden.has(n.parentId??"")).map(n=>{const p=positions.get(n.id);return p?{...n,position:{x:p.x,y:p.y},style:{...n.style,...(p.width?{width:p.width}:{}),...(p.height?{height:p.height}:{})}}:n;});
 return [...next,...layout.notes.map(n=>({id:n.id,type:"note",position:{x:n.x,y:n.y},style:{width:n.width??220,height:n.height??160},data:{image:"",slot:"便签",label:n.text}} as StudioNode))];
}
export function captureCanvasLayout():CanvasLayout{
 const preview=usePreviewStore.getState(),state=useCanvasSession.getState(),allowed=new Set(state.registryIds);
 const size=(n:StudioNode)=>({...(typeof n.style?.width==="number"?{width:n.style.width}:{}),...(typeof n.style?.height==="number"?{height:n.style.height}:{})});
 return {version:1,nodes:preview.nodes.filter(n=>allowed.has(n.id)).map(n=>({id:n.id,...n.position,...size(n)})),notes:preview.nodes.filter(n=>n.type==="note").map(n=>({id:n.id,text:n.data.label.slice(0,2000),...n.position,...size(n)})),hiddenIds:preview.hiddenIds.filter(id=>allowed.has(id)),viewport:state.viewport};
}
export function useCanvasPersistence(productId:string){
 useEffect(()=>{
  if(!productId)return;
  let active=true,hydrated=false,localRevision=0,localCanWrite=true,conflicted=false,lastSaved="",timer:ReturnType<typeof setTimeout>|undefined,inFlight:Promise<void>|null=null;
  const endpoint="/api/studio/"+productId+"/canvas";
  useCanvasSession.setState({dataReady:false,hydrated:false,productId,revision:0,layout:emptyCanvasLayout(),viewport:null,registryIds:[],baseNodes:[],status:"loading",message:"",canWrite:true});
  usePreviewStore.setState({nodes:[],selected:[],hiddenIds:[],references:[],editor:null,contextId:null,referencePicking:false,tool:"select"});
  async function request(method:"GET"|"PUT",body?:unknown,keepalive=false){const response=await fetch(endpoint,{method,...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body),keepalive}:{}),cache:"no-store"});const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error??"画布保存失败"),{status:response.status});return data as {revision:number;layout:CanvasLayout;canWrite?:boolean};}
  async function reload(){
   if(inFlight)await inFlight;
   const data=await request("GET");if(!active)return;localRevision=data.revision;localCanWrite=data.canWrite!==false;conflicted=false;
   applyingCanvasLayout=true;
   useCanvasSession.setState({hydrated:true,revision:data.revision,layout:data.layout,viewport:data.layout.viewport,canWrite:data.canWrite!==false,status:"saved",message:""});
   usePreviewStore.setState({nodes:applyCanvasLayout(useCanvasSession.getState().baseNodes,data.layout),hiddenIds:data.layout.hiddenIds});
   lastSaved=JSON.stringify(captureCanvasLayout());hydrated=true;applyingCanvasLayout=false;
  }
  async function flush(keepalive=false,captured?:CanvasLayout):Promise<void>{
   if(timer)clearTimeout(timer);
   if(!active&&!captured)return;
   const layout=canvasLayoutSchema.parse(captured??captureCanvasLayout());
   if(inFlight){await inFlight;return flush(keepalive,layout);}
   if(!localCanWrite)return;if(!hydrated)throw Error("画布尚未恢复，请先重试读取布局");
   if(conflicted)throw Error("画布已在其他窗口更新，请载入最新布局");
   const signature=JSON.stringify(layout);if(signature===lastSaved)return;
   if(new TextEncoder().encode(signature).length>60000)throw Error("画布便签较多，请精简后保存");
   if(active)useCanvasSession.setState({status:"saving",message:""});
   const pending=request("PUT",{revision:localRevision,layout},true).then(data=>{localRevision=data.revision;lastSaved=signature;if(!active)return;useCanvasSession.setState({revision:data.revision,layout:data.layout,status:JSON.stringify(captureCanvasLayout())===signature?"saved":"dirty"});}).catch(e=>{if(e.status===409)conflicted=true;if(active)useCanvasSession.setState({status:e.status===409?"conflict":"error",message:e.message});throw e;}).finally(()=>{inFlight=null;});
   inFlight=pending;await pending;
   if(active&&JSON.stringify(captureCanvasLayout())!==lastSaved)await flush(keepalive);
  }
  function changed(){if(!active||!hydrated||applyingCanvasLayout||!useCanvasSession.getState().canWrite)return;const signature=JSON.stringify(captureCanvasLayout());if(signature===lastSaved)return;if(useCanvasSession.getState().status==="conflict")return;useCanvasSession.setState({status:"dirty"});if(timer)clearTimeout(timer);timer=setTimeout(()=>void flush().catch(()=>{}),650);}
  useCanvasSession.setState({flush:()=>flush(),reload});
  const unsubscribe=usePreviewStore.subscribe((next,prev)=>{if(next.nodes!==prev.nodes||next.hiddenIds!==prev.hiddenIds)changed();});
  const viewportSubscription=useCanvasSession.subscribe((next,prev)=>{if(next.viewport!==prev.viewport)changed();});
  const leave=()=>{if(hydrated)void flush(true,captureCanvasLayout()).catch(()=>{});};
  const visibility=()=>{if(document.visibilityState==="hidden")leave();};
  window.addEventListener("pagehide",leave);window.addEventListener("blur",leave);document.addEventListener("visibilitychange",visibility);
  void reload().catch(e=>{if(active)useCanvasSession.setState({status:"error",message:e.message});});
  return()=>{leave();active=false;if(timer)clearTimeout(timer);unsubscribe();viewportSubscription();window.removeEventListener("pagehide",leave);window.removeEventListener("blur",leave);document.removeEventListener("visibilitychange",visibility);};
 },[productId]);
}
