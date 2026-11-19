/* eslint-disable @next/next/no-img-element -- 工作台参考图通过鉴权接口显示。 */
"use client";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {submissionKey,forgetSubmission,clientSubmissionSignature} from "./submission-key";
import type {StudioFetchError} from "./studio-fetch";
import {toast} from "sonner";
import {kieImageModels} from "@/lib/image-models";
import type {DirectImageSelection} from "@/lib/direct-image-rules";
import {availableModels,useModelStore,resolveSelection,demoSession} from "./model-store";
import {useStudioAccess} from "./studio-access";
import {studioFetch,useLiveStore,isLiveProduct,liveProjectEpoch} from "./live-store";
import {usePreviewStore} from "./store";
import {Button} from "./ui/button";
import {Textarea} from "./ui/textarea";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "./ui/dialog";

export type DirectImageDraft={name:string;prompt:string;referenceAssetIds:string[];productAssetIds:string[];referencePurpose:string;referenceImage:{id:string;label:string}};
export function DirectImageDialog({open,productId,onClose,initialDraft}:{open:boolean;productId?:string;onClose:()=>void;initialDraft?:DirectImageDraft}){
 const access=useStudioAccess(),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const router=useRouter(),state=useModelStore(),nodes=usePreviewStore(s=>s.nodes);
 const catalog=availableModels(state,"image"),selected=resolveSelection(state,demoSession);
 const [prompt,setPrompt]=useState(initialDraft?.prompt??""),[modelId,setModelId]=useState(""),[resolution,setResolution]=useState("2K"),[ratio,setRatio]=useState("1:1"),[references,setReferences]=useState<string[]>(initialDraft?.referenceAssetIds??[]),[busy,setBusy]=useState(false),[uploadedProductId,setUploadedProductId]=useState<string>();
 const [productPhotos,setProductPhotos]=useState(initialDraft?.productAssetIds??[]),[referencePurpose,setReferencePurpose]=useState(initialDraft?.referencePurpose??"");
 const request=useRef<{signature:string;key:string}|null>(null),submitting=useRef(false);
 const [referenceOwner,setReferenceOwner]=useState(productId);
 const [uploadedChoices,setUploadedChoices]=useState<{id:string;name:string}[]>([]);
 const effectiveModel=modelId|| (selected.auto?selected.imageIds[0]:selected.imageId);
 const model=catalog.find(m=>m.id===effectiveModel),spec=kieImageModels.find(m=>m.id===effectiveModel);
 const photos=useLiveStore(s=>s.snapshot&&s.snapshot.product.id===productId?s.snapshot.product.assets:undefined);
 const choices=(productId?nodes:[]).filter(n=>n.type==="picture"&&n.data.image.startsWith("/api/assets/")&&!n.data.loading&&(!initialDraft||!photos?.some(p=>p.id===n.id)));
 for(const uploaded of uploadedChoices)if(!choices.some(n=>n.id===uploaded.id))choices.push({id:uploaded.id,type:"picture",position:{x:0,y:0},data:{image:"/api/assets/"+uploaded.id,label:uploaded.name,slot:"新上传参考"}});
 if(initialDraft&&!choices.some(n=>n.id===initialDraft.referenceImage.id))choices.unshift({id:initialDraft.referenceImage.id,position:{x:0,y:0},data:{image:"/api/assets/"+initialDraft.referenceImage.id,label:initialDraft.referenceImage.label,slot:"模板参考"}});
 const workspaceId=productId||uploadedProductId,selectedReferences=referenceOwner===workspaceId?references:[];
 const needsReference=(spec?.minReferences??1)>0;
 async function upload(files:File[]){
  if(!files.length||submitting.current||!access.canWrite)return;const epoch=liveProjectEpoch(),origin=productId??"";
  if(files.length+selectedReferences.length>2){toast.error("最多选择两张参考图");return;}
  submitting.current=true;setBusy(true);
  const uploadScope="direct-dialog-upload:"+access.userId+":"+(workspaceId??"new");
  let key:string|undefined;
  try{
   key=submissionKey(uploadScope,await clientSubmissionSignature({productId:workspaceId??null},files));
   const form=new FormData();form.append("requestKey",key);if(workspaceId)form.append("productId",workspaceId);files.forEach(file=>form.append("files",file));
   const result=await studioFetch<{productId:string;results:{filename?:string;assetId?:string;error?:string}[]}>("/api/studio/direct",{method:"POST",body:form});
   if(!mounted.current||!isLiveProduct(origin,epoch))return;setUploadedProductId(result.productId);setReferenceOwner(result.productId);setReferences([...selectedReferences,...result.results.flatMap(r=>r.assetId?[r.assetId]:[])]);
   setUploadedChoices(old=>[...old,...result.results.flatMap((r,i)=>r.assetId?[{id:r.assetId,name:r.filename??files[i]?.name??"上传图片"}]:[])]);
   forgetSubmission(uploadScope,key);
   if(productId)await useLiveStore.getState().load(productId);
   if(result.results.some(r=>r.error))toast.error("部分图片上传失败，请检查后重新上传");
  }catch(error){
   if(key&&(error as StudioFetchError)?.requestState==="failed")forgetSubmission(uploadScope,key);
   toast.error(error instanceof Error?error.message:"参考图上传失败");
  }
  finally{submitting.current=false;setBusy(false);}
 }
 async function submit(){
  if(submitting.current||!access.canWrite)return;const epoch=liveProjectEpoch(),origin=productId??"";submitting.current=true;setBusy(true);
  try{
   const selection:DirectImageSelection={...(workspaceId?{productId:workspaceId}:{}),modelId:effectiveModel,prompt:prompt.trim(),aspectRatio:ratio as DirectImageSelection["aspectRatio"],resolution:resolution as DirectImageSelection["resolution"],referenceAssetIds:selectedReferences,...(initialDraft?{productAssetIds:productPhotos,referencePurpose}:{})};
   const signature=JSON.stringify(selection);if(request.current?.signature!==signature)request.current={signature,key:crypto.randomUUID()};
   const quote=await studioFetch<{fingerprint:string;estimatedCostUsd:number}>("/api/studio/direct",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"quote",selection})});
   if(!mounted.current||!isLiveProduct(origin,epoch))return;
   const result=await studioFetch<{productId:string;jobId:string}>("/api/studio/direct",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"submit",selection,fingerprint:quote.fingerprint,requestKey:request.current.key})});
   if(!mounted.current||!isLiveProduct(origin,epoch))return;
   usePreviewStore.setState({revealJob:{productId:result.productId,jobId:result.jobId}});
   request.current=null;onClose();toast.success("单张生图已提交，结果会加入自由画布");
   if(result.productId!==productId)router.push("/workspace?sku="+result.productId);
   else try{await useLiveStore.getState().load(result.productId);}catch{toast.info("任务已提交，进度暂未刷新，请勿重复生成");}
  }catch(error){toast.error(error instanceof Error?error.message:"任务未提交，请重试");}
  finally{submitting.current=false;setBusy(false);}
 }
 return <Dialog open={open} onOpenChange={value=>{if(!value&&!busy)onClose();}}><DialogContent className="p-portal ws-edit-dialog ws-direct-dialog" data-workspace-flow><DialogHeader><DialogTitle>{initialDraft?"使用模板 · "+initialDraft.name:"单张生图"}</DialogTitle><DialogDescription>{initialDraft?"修改下面的提示词后生成。产品外观以当前实拍为准，模板图只借鉴指定画面元素。":"直接使用你的提示词和所选参考图生成一张图片。可纯文字生成，不经过智能体策划。"}</DialogDescription></DialogHeader><div className="ws-edit-fields">{initialDraft&&<><fieldset className="ws-template-photos"><legend>当前产品实拍</legend><p className="p-subtle">已选择 {productPhotos.length} 张，最多 3 张。请核对提示词中的旧产品结构与颜色。</p><div>{photos?.map(photo=><label key={photo.id}><input type="checkbox" aria-label={"使用产品实拍 "+photo.id} checked={productPhotos.includes(photo.id)} disabled={busy||!access.canWrite||productPhotos.length>=3&&!productPhotos.includes(photo.id)} onChange={e=>setProductPhotos(e.target.checked?[...productPhotos,photo.id]:productPhotos.filter(id=>id!==photo.id))}/><img src={"/api/assets/"+photo.id} alt="当前产品实拍"/></label>)}</div>{!photos?.length&&<p role="status">请先在<a href={"/products/"+productId}>产品资料</a>中补充实拍，再使用模板生成。</p>}</fieldset><label>模板图参考用途<Textarea aria-label="本次模板参考用途" rows={2} maxLength={1000} value={referencePurpose} disabled={busy||!access.canWrite} onChange={e=>setReferencePurpose(e.target.value)}/></label></>}<label>图片描述<Textarea aria-label="单张图片描述" autoFocus rows={5} maxLength={20000} value={prompt} onChange={e=>setPrompt(e.target.value)} disabled={!access.canWrite||busy} placeholder="写下完整画面描述；使用参考图时，也在这里说明想参考什么…"/></label><label>生图模型<select aria-label="单张生图模型" value={effectiveModel} disabled={!access.canWrite||busy} onChange={e=>{setModelId(e.target.value);const next=kieImageModels.find(m=>m.id===e.target.value);if(next&&!next.ratios.includes(ratio))setRatio("1:1");if(next&&!(resolution in next.prices))setResolution("2K");}}>{catalog.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><div className="flex gap-4"><label>比例<select aria-label="单张图片比例" value={ratio} disabled={!access.canWrite||busy} onChange={e=>setRatio(e.target.value)}>{(spec?.ratios??["1:1","3:4","4:3","16:9"]).map(r=><option key={r} value={r}>{r}</option>)}</select></label><label>分辨率<select aria-label="单张图片分辨率" value={resolution} disabled={!access.canWrite||busy} onChange={e=>setResolution(e.target.value)}>{(model?.supportedResolutions??["1K","2K","4K"]).map(r=><option key={r} value={r}>{r}</option>)}</select></label></div><fieldset><legend>{initialDraft?"模板与场景参考（可选，最多两张）":"参考图（可选，最多两张）"}</legend><p className="p-subtle">{initialDraft?"勾选的模板图会直接传给生图模型；取消勾选则只使用提示词与当前实拍。":"不选参考图时仅使用上面的文字。已选参考会真实传给模型。"}</p><label>上传参考图（不调用 Agent）<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!access.canWrite||busy||selectedReferences.length>=2} onChange={e=>{void upload(Array.from(e.target.files??[]));e.target.value="";}}/></label><div className="flex max-h-40 flex-wrap gap-2 overflow-auto">{choices.map(n=><label key={n.id} className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label={"参考 "+n.data.label} checked={selectedReferences.includes(n.id)} disabled={!access.canWrite||busy||selectedReferences.length>=2&&!selectedReferences.includes(n.id)} onChange={e=>{setReferenceOwner(workspaceId);setReferences(e.target.checked?[...selectedReferences,n.id]:selectedReferences.filter(id=>id!==n.id));}}/><img src={n.data.image} alt="" width={48} height={48}/>{n.data.slot} · {n.data.label}</label>)}</div>{needsReference&&!selectedReferences.length&&!productPhotos.length&&<p role="status">此模型的当前接口需要参考图；纯文字生成可选择 Nano Banana 系列。</p>}</fieldset></div><div className="ws-edit-footer"><Button variant="outline" disabled={busy} onClick={onClose}>关闭</Button><Button disabled={!access.canWrite||busy||!prompt.trim()||!!initialDraft&&(!productPhotos.length||!referencePurpose.trim())||!model||needsReference&&!selectedReferences.length&&!productPhotos.length} onClick={()=>void submit()}>{busy?"提交中…":"生成一张"}</Button></div></DialogContent></Dialog>;
}
