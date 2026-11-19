"use client";
import {Upload,ArrowRight,Images,X} from "@/components/icons/concept-icons";
import {useWorkflowStore} from "./batch/workflow-store";
import {Button} from "./ui/button";

export type PackCanvasDraft={
 files:File[];
 busy:boolean;
 canStart:boolean;
 disabled:boolean;
 error:string;
 onStart:()=>void;
 onRemove:(index:number)=>void;
};

export function CanvasEmpty({onUpload,packDraft}:{onUpload:()=>void;packDraft?:PackCanvasDraft}){
 if(packDraft){
  const {files,busy,disabled,canStart,error,onStart,onRemove}=packDraft;
  return <div className="r1-canvas-empty ws-pack-empty">
   <div className="p-empty-heading"><h2>套图生成</h2></div>
   <div className="ws-pack-draft">
    {files.length>0&&<ul className="ws-pack-files" aria-label="套图素材">
     {files.map((file,index)=><li key={file.name+":"+index}>
      <span title={file.name}>{file.name}</span>
      <Button type="button" variant="ghost" size="icon" disabled={disabled||busy} aria-label={"移除 "+file.name} onClick={()=>onRemove(index)}><X size="sm"/></Button>
     </li>)}
    </ul>}
    <Button type="button" variant={canStart?"outline":"default"} disabled={disabled||busy} onClick={onUpload}><Upload size="md"/>添加产品实拍</Button>
    {error&&<p className="ws-pack-error" role="alert">{error}</p>}
    <Button type="button" variant={canStart?"default":"outline"} disabled={disabled||busy||!canStart} onClick={onStart}>{busy?"正在准备…":"开始做套图"}</Button>
   </div>
  </div>;
 }
 return <div className="r1-canvas-empty"><div className="p-empty-art" aria-hidden="true"><span/><span/><Images size={32}/></div><div className="p-empty-heading"><h2>让产品走进好场景</h2><p>先放入实拍，有喜欢的参考也可以一起带来。</p></div><button className="r1-drop-target" onClick={onUpload}><Upload size="lg"/><strong>添加实拍与参考图</strong><span>或拖到画布 · JPG、PNG、WEBP</span></button><div className="p-empty-steps" aria-label="创作步骤"><span>01 放入实拍</span><ArrowRight size="sm"/><span>02 讨论方向</span><ArrowRight size="sm"/><span>03 选图调整</span></div><button className="r1-template-link" onClick={()=>{useWorkflowStore.getState().launch("pack","templates");document.dispatchEvent(new Event("preview-open-templates"));}}>从模板开始<ArrowRight size="sm"/></button></div>;
}
