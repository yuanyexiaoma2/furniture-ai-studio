"use client";
import {Upload,ArrowRight} from "@/components/icons/concept-icons";
import {useWorkflowStore} from "./batch/workflow-store";
export function CanvasEmpty({onUpload}:{onUpload:()=>void}){return <div className="r1-canvas-empty"><button className="r1-drop-target" onClick={onUpload}><span className="concept-icon-box"><Upload size={20}/></span><strong>把实拍拖到这里</strong><span>支持 JPG、PNG、WEBP</span></button><button className="r1-template-link" onClick={()=>{useWorkflowStore.getState().launch("pack","templates");document.dispatchEvent(new Event("preview-open-templates"));}}>从模板开始<ArrowRight size={16}/></button></div>;}
