/* eslint-disable @next/next/no-img-element -- 通过鉴权接口读取私有图片。 */
"use client";
import {SavedReferences} from "./saved-references";
import {SkuDeleteButton} from "./sku-delete-button";
import {DirectImageDialog} from "./direct-image-dialog";
import {conversationImages,type SlotReference} from "@/lib/generation-references";
import {submitEditImmediately} from "@/lib/direct-submission";
import {QuestionsCard,ProfileForm} from "./interaction-cards";
import {currentGenerationSlot,type UserQuestion} from "@/lib/interaction-rules";
import {VersionHistory} from "./version-history";
import {VisualPlanCard} from "./visual-plan-card";
import type {VisualPlan} from "@/lib/visual-plan-rules";
import {SHOW_UNCONNECTED_FEATURES} from "@/lib/ui-features";
import {Suspense,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {useSearchParams,useRouter} from "next/navigation";
import {useDropzone} from "react-dropzone";
import {toast} from "sonner";
import {PanelLeftClose,MessageCircle,WandSparkles} from "@/components/icons/concept-icons";
import {TipButton} from "./app";
import {Workspace} from "./canvas";
import {imageActionIntents} from "@/prompts/image-actions";
import {useCanvasPersistence,useCanvasSession} from "./canvas-session";
import {usePreviewStore} from "./store";
import {WorkspaceProgress} from "./workspace-progress";
import {consumeAgentStream} from "@/lib/agent-stream";
import type {AgentEvent} from "@/lib/planning-agent";
import {defaultPackPrompt,useLiveStore,studioFetch,activateLiveProduct,isLiveProduct,liveProjectEpoch} from "./live-store";
import {useModelStore,resolveSelection,demoSession,availableModels} from "./model-store";
import {startWorkspaceSettings,flushWorkspaceSettings} from "./workspace-settings";
import {useStudioAccess} from "./studio-access";
import {workspaceMessageText} from "@/lib/workspace-messages";

import {ComposerToolbar} from "./model-picker";
import {Button} from "./ui/button";
import {Textarea} from "./ui/textarea";
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from "./ui/sheet";
import {Popover,PopoverTrigger,PopoverContent} from "./ui/popover";
import {Command,CommandInput,CommandList,CommandEmpty,CommandGroup,CommandItem} from "./ui/command";
import {Switch} from "./ui/switch";
import {Upload,Shapes,Check,ChevronDown} from "@/components/icons/concept-icons";
import {IconBadge} from "@/components/icons/icon-badge";
import {taskCatalog} from "@/design-preview/mock/tasks";
import {type Profile} from "@/lib/profile-rules";
import {shotLabels,type ShotAngle} from "@/design-preview/library/types";
import type {ActionRequest} from "./contracts";
const editRequestKeys=new Map<string,string>();
const notify=(e:unknown)=>toast.error(e instanceof Error?e.message:"操作失败，请稍后重试");
const hasPackPhoto=(files:File[])=>files.some(file=>/\.(jpe?g|png|webp)$/i.test(file.name));
export function RealWorkspace(){return <Suspense fallback={<div>正在打开工作台…</div>}><RealWorkspaceInner/></Suspense>;}
function RealWorkspaceInner(){
 const live=useLiveStore(),router=useRouter(),params=useSearchParams(),id=params.get("sku")??"",initialized=useRef(false);
 const tool=params.get("tool"),imageId=params.get("image")??"";
 const packEntry=tool==="pack"&&!id;
 const [directOpen,setDirectOpen]=useState(tool==="direct"),[settingsIssue,setSettingsIssue]=useState({productId:"",message:""});
 const consumeTool=()=>{const url=new URL(window.location.href);url.searchParams.delete("tool");url.searchParams.delete("image");window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);};
 useEffect(()=>{if(tool==="direct")consumeTool();},[tool]);
 const access=useStudioAccess();
 useCanvasPersistence(id);
 useEffect(()=>{
  if(!access.ready)return;
  const release=activateLiveProduct(id);useModelStore.getState().startSession(demoSession,true);usePreviewStore.setState({liveMode:true});
  if(!id){usePreviewStore.setState({nodes:[]});return release;}
  let active=true,needsInitial=new URLSearchParams(window.location.search).get("init")==="1",sync:ReturnType<typeof startWorkspaceSettings>|undefined;
  async function load(){try{
   const snapshot=await useLiveStore.getState().load(id);if(!active||!snapshot)return;
   if(!initialized.current){
    initialized.current=true;
    sync=startWorkspaceSettings(id,snapshot.settings,access.canWrite,message=>{if(active)setSettingsIssue({productId:id,message});},access.userId);
    const url=new URL(window.location.href);if(url.searchParams.has("init")){url.searchParams.delete("init");window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);}
   }
   const models=useModelStore.getState();
   if(needsInitial&&access.canWrite&&availableModels(models,"agent").length&&availableModels(models,"image").length){
    needsInitial=false;if(!snapshot.agent.cards.length&&!snapshot.settings.initialInspectionAttempted)await useLiveStore.getState().act("inspect",{initial:true});
   }
  }catch(error){if(active)useLiveStore.setState({error:error instanceof Error?error.message:"加载失败"});}}
  void load();const timer=setInterval(()=>void load(),4000);
  return()=>{active=false;sync?.stop();release();clearInterval(timer);initialized.current=false;};
 },[id,access.ready,access.canWrite,access.userId]);
 async function startPack(){
  const draft=useLiveStore.getState();
  if(!access.canWrite||draft.busy||!hasPackPhoto(draft.files))return;
  const epoch=liveProjectEpoch();
  try{
   const productId=await draft.create(draft.packPrompt?.trim()||defaultPackPrompt,demoSession);
   if(!isLiveProduct("",epoch))return;
   useLiveStore.setState({packPrompt:null});
   router.replace("/workspace?sku="+productId+(useLiveStore.getState().initializationReady?"&init=1":""));
  }catch{
   // 创建失败由共享状态显示，保留用户的素材和要求以便重试。
  }
 }
 const upload=async(files:File[])=>{if(!access.canWrite)return;const epoch=liveProjectEpoch();try{
  if(packEntry){
   const draft=useLiveStore.getState();
   if(draft.busy)return;
   draft.addFiles(files);
   useLiveStore.setState({error:""});
   return;
  }
  if(!id){useLiveStore.getState().addFiles(files);const productId=await useLiveStore.getState().create("为这个产品做一套图包");if(isLiveProduct(id,epoch))router.push("/workspace?sku="+productId+(useLiveStore.getState().initializationReady?"&init=1":""));return;}
  const form=new FormData();files.forEach(f=>form.append("files",f));form.append("conversation","true");const response=await studioFetch<{results:{assetId?:string;error?:string}[]}>("/api/products/"+id+"/documents",{method:"POST",body:form});
  if(!isLiveProduct(id,epoch))return;await useLiveStore.getState().load(id);if(!isLiveProduct(id,epoch))return;
  for(const result of response.results)if(result.assetId)usePreviewStore.getState().addReference(result.assetId);
  if(response.results.some(r=>r.error))throw Error("部分文件上传或解析失败，请检查资料列表后重试");
 }catch(e){if(!isLiveProduct(id,epoch))return;if(packEntry)useLiveStore.setState({error:e instanceof Error?e.message:"资料添加失败"});else notify(e);}};
 async function action(request:ActionRequest){
 const s=useLiveStore.getState().snapshot,epoch=liveProjectEpoch();if(!s||s.product.id!==id||!isLiveProduct(id,epoch))return false;
 if(!access.canWrite)throw Error("当前账号为只读，不能修改或生成图片");
 try{
 const slot=s.pack.slots.find(slot=>slot.jobs.some(j=>j.assets.some(a=>a.id===request.imageId)));
 if(request.action==="final"){if(!slot)throw Error("请选择已生成的候选图");await studioFetch("/api/products/"+id+"/pack",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"final",slotId:slot.id,assetId:request.imageId})});await live.load(id);toast.success("已设为终稿");return;}
 if(request.action==="excellent"){await live.act("excellent",{assetId:request.imageId});toast.success("请核对优秀案例卡，确认后入库");return;}
 if(request.action==="download")return;
 if(request.action==="reference"){usePreviewStore.getState().addReference(request.imageId);toast.success("已加入本次对话引用");return;}
 if(request.action==="prop"){toast.info("即将开放");return;}
 if(request.imageId.startsWith("job-")){await live.act("retry",{jobId:request.imageId.slice(4),requestKey:crypto.randomUUID()});return;}
 const intent=request.instruction??imageActionIntents[request.action];
 const selection=resolveSelection(useModelStore.getState(),demoSession);await flushWorkspaceSettings(id);if(!isLiveProduct(id,epoch))return false;
 await studioFetch("/api/studio/"+id,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"settings",data:selection})});if(!isLiveProduct(id,epoch))return false;
 let maskAssetId:string|undefined;if(request.mask){const form=new FormData();form.append("mask",request.mask,"mask.png");maskAssetId=(await studioFetch<{assetId:string}>("/api/studio/"+id,{method:"POST",body:form})).assetId;}
 const instruction=intent+(request.expansion?" 扩图尺寸及原图位置："+JSON.stringify(request.expansion):"");
 const maskHash=request.mask?Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await request.mask.arrayBuffer()))).map(n=>n.toString(16).padStart(2,"0")).join(""):"";
 const signature=JSON.stringify([id,request.imageId,request.action,instruction,maskHash,request.references,request.appearanceChange]);if(!editRequestKeys.has(signature))editRequestKeys.set(signature,crypto.randomUUID());
 if(!isLiveProduct(id,epoch))return false;
 const {quote,result}=await submitEditImmediately({assetId:request.imageId,instruction,...(request.appearanceChange?{appearanceChange:request.appearanceChange}:{}),...(request.references?{references:request.references}:{}),...(maskAssetId?{maskAssetId}:{}),...(request.expansion?{expansion:request.expansion}:{})},editRequestKeys.get(signature)!,{
  quote:selection=>studioFetch("/api/studio/"+id,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"edit_quote",data:selection})}),
  submit:body=>{if(!isLiveProduct(id,epoch))throw Error("工作台已切换，本次修改未提交");return live.act("edit",body);}
 });
 if(!isLiveProduct(id,epoch))return false;
 if(result.jobId)usePreviewStore.setState({revealJob:{productId:id,jobId:result.jobId}});
 editRequestKeys.delete(signature);if(quote.warning)toast.info(quote.warning);usePreviewStore.getState().setEditor(null);toast.success("修改已提交，新候选会加入当前图位");
 }catch(e){notify(e);throw e;}
 }
 const packDraft=packEntry?{
  files:live.files,busy:live.busy,canStart:hasPackPhoto(live.files),disabled:!access.canWrite,
  error:live.error,onStart:()=>void startPack(),
  onRemove:(index:number)=>useLiveStore.setState(draft=>({files:draft.files.filter((_,i)=>i!==index),error:""})),
 }:undefined;
 return <><Workspace key={"canvas:"+id} live packDraft={packDraft} initialTool={tool&&["edit","recolor","expand","cutout"].includes(tool)?{tool,imageId}:undefined} onToolConsumed={consumeTool} onDirectGenerate={()=>setDirectOpen(true)} chat={(onCollapse,onFocusImage)=><RealChat key={id} productId={id} packEntry={packEntry} settingsError={settingsIssue.productId===id?settingsIssue.message:""} onUpload={upload} onCollapse={onCollapse} onFocusImage={onFocusImage}/>} onUpload={upload} onAction={action}/><DirectImageDialog key={"direct:"+id} open={directOpen} productId={id||undefined} onClose={()=>setDirectOpen(false)}/></>;
}
function CategorySelect({label="换一个",disabled=false}:{label?:string;disabled?:boolean}){
 const s=useLiveStore(),[open,setOpen]=useState(false),access=useStudioAccess();return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button disabled={disabled||!access.canWrite} variant="outline"><Shapes size="sm"/>{label}<ChevronDown size="sm"/></Button></PopoverTrigger><PopoverContent className="p-portal r4-category-picker"><Command><CommandInput placeholder="搜索品类…" aria-label="搜索产品品类"/><CommandList><CommandEmpty>没有找到品类</CommandEmpty><CommandGroup>{s.snapshot?.categories.map(c=><CommandItem key={c.id} value={c.name} onSelect={()=>{setOpen(false);void s.act("category",{categoryId:c.id}).catch(notify);}}>{c.name}</CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover>;
}
const setupCards:Record<string,string>={category:"确认产品品类",shooting:"选择拍摄要求",profile:"核对产品档案",pack:"确认套图方案",questions:"回答搭档的问题",mask_request:"选择要修改的区域"};
type NextStep={title:string;button?:string;action?:()=>void;status?:boolean;view?:"card"|"canvas"};
function RealChat({productId,settingsError,onUpload,onCollapse,onFocusImage,packEntry}:{productId:string;settingsError:string;onUpload:(files:File[])=>Promise<void>;onCollapse:()=>void;onFocusImage:(id:string)=>void;packEntry:boolean}){
 const router=useRouter(),live=useLiveStore(),snapshot=live.snapshot?.product.id===productId?live.snapshot:null,[chatText,setChatText]=useState(""),[stream,setStream]=useState(""),[sending,setSending]=useState(false),body=useRef<HTMLDivElement>(null);
 const text=packEntry?live.packPrompt??defaultPackPrompt:chatText;
 function setText(value:string|((previous:string)=>string)){
  if(!packEntry){setChatText(value);return;}
  useLiveStore.setState(draft=>({packPrompt:typeof value==="string"?value:value(draft.packPrompt??defaultPackPrompt)}));
 }
 const nodes=usePreviewStore(s=>s.nodes),selected=usePreviewStore(s=>s.selected),pinned=usePreviewStore(s=>s.references),[events,setEvents]=useState<AgentEvent[]>([]),requestRef=useRef<{signature:string;id:string}|null>(null);
 const [templateId,setTemplateId]=useState(()=>typeof window!=="undefined"?new URLSearchParams(window.location.search).get("template")??undefined:undefined);
 const [savedOpen,setSavedOpen]=useState(!!templateId),access=useStudioAccess(),readOnly=!access.canWrite;
 const composer=useRef<HTMLTextAreaElement>(null),chatRequest=usePreviewStore(s=>s.chatRequest);
 useEffect(()=>{if(chatRequest)composer.current?.focus();},[chatRequest]);
 const references=[...new Set([...selected,...pinned])].map(id=>nodes.find(n=>n.id===id)).filter((n):n is NonNullable<typeof n>=>!!n&&n.type==="picture"&&n.data.image.startsWith("/api/assets/"));
 const planId=snapshot?.pack.confirmedPlanId;
 const slotsForPlan=snapshot?.pack.slots.filter(slot=>!planId||slot.confirmationCardId===planId)??[];
 const currentCount=currentGenerationSlot(slotsForPlan)?.candidateCount??0;
 const batchCount=slotsForPlan.filter(s=>s.method==="ai_scene"&&s.goal.trim()).reduce((n,s)=>n+s.candidateCount,0);
 const tooManyReferences=references.length>6,canvasReady=useCanvasSession(s=>s.hydrated&&s.dataReady);
 const drop=useDropzone({noClick:true,disabled:readOnly||live.busy||sending,onDropAccepted:files=>void onUpload(files)});
 useEffect(()=>{body.current?.scrollTo({top:body.current.scrollHeight,behavior:"smooth"});},[snapshot?.agent.messages.length,snapshot?.agent.cards.length,stream]);
 async function act(action:string,data?:Record<string,unknown>){if(readOnly)return;try{await live.act(action,data);}catch(e){notify(e);}}
 async function send(){
 if(packEntry){onCollapse();return;}
 if(!text.trim()||sending||readOnly||productId&&!snapshot)return;const creationEpoch=liveProjectEpoch();if(!snapshot){try{const id=await live.create(text);if(isLiveProduct(productId,creationEpoch))router.push("/workspace?sku="+id+(useLiveStore.getState().initializationReady?"&init=1":""));}catch(e){notify(e);}return;}
 if(tooManyReferences){notify(Error("一次最多引用6张图片，请减少选择"));return;}
 const epoch=liveProjectEpoch();setSending(true);setEvents([]);let done=false;
 try{
  await useCanvasSession.getState().flush();
  await flushWorkspaceSettings(snapshot.product.id);if(!isLiveProduct(snapshot.product.id,epoch))return;
  const signature=JSON.stringify([text,selected,references.map(n=>n.id)]);
  if(requestRef.current?.signature!==signature)requestRef.current={signature,id:crypto.randomUUID()};
  const response=await fetch("/api/products/"+snapshot.product.id+"/agent",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,requestKey:requestRef.current.id,canvas:{selectedIds:selected.slice(0,20),referenceAssetIds:references.map(n=>n.id)}})});
  if(!response.ok)throw Error((await response.json()).error);setText("");
  await consumeAgentStream(response.body!,event=>{if(event.type==="delta")setStream(s=>s+(event.text??""));if(event.type==="tool")setEvents(old=>[...old.filter(e=>e.callId!==event.callId),event]);if(event.type==="error")notify(Error(event.text));if(event.type==="done"){done=true;requestRef.current=null;}});
  if(!done)notify(Error("连接已中断，已执行记录保留，请先刷新进度；重复消息不会重新收费提交"));
 }catch(e){notify(e);}finally{await live.load(snapshot.product.id).catch(notify);setSending(false);setStream("");}
 }

 const pending=snapshot?.agent.cards.filter(c=>c.status==="pending"&&c.kind!=="cost")??[],total=snapshot?(snapshot.agent.costs.llmUsd+snapshot.agent.costs.imagesUsd+snapshot.agent.costs.searchUsd):0;
 const setup=pending.find(c=>setupCards[c.kind]);
 const jobs=snapshot?.pack.slots.flatMap(slot=>slot.jobs).filter(job=>!job.retriedById)??[];
 const workingJobs=jobs.filter(job=>job.status==="pending"||job.status==="running");
 const latestOutput=jobs.filter(job=>job.status==="success"&&job.assets.length).sort((a,b)=>String(b.createdAt??"").localeCompare(String(a.createdAt??"")))[0];
 const failed=jobs.find(job=>job.status==="failed");
 const confirmed=snapshot?.agent.session.confirmedPack??false;
 const initialPackReady=confirmed&&!slotsForPlan.some(slot=>slot.method==="ai_scene"&&slot.jobs.some(job=>
  job.status==="success"&&job.assets.length&&(!planId||(job.input.visualPlan as {confirmationCardId?:string}|undefined)?.confirmationCardId===planId)));
 const generatingPack=workingJobs.some(job=>job.input.generationMode!=="direct");
 const hasProductImages=!!snapshot?.product.assets.length||!!snapshot?.agent.documents.some(doc=>doc.type==="image"&&doc.assetId);
 const busy=live.busy||sending||!!snapshot?.agent.session.running;
 const jump=(id:string)=>{
  const target=document.getElementById(id);
  target?.scrollIntoView({block:"center"});
  target?.focus({preventScroll:true});
 };
 let next:NextStep|undefined;
 if(snapshot){
  if(busy)next={title:"正在处理…",status:true};
  else if(setup)next={title:setupCards[setup.kind],button:"查看并继续",view:"card",action:()=>jump("workspace-card-"+setup.id)};
  else if(live.generationChoiceRequired)next={title:"选择本次生成范围",button:"查看选项",view:"card",action:()=>jump("workspace-generation-choice")};
  else if(initialPackReady&&batchCount>0&&!generatingPack&&!failed)next={title:snapshot.agent.session.mode==="manual"?"选择整套或单个图位":batchCount+" 张候选图待生成",button:"生成候选",action:()=>void act("generate")};
  else if(snapshot.agent.session.confirmedProfileId&&!confirmed)next={title:"按实拍和卖点安排画面",button:"规划图包",action:()=>void act("plan")};
  else if(snapshot.settings.categoryConfirmed&&!snapshot.agent.session.confirmedProfileId)next={title:"核对产品结构、材质和颜色",button:"核对产品档案",action:()=>void act("profile")};
  else if(workingJobs.length)next={title:workingJobs.length+" 张图片正在处理",status:true};
  else if(latestOutput)next={title:failed?"可查看已生成的图片":"图片已就绪",button:"去画布选图",view:"canvas",action:()=>onFocusImage(latestOutput.assets[0].id)};
  else if(failed)next={title:"有图片未生成成功",button:"查看失败任务",view:"canvas",action:()=>onFocusImage("job-"+failed.id)};
  else if(!snapshot.agent.cards.length)next=hasProductImages
   ?{title:"从产品实拍开始",button:"识别实拍与产品资料",action:()=>void act("inspect")}
   :{title:"先放入产品实拍",button:"添加产品实拍",action:drop.open};
 }
 return <aside className="p-chat l-chat">{savedOpen&&<SavedReferences initialId={templateId} onClose={()=>{setSavedOpen(false);setTemplateId(undefined);}}/>}<div className="p-chat-header"><div className="p-chat-heading"><span className="p-agent-avatar"><MessageCircle size="md"/></span><div><h2>{packEntry?"套图要求":"创作搭档"}</h2>{!packEntry&&<span className="p-chat-subtitle">讨论方向，选图后继续调整</span>}</div></div><TipButton label="收起对话" onClick={onCollapse}><PanelLeftClose size="md"/></TipButton></div>{!packEntry&&<div className="p-chat-session-cost">本次创作 <span>$ {total.toFixed(2)}{snapshot?.agent.costs.estimated?" · 估":""}</span></div>}{next&&<section className="ws-next-step" aria-label="当前步骤">
  <div className="ws-step-title" role={next.status?"status":undefined}><span>下一步</span><strong>{next.title}</strong></div>
  {next.button&&<Button size="sm" disabled={(!next.view&&readOnly)||(next.view==="canvas"&&!canvasReady)} onClick={next.action}>{next.button}</Button>}
 </section>}<div className="p-chat-body" ref={body}>
 {!snapshot&&!packEntry&&<div className="w-task-entries">{taskCatalog.filter(t=>SHOW_UNCONNECTED_FEATURES||["pack","edit"].includes(t.id)).map(t=><button key={t.id} className="w-task-entry" disabled={readOnly||!!productId||live.busy} onClick={()=>{if(["variants","translate","check"].includes(t.id)){toast.info("即将开放");return;}setText(t.id==="pack"?"为产品做一套图包":"帮我修改一张图片");drop.open();}}><IconBadge concept={t.concept}/><span><strong>{t.title}</strong><small>{["variants","translate","check"].includes(t.id)?"即将开放":t.description}</small></span></button>)}</div>}
 {snapshot?.agent.messages.filter(m=>m.role!=="tool"&&typeof (m.content as {text?:string}).text==="string").map(m=>{const text=workspaceMessageText(m.role,String((m.content as {text?:string}).text??""));if(!text||m.role==="system"&&/[{}]|美工确认|美工在看板/.test(text))return null;return <div key={m.id} className={m.role==="user"?"p-chat-bubble":"p-agent-message"}><p>{text.replace(/KIE|ZenMux/gi,"模型服务")}</p>{Array.isArray((m.content as {referenceAssetIds?:string[]}).referenceAssetIds)&&<div className="t11-message-references" aria-label="这条消息引用的图片">{((m.content as {referenceAssetIds:string[]}).referenceAssetIds).map(id=><img key={id} src={"/api/assets/"+id} alt="历史引用图片"/>)}</div>}</div>;})}

 {snapshot&&<WorkspaceProgress snapshot={snapshot} events={events}/>}
 {pending.map(card=><div key={card.id} id={"workspace-card-"+card.id} tabIndex={-1}><RealCard card={card} act={act} readOnly={readOnly}/></div>)}
 {snapshot?.settings.categoryConfirmed&&<ShootingNotice/>}


 {confirmed&&!live.generationChoiceRequired&&!generatingPack&&batchCount>0&&next?.button!=="生成候选"&&<Button size="sm" variant="outline" disabled={busy||readOnly} onClick={()=>void act("generate")}><WandSparkles size="sm"/>再生成候选 · {batchCount} 张</Button>}{live.generationChoiceRequired&&<div id="workspace-generation-choice" tabIndex={-1} className="l-shooting-card ws-generation-choices"><p>当前是逐张模式</p><div className="ws-generation-action"><Button className="ws-generate-button" disabled={live.busy||readOnly} onClick={()=>void act("generate",{scope:"batch"})}><WandSparkles size="sm"/>切回整套</Button><div className="ws-generation-meta"><span>{batchCount} 张候选</span></div></div><div className="ws-generation-action"><Button className="ws-generate-button" variant="outline" disabled={live.busy||readOnly||currentCount===0} onClick={()=>void act("generate",{scope:"current"})}>只生成当前图位</Button><div className="ws-generation-meta"><span>{currentCount} 张候选</span></div></div></div>}
 <VersionHistory/>
 {snapshot?.searches.map(s=><details key={s.id} className="p-subtle"><summary>查了 {s.resultCount} 个网页</summary>{(s.sources as {url:string;title:string}[]).map(r=><a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a>)}</details>)}
 {stream&&<div className="p-agent-message"><p>{stream}</p></div>}{(live.busy||sending)&&<div className="p-subtle" role="status">正在处理，请稍候…</div>}{live.error&&<div role="alert" className="l-shooting-card"><p>{live.error.replace(/KIE|ZenMux/gi,"模型服务")}</p><Button variant="outline" onClick={()=>{if(snapshot)void live.load(snapshot.product.id).catch(notify);}}>刷新进度</Button></div>}
 </div><div {...drop.getRootProps()} className="p-chat-input">{readOnly&&<p className="p-subtle">只读浏览 · 可以查看图片与历史记录</p>}{settingsError&&<div role="alert"><p>{settingsError}</p><Button size="sm" variant="ghost" onClick={()=>void flushWorkspaceSettings(productId).catch(notify)}>重试保存设置</Button></div>}<div className="ws-task-shortcuts"><Button size="sm" variant="ghost" disabled={live.busy||sending||readOnly} onClick={()=>{setText(t=>[t,"请把我提供的参考分别适配成本产品场景，借鉴场景、道具、摆放和氛围；产品以实拍为准。"].filter(Boolean).join("\n"));composer.current?.focus();}}>按参考图想场景</Button><Button size="sm" variant="ghost" disabled={live.busy||sending||readOnly} onClick={()=>{setText(t=>[t,"请根据本产品实拍与卖点想几个可落地的场景。分别说清空间、道具放在哪里、机位和光线。先给建议，等我选定后再生成图片。"].filter(Boolean).join("\n"));composer.current?.focus();}}>请搭档想场景</Button><Button size="sm" variant="ghost" disabled={!snapshot||!canvasReady} onClick={()=>setSavedOpen(true)}>模板库</Button></div>{references.length>0&&<div className="t11-references" aria-label="本次引用图片"><span>本次引用 {references.length} 张</span>{references.map(n=><button key={n.id} type="button" className="t11-reference" aria-label={"取消引用 "+n.data.label} title={(selected.includes(n.id)?"当前选中，随本次消息发送":"已固定引用，取消后不再发送")+" · "+n.data.slot+" · "+n.data.label} onClick={()=>{const store=usePreviewStore.getState();usePreviewStore.setState({references:store.references.filter(id=>id!==n.id)});store.select(store.selected.filter(id=>id!==n.id));}}><img src={n.data.image} alt={n.data.label}/><span>{selected.includes(n.id)?"选中 · ":"引用 · "}{n.data.label}</span><span aria-hidden="true">×</span></button>)}</div>}{tooManyReferences&&<p role="alert">一次最多引用6张图片，请减少选择。</p>}<input {...drop.getInputProps()} aria-label="工作台上传实拍"/><Textarea disabled={readOnly} ref={composer} className="shadow-none focus-visible:ring-0 focus-visible:outline-none border-0" rows={3} aria-label="工作台创作要求" placeholder={references.length?"说明这些图片各自的用途，或说清改哪里、保留什么…":"描述想要的场景，或选中图片后说说怎么改…"} value={text} onChange={e=>setText(e.target.value)}/><ComposerToolbar scope={demoSession} count={1} onAdd={drop.open} onSend={()=>void send()} sendLabel={packEntry?"去画布":undefined} disabled={readOnly||!!productId&&!snapshot||(!packEntry&&!text.trim())||live.busy||sending||tooManyReferences||!!snapshot?.agent.session.running||!!snapshot&&!canvasReady} showPrices={false} readOnly={readOnly} settingsDisabled={live.busy||sending}/></div></aside>;
}
type Card=NonNullable<ReturnType<typeof useLiveStore.getState>["snapshot"]>["agent"]["cards"][number];
function RealCard({card,act,readOnly}:{card:Card;readOnly:boolean;act:(action:string,data?:Record<string,unknown>)=>Promise<void>}){
 const live=useLiveStore(),s=live.snapshot!,d=card.data as Record<string,unknown>,busy=live.busy||readOnly;
 if(card.kind==="category")return <div className="r4-category-confirm l-shooting-card"><span className="l-card-eyebrow"><IconBadge concept="product"/>确认产品</span><h3>{d.name?"看起来是"+String(d.name)+"，对吗？":"还没看出产品品类，可以确认一下吗？"}</h3><div>{!!d.categoryId&&<Button disabled={busy} onClick={()=>void act("category",{categoryId:d.categoryId})}>是</Button>}<CategorySelect disabled={busy}/></div></div>;
 if(card.kind==="shooting")return <div className="r4-shooting-choice l-shooting-card"><h3>这个品类默认采用严格拍摄标准。</h3><p>按清单核对资料，还是这次先快速开始？</p><Button disabled={busy} onClick={()=>void act("shooting",{mode:"strict"})}>按严格来</Button><Button variant="outline" disabled={busy} onClick={()=>void act("shooting",{mode:"quick"})}>这次先快速</Button></div>;
 if(card.kind==="profile")return <ProfileForm busy={busy} profile={d.profile as Profile} onSave={profile=>act("approve",{cardId:card.id,changes:{profile}})}/>;
 if(card.kind==="pack"&&d.visualPlan)return <VisualPlanCard cardId={card.id} initial={d.visualPlan as VisualPlan} availableImages={conversationImages(s.settings)} busy={busy} act={act}/>;
 if(card.kind==="pack")return <div className="l-shooting-card"><h3>图包方案</h3><p>{String(d.reason??"")}</p>{(d.slots as {name:string;candidateCount:number}[]).map((slot,i)=><p key={i}>{i+1}. {slot.name} · {slot.candidateCount} 张候选</p>)}<Button disabled={busy} onClick={()=>void act("approve",{cardId:card.id})}>确认图包方案</Button></div>;
 if(card.kind==="cost")return null;
 if(card.kind==="questions")return <QuestionsCard questions={d.questions as UserQuestion[]} busy={busy} onSubmit={answers=>void act("approve",{cardId:card.id,changes:{answers}})}/>;
 if(card.kind==="library_case")return <div className="l-shooting-card"><h3>确认沉淀优秀案例</h3><p>{String(d.note)}</p><pre className="whitespace-pre-wrap text-xs">{JSON.stringify(d.entries,null,2)}</pre><Button disabled={busy} onClick={()=>void act("approve",{cardId:card.id})}>确认入库</Button></div>;
 if(card.kind==="mask_request")return <div className="l-shooting-card"><h3>请在画布选择修改区域</h3><p>{String(d.instruction)}</p><Button disabled={busy} onClick={()=>{usePreviewStore.getState().select([String(d.assetId)]);usePreviewStore.getState().setEditor({id:String(d.assetId),action:"paint",instruction:String(d.instruction),references:d.references as SlotReference[]|undefined});}}>框选或涂抹</Button></div>;
 if(card.kind==="final")return <div className="l-shooting-card"><h3>设为这个图位的终稿？</h3><Button disabled={busy} onClick={()=>void act("approve",{cardId:card.id})}><Check size="sm"/>确认终稿</Button></div>;
 return <div className="p-subtle">待确认：{s.product.name}</div>;
}
function ShootingNotice(){
 const access=useStudioAccess(),live=useLiveStore(),s=live.snapshot!,category=s.categories.find(c=>c.id===s.settings.categoryId),angles=Object.values(s.settings.photoAngles??{}),missing=category?.strictChecklist.filter(r=>r.required&&!angles.includes(r.angle))??[];
 if(s.product.assets.length===1)return <p className="p-subtle">只有1张实拍，产品还原度可能不稳定</p>;
 if(s.settings.shootingMode!=="strict")return <p className="p-subtle">{category?.quickHint}</p>;
 return <div className="l-shooting-card"><h3>拍摄资料 {category?category.strictChecklist.filter(r=>r.required).length-missing.length:0}/{category?.strictChecklist.filter(r=>r.required).length??0}</h3><p>{missing.length?"缺："+missing.map(r=>shotLabels[r.angle]).join("、"):"所需角度已齐全"}</p>{missing.length>0&&!s.settings.strictSkipped&&<Button variant="outline" disabled={!access.canWrite||live.busy} onClick={()=>void live.act("shooting",{mode:"strict",skip:true}).catch(notify)}>先跳过</Button>}</div>;
}
export function RealProductCard({open,onOpenChange}:{open:boolean;onOpenChange:(v:boolean)=>void}){
 const access=useStudioAccess(),live=useLiveStore(),s=live.snapshot;
 return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="p-portal p-product-sheet"><SheetHeader className="p-product-header"><SheetTitle>{s?.product.name??"产品卡 · 未建档"}</SheetTitle><SheetDescription>{s?"实拍和已确认特征会用于每次生成与修改":"上传产品实拍后开始建档"}</SheetDescription>{s&&<div className="t10-product-heading"><Button variant="outline" asChild><Link href={"/products/"+s.product.id}>产品资料</Link></Button><CategorySelect label={s.product.category}/><span>{s.settings.shootingMode==="strict"?"严格":"快速"}</span>{s.settings.shootingMode!=="strict"&&<Button variant="ghost" disabled={!access.canWrite||live.busy} onClick={()=>void live.act("shooting",{mode:"strict"}).catch(notify)}>升级为严格</Button>}</div>}</SheetHeader><div className="p-product-content">{s&&<><p>理解度 {s.agent.understanding.percent}% · {s.product.assets.length} 张实拍</p><div className="p-assets-grid">{s.product.assets.map(p=><img key={p.id} src={"/api/assets/"+p.id} alt={"产品实拍 · "+(shotLabels[s.settings.photoAngles?.[p.id] as ShotAngle]??"角度待确认")}/>)}</div><ShootingNotice/><ProfileForm busy={live.busy||!access.canWrite} key={s.agent.session.draftRevision} profile={s.agent.profile} onSave={async profile=>{await live.act("profile");const card=useLiveStore.getState().snapshot?.agent.cards.find(c=>c.kind==="profile"&&c.status==="pending");if(card)await live.act("approve",{cardId:card.id,changes:{profile}});}}/></>}</div></SheetContent></Sheet>;
}
export function RealExport({open,onOpenChange}:{open:boolean;onOpenChange:(v:boolean)=>void}){
 const s=useLiveStore(state=>state.snapshot),[resolution,setResolution]=useState<"2K"|"4K">("2K"),[busy,setBusy]=useState(false),[partial,setPartial]=useState(false),missing=s?.pack.slots.filter(slot=>!slot.finalAssetId)??[];
 async function download(){if(!s)return;setBusy(true);try{const r=await fetch("/api/products/"+s.product.id+"/pack/export?partial="+(partial?"1":"0")+"&resolution="+resolution);if(!r.ok)throw Error((await r.json()).error);const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=s.product.sku+"_finals.zip";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);onOpenChange(false);}catch(e){notify(e);}finally{setBusy(false);}}
 return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="p-portal"><SheetHeader><SheetTitle>导出图包</SheetTitle><SheetDescription>按图位命名，将已挑选的终稿打包为 ZIP。</SheetDescription></SheetHeader><div className="p-product-content"><p>{s?.product.sku??"尚未创建SKU"} · {s?.pack.slots.filter(slot=>slot.finalAssetId).length??0} 张终稿</p><div className="t10-product-heading">{(["2K","4K"] as const).map(r=><Button key={r} variant={resolution===r?"default":"outline"} onClick={()=>setResolution(r)}>{r}</Button>)}</div><p className="p-subtle">导出按长边等比缩放；4K不会增加原图的真实细节。</p>{missing.length>0&&<label><Switch checked={partial} onCheckedChange={setPartial}/>仅导出已有终稿（还有 {missing.length} 个图位未完成）</label>}<Button disabled={busy||!s?.pack.slots.some(slot=>slot.finalAssetId)||missing.length>0&&!partial} onClick={()=>void download()}>{busy?"正在打包…":"下载 ZIP"}</Button>{SHOW_UNCONNECTED_FEATURES&&<p className="p-subtle">导出前检查 · 即将开放</p>}</div></SheetContent></Sheet>;
}
export function RealSkuGallery(){
 const [rows,setRows]=useState<GalleryProduct[]>([]),[error,setError]=useState("");
 useEffect(()=>{studioFetch<typeof rows>("/api/studio").then(setRows).catch(e=>setError(e.message));},[]);
 return <main className="p-gallery"><div className="p-gallery-header"><h1>全部 SKU</h1><Button asChild><Link href="/">新建创作</Link></Button></div>{error&&<p role="alert">{error}</p>}<div className="p-sku-grid">{rows.map(s=><article className="p-sku-card" key={s.id}><GalleryCover product={s}/><div className="p-sku-card-heading"><strong>{s.name}</strong>{s.canDelete&&<SkuDeleteButton product={s} onDeleted={()=>setRows(current=>current.filter(row=>row.id!==s.id))} onRestored={async()=>{setRows(await studioFetch<GalleryProduct[]>("/api/studio"));}}/>}</div><p>{s.sku} · {s.category}</p></article>)}</div></main>;
}
type GalleryProduct={id:string;name:string;sku:string;category:string;canDelete?:boolean;assets:{id:string}[];imagePacks?:{slots:{slotType?:string;finalAssetId:string|null}[]}[]};
function GalleryCover({product}:{product:GalleryProduct}){
 const [white,setWhite]=useState(false),slots=product.imagePacks?.[0]?.slots??[];
 // 优先使用美工已选的主图，不从细节拼贴猜测或裁剪产品；没有已选主图时使用排序后的首张实拍。
 const main=slots.find(s=>s.slotType==="main"),id=main?.finalAssetId??product.assets[0]?.id;
 return <Link className={"p-sku-cover"+(white?" is-white":"")} href={"/workspace?sku="+product.id}>{id?<img src={"/api/assets/"+id} alt={product.name} onLoad={e=>{try{const canvas=document.createElement("canvas");canvas.width=canvas.height=16;const ctx=canvas.getContext("2d")!;ctx.drawImage(e.currentTarget,0,0,16,16);const p=ctx.getImageData(0,0,16,16).data;let light=0,total=0;for(let y=0;y<16;y++)for(let x=0;x<16;x++){if(!((x<2||x>=14)&&(y<2||y>=14)))continue;const i=(y*16+x)*4;total++;if(p[i+3]<20||p[i]>240&&p[i+1]>240&&p[i+2]>240)light++;}setWhite(light/total>.9);}catch{setWhite(false);}}}/>:<Upload size="md"/>}</Link>;
}
