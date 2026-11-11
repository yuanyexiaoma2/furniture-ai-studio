/* eslint-disable @next/next/no-img-element -- 修改对象与颜色参考使用鉴权图片。 */
"use client";
import {useRef,useState} from "react";
import {toast} from "sonner";
import {appearanceInstruction,type AppearanceChange} from "@/lib/appearance-change";
import type {OnImageAction} from "./contracts";
import {usePreviewStore} from "./store";
import {useModelStore,estimateImageCost,demoSession} from "./model-store";
import {Button} from "./ui/button";
import {Textarea} from "./ui/textarea";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "./ui/dialog";

export type EditDraft={changes:string;keep:string;referenceAssetId:string;environment:AppearanceChange["environment"]};
export const emptyEditDraft=():EditDraft=>({changes:"",keep:"产品造型、机位、构图和未提到的部分",referenceAssetId:"",environment:"keep"});
export function QuickImageEdit({id,mode,draft,onDraft,onClose,onAction}:{id:string;mode:"edit"|"recolor";draft:EditDraft;onDraft:(draft:EditDraft)=>void;onClose:()=>void;onAction:OnImageAction}){
 const node=usePreviewStore(s=>s.nodes.find(n=>n.id===id)),nodes=usePreviewStore(s=>s.nodes),[busy,setBusy]=useState(false),submitting=useRef(false);
 const price=estimateImageCost(useModelStore(),demoSession,1),recolor=mode==="recolor";
 const choices=nodes.filter(n=>n.type==="picture"&&n.id!==id&&["reference","product","unresolved"].includes(n.data.assetRole??"")&&n.data.image.startsWith("/api/assets/"));
 const chosen=choices.find(n=>n.id===draft.referenceAssetId);
 async function submit(){if(!node||submitting.current)return;submitting.current=true;setBusy(true);try{
  const appearanceChange:AppearanceChange|undefined=recolor?{description:draft.changes.trim(),environment:draft.environment,...(chosen?{referenceAssetId:chosen.id}:{})}:undefined;
  const instruction=appearanceChange?appearanceInstruction(appearanceChange):`只调整：${draft.changes.trim()}。${draft.keep.trim()?"保持："+draft.keep.trim()+"。":""}未明确要求修改的部分保持原图。`;
  const result=await onAction({action:recolor?"recolor":"regenerate",imageId:id,originalImage:node.data.image,originalPhotoReferences:[],productReferences:[],instruction,appearanceChange,editCount:node.data.editCount??0});
  if(result!==false){onDraft(emptyEditDraft());onClose();}
 }catch(e){toast.error(e instanceof Error?e.message:"修改未提交，意见已保留");}finally{submitting.current=false;setBusy(false);}}
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent className="p-portal ws-edit-dialog" data-workspace-flow><DialogHeader><DialogTitle>{recolor?"同款换色 / 材质":"修改这张图"}</DialogTitle><DialogDescription>{node?node.data.slot+" · "+node.data.label:"原图已不在画布，请关闭后重新选择"}。新结果保留为另一版本。</DialogDescription></DialogHeader><div className="ws-edit-body"><figure>{node&&<img src={node.data.image} alt="本次修改原图"/>}<figcaption>{recolor?"造型、机位与构图来自这张图":"本次修改只针对这张图"}</figcaption></figure><div className="ws-edit-fields">{recolor&&<><label>颜色材质来源<select aria-label="颜色材质参考" value={draft.referenceAssetId} disabled={busy} onChange={e=>onDraft({...draft,referenceAssetId:e.target.value})}><option value="">用下面的文字指定</option>{choices.map(n=><option key={n.id} value={n.id}>{n.data.slot} · {n.data.label}</option>)}</select></label>{chosen&&<img className="ws-color-reference" src={chosen.data.image} alt="目标颜色材质参考"/>}<small>需要图片参考时，先在工作台上传目标颜色的实拍。</small></>}<label>{recolor?"目标颜色和材质":"要改什么"}<Textarea autoFocus aria-label={recolor?"目标颜色和材质":"本次修改要求"} placeholder={recolor?"例如：改成深胡桃木台面、哑光黑金属框架；已选图时可补充只改哪个部位":"例如：台面只留右侧托盘，移走花瓶，其他不动"} value={draft.changes} maxLength={recolor?2000:6000} disabled={busy} onChange={e=>onDraft({...draft,changes:e.target.value})}/></label>{recolor?<label>环境配色<select aria-label="换色时的环境配色" value={draft.environment} disabled={busy} onChange={e=>onDraft({...draft,environment:e.target.value as AppearanceChange["environment"]})}><option value="keep">保持原环境和道具</option><option value="adapt">配色适配新产品，保留摆放和构图</option></select></label>:<label>保留什么<Textarea aria-label="本次保持不变" value={draft.keep} maxLength={1000} disabled={busy} onChange={e=>onDraft({...draft,keep:e.target.value})}/></label>}</div></div><div className="ws-edit-footer"><span>预估约 $ {price.toFixed(4)} / 张</span><Button variant="outline" disabled={busy} onClick={onClose}>暂不修改</Button><Button disabled={busy||!node||(!draft.changes.trim()&&!(recolor&&chosen))} onClick={()=>void submit()}>{busy?"提交中…":recolor?"生成同款新配色":"按意见生成新版本"}</Button></div></DialogContent></Dialog>;
}
