/* eslint-disable @next/next/no-img-element -- 用户原图使用鉴权图片接口。 */
"use client";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import {toast} from "sonner";
import {Upload,ArrowLeft,X} from "@/components/icons/concept-icons";
import {kieImageModels} from "@/lib/image-models";
import type {DirectImageSelection} from "@/lib/direct-image-rules";
import type {Expansion} from "@/lib/expansion-rules";
import {appearanceInstruction} from "@/lib/appearance-change";
import {availableModels,useModelStore,resolveSelection,demoSession} from "./model-store";
import {useStudioAccess} from "./studio-access";
import {studioFetch,type StudioFetchError} from "./studio-fetch";
import {usePreviewStore} from "./store";
import {ToolImagePicker} from "./home-tools";
import {Button} from "./ui/button";
import {Textarea} from "./ui/textarea";
import {submissionKey,forgetSubmission,clientSubmissionSignature} from "./submission-key";
import {readToolDraft,writeToolDraft,clearToolDraft} from "./tool-draft";

const ExpandEditor=dynamic(()=>import("./expand-editor"),{ssr:false});
export type ImageTool="recolor"|"expand"|"cutout"|"direct";
const titles={recolor:"同款换色",expand:"智能扩图",cutout:"产品抠图",direct:"单张生图"};
const cutoutPrompt="移除背景，保持产品完整轮廓、原有颜色和材质，不增删产品部件，输出干净白色背景的产品图。";
type Uploaded={id:string;name:string};

export function ImageToolPage({tool}:{tool:ImageTool}){
 const access=useStudioAccess();
 if(!access.ready)return null;
 return <ImageToolEditor key={access.userId+":"+tool} tool={tool} userId={access.userId}/>;
}
function ImageToolEditor({tool,userId}:{tool:ImageTool;userId:string}){
 const router=useRouter(),access=useStudioAccess(),models=useModelStore();
 const scope=userId+":"+tool;
 const [saved]=useState(()=>readToolDraft(scope));
 const catalog=availableModels(models,"image"),selected=resolveSelection(models,demoSession);
 const [modelId,setModelId]=useState(saved?.modelId??""),[resolution,setResolution]=useState(saved?.resolution??"2K"),[ratio,setRatio]=useState(saved?.ratio??"1:1");
 const model=catalog.find(m=>m.id===(modelId||(selected.auto?selected.imageIds[0]:selected.imageId)))??catalog[0];
 const spec=kieImageModels.find(m=>m.id===model?.id);
 const [productId,setProductId]=useState<string|undefined>(saved?.productId),[images,setImages]=useState<Uploaded[]>(saved?.images??[]);
 const [prompt,setPrompt]=useState(saved?.prompt??(tool==="cutout"?cutoutPrompt:"")),[environment,setEnvironment]=useState<"keep"|"adapt">(saved?.environment??"keep");
 const [sourceSize,setSourceSize]=useState({width:1,height:1});
 const [extent,setExtent]=useState<Expansion|undefined>(saved?.extent),[expandOpen,setExpandOpen]=useState(false),[historyOpen,setHistoryOpen]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const fileInput=useRef<HTMLInputElement>(null),locked=useRef(false),mounted=useRef(true),completed=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{if(userId&&!completed.current)writeToolDraft(scope,{productId,images,prompt,environment,modelId,resolution,ratio,extent});},[scope,userId,productId,images,prompt,environment,modelId,resolution,ratio,extent]);
 const direct=tool==="direct",source=images[0],disabled=busy||!access.canWrite;
 const valid=!!model&&(direct?!!prompt.trim()&&(!(spec?.minReferences??1)||images.length>0):!!source&&(tool==="expand"?!!extent:!!prompt.trim()));

 async function upload(files:File[]){
  if(!files.length||locked.current||!access.canWrite)return;
  if((direct?images.length:0)+files.length>(direct?2:1)){setError(direct?"最多上传两张参考图":"请选择一张要处理的产品图");return;}
  if(files.some(f=>!["image/jpeg","image/png","image/webp"].includes(f.type)||!f.size||f.size>30*1024*1024)){setError("请上传30MB以内的JPG、PNG或WEBP图片");return;}
  locked.current=true;setBusy(true);setError("");
  const uploadScope="direct-upload:"+scope;
  let key:string|undefined;
  try{
   key=submissionKey(uploadScope,await clientSubmissionSignature({productId:productId??null},files));
   const form=new FormData();form.append("requestKey",key);if(productId)form.append("productId",productId);files.forEach(f=>form.append("files",f));
   const result=await studioFetch<{productId:string;results:{filename:string;assetId?:string;error?:string}[]}>("/api/studio/direct",{method:"POST",body:form});
   if(!mounted.current)return;
   setProductId(result.productId);
   const added=result.results.flatMap(r=>r.assetId?[{id:r.assetId,name:r.filename}]:[]);
   writeToolDraft(scope,{productId:result.productId,images:added.length?(direct?[...images,...added]:added):images,prompt,environment,modelId,resolution,ratio,extent:added.length?undefined:extent});
   forgetSubmission(uploadScope,key);
   if(added.length){setImages(old=>direct?[...old,...added]:added);setExtent(undefined);}
   if(result.results.some(r=>r.error))setError(result.results.filter(r=>r.error).map(r=>r.error).join("；"));
  }catch(e){
   if(key&&(e as StudioFetchError)?.requestState==="failed")forgetSubmission(uploadScope,key);
   if(mounted.current)setError(e instanceof Error?e.message:"上传失败，请重新上传");
  }
  finally{locked.current=false;if(mounted.current)setBusy(false);}
 }
 async function submit(){
  if(!valid||locked.current||!access.canWrite||!model)return;
  locked.current=true;setBusy(true);setError("");
  try{
   const appearanceChange={description:prompt.trim(),environment};
   const selection:DirectImageSelection={productId,modelId:model.id,resolution:resolution as DirectImageSelection["resolution"],aspectRatio:ratio as DirectImageSelection["aspectRatio"],prompt:tool==="recolor"?appearanceInstruction(appearanceChange):tool==="expand"?"延续原图的背景、光线与透视，只补全扩展范围。"+(prompt.trim()?" "+prompt.trim():""):prompt.trim(),referenceAssetIds:direct?images.map(i=>i.id):[],...(!direct?{edit:tool==="recolor"?{tool,sourceAssetId:source.id,appearanceChange}:tool==="expand"?{tool,sourceAssetId:source.id,expansion:extent!}:{tool:"cutout",sourceAssetId:source.id}}:{})};
   const requestScope="direct-generate:"+scope,key=submissionKey(requestScope,JSON.stringify(selection));
   const quote=await studioFetch<{fingerprint:string}>("/api/studio/direct",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"quote",selection})});
   if(!mounted.current)return;
   const result=await studioFetch<{productId:string;jobId:string}>("/api/studio/direct",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"submit",selection,fingerprint:quote.fingerprint,requestKey:key})});
   if(!mounted.current)return;
   completed.current=true;forgetSubmission(requestScope,key);clearToolDraft(scope);usePreviewStore.setState({revealJob:result});toast.success("已提交，结果会加入画布");router.push("/workspace?sku="+result.productId);
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:"提交失败，图片与设置已保留");}
  finally{locked.current=false;if(mounted.current)setBusy(false);}
 }
 return <main className="image-tool-page"><div className="image-tool-heading"><Link href="/" aria-label="返回首页"><ArrowLeft size="md"/></Link><h1>{titles[tool]}</h1>{!direct&&<Button variant="ghost" disabled={disabled} onClick={()=>setHistoryOpen(true)}>从历史作品选择</Button>}</div>
  <div className="image-tool-layout"><section className="image-tool-preview" aria-label="上传新产品图片" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!disabled)void upload(Array.from(e.dataTransfer.files));}}>
   <input ref={fileInput} className="sr-only" type="file" aria-label={direct?"上传新产品参考图":"上传新产品原图"} accept="image/jpeg,image/png,image/webp" multiple={direct} disabled={disabled||direct&&images.length>=2} onChange={e=>{void upload(Array.from(e.target.files??[]));e.target.value="";}}/>
   {source?<><div className={"image-tool-source"+(extent?" is-expanded":"")} style={extent?{aspectRatio:extent.width+"/"+extent.height}:undefined}><img src={"/api/assets/"+source.id} alt="新产品原图" onLoad={e=>setSourceSize({width:e.currentTarget.naturalWidth,height:e.currentTarget.naturalHeight})} style={extent?{position:"absolute",left:extent.offsetX/extent.width*100+"%",top:extent.offsetY/extent.height*100+"%",width:sourceSize.width/extent.width*100+"%",height:sourceSize.height/extent.height*100+"%",objectPosition:"left top"}:undefined}/></div><div className="image-tool-upload-actions"><Button variant="outline" disabled={disabled||direct&&images.length>=2} onClick={()=>fileInput.current?.click()}>{direct?"添加参考图":"更换图片"}</Button>{tool==="expand"&&<Button variant="outline" disabled={disabled} onClick={()=>setExpandOpen(true)}>{extent?"调整扩图范围":"设置扩图范围"}</Button>}</div>{direct&&<div className="image-tool-references">{images.map(i=><div key={i.id}><img src={"/api/assets/"+i.id} alt={i.name}/><Button variant="ghost" size="icon" aria-label={"移除 "+i.name} disabled={disabled} onClick={()=>setImages(images.filter(v=>v.id!==i.id))}><X size="sm"/></Button></div>)}</div>}</>:<button className="image-tool-drop" disabled={disabled} onClick={()=>fileInput.current?.click()}><Upload size="lg"/><strong>{busy?"正在上传…":direct?"上传产品参考图":"上传产品图片"}</strong><span>{direct?"可选，也可以直接输入描述生成":"点击或拖入 JPG、PNG、WEBP"}</span></button>}
  </section><section className="image-tool-settings" aria-label={titles[tool]+"设置"}>
   <label>{tool==="recolor"?"目标颜色和材质":tool==="expand"?"补充要求（可选）":tool==="cutout"?"抠图要求":"图片描述"}<Textarea aria-label={tool==="recolor"?"目标颜色和材质":"图片处理要求"} rows={5} value={prompt} maxLength={tool==="recolor"?2000:6000} disabled={disabled} onChange={e=>setPrompt(e.target.value)} placeholder={tool==="recolor"?"例如：台面换成黑色木纹，框架保持原色":tool==="expand"?"例如：向两侧延伸墙面和地板":"描述你想要的画面…"}/></label>
   {tool==="recolor"&&<label>环境配色<select aria-label="环境配色" disabled={disabled} value={environment} onChange={e=>setEnvironment(e.target.value as "keep"|"adapt")}><option value="keep">保持原环境</option><option value="adapt">随产品配色适配</option></select></label>}
   <label>生图模型<select aria-label="工具生图模型" disabled={disabled} value={model?.id??""} onChange={e=>{setModelId(e.target.value);const next=kieImageModels.find(m=>m.id===e.target.value);if(next&&!next.ratios.includes(ratio))setRatio("1:1");const nextModel=catalog.find(m=>m.id===e.target.value);if(nextModel&&!nextModel.supportedResolutions?.includes(resolution))setResolution(nextModel.supportedResolutions?.[0]??"2K");}}>{catalog.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
   <div className="image-tool-options">{tool!=="expand"&&<label>比例<select aria-label="工具图片比例" disabled={disabled} value={ratio} onChange={e=>setRatio(e.target.value)}>{(spec?.ratios??["1:1","4:3","3:4"]).map(r=><option key={r}>{r}</option>)}</select></label>}<label>分辨率<select aria-label="工具图片分辨率" disabled={disabled} value={resolution} onChange={e=>setResolution(e.target.value)}>{(model?.supportedResolutions??["1K","2K","4K"]).map(r=><option key={r}>{r}</option>)}</select></label></div>
   {error&&<p role="alert" className="image-tool-error">{error}</p>}{!access.canWrite&&access.ready&&<p role="status">当前账号为只读，不能上传或生成。</p>}
   <Button disabled={disabled||!valid} onClick={()=>void submit()}>{busy?"处理中…":tool==="recolor"?"生成新配色":tool==="expand"?"开始扩图":tool==="cutout"?"开始抠图":"生成一张"}</Button>
  </section></div>
  {expandOpen&&source&&<ExpandEditor src={"/api/assets/"+source.id} onCancel={()=>setExpandOpen(false)} onConfirm={value=>{setExtent(value);setExpandOpen(false);return true;}}/>}
  {historyOpen&&tool!=="direct"&&<ToolImagePicker tool={tool} onClose={()=>setHistoryOpen(false)}/>}
 </main>;
}
