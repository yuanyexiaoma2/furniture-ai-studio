"use client";
import {useCanvasSession} from "./canvas-session";
import {Button} from "./ui/button";
export function CanvasSaveStatus(){
 const state=useCanvasSession();
 const label=!state.dataReady||!state.hydrated?"正在恢复布局":!state.canWrite?"只读浏览":({loading:"正在恢复布局",saved:"布局已保存",dirty:"布局待保存",saving:"正在保存布局",error:"布局未保存",conflict:"其他窗口修改待处理"}[state.status]);
 if(state.status!=="error"&&state.status!=="conflict")return <span className="sr-only" role="status" aria-live="polite">{label}</span>;
 return <div className={"t11-save-status "+state.status} role="status"><span>{label}</span>{state.message&&<span title={state.message} className="t11-save-message">{state.message}</span>}{state.status==="error"&&<Button variant="ghost" size="sm" onClick={()=>void (state.hydrated?state.flush():state.reload()).catch(()=>{})}>重试</Button>}{state.status==="conflict"&&<Button variant="ghost" size="sm" onClick={()=>{if(window.confirm("载入其他窗口保存的布局？本窗口未保存的布局将被替换，图片原件不受影响。"))void state.reload().catch(()=>{});}}>载入最新</Button>}</div>;
}
