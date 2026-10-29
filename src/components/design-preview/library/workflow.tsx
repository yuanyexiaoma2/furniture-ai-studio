/* eslint-disable @next/next/no-img-element -- 本地原型附件与候选。 */
"use client";
import {useEffect,useRef,useState} from "react";
import {useDropzone} from "react-dropzone";
import Link from "next/link";
import {Sparkles,PanelLeftClose,ArrowRight,Check,X,Camera,Upload} from "@/components/icons/concept-icons";
import {toast} from "sonner";
import {Button} from "../ui/button";
import {Textarea} from "../ui/textarea";
import {Input} from "../ui/input";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "../ui/dialog";
import {ComposerToolbar} from "../model-picker";
import {demoSession,estimateCost,resolveSelection,useModelStore} from "../model-store";
import {usePreviewStore} from "../store";
import {models} from "@/design-preview/mock/models";
import {canView} from "@/design-preview/library/rules";
import {designer} from "@/design-preview/mock/library";
import type {Suggestion} from "@/design-preview/library/types";
import {readMockFiles,useLibraryStore} from "./library-store";
import {CategoryConfirmation} from "./category-confirmation";
import {IconBadge} from "@/components/icons/icon-badge";
import {BrandSummary} from "../batch/brand";
import {launchWorkflow,workflowIntent} from "../batch/workflow";
import {StrictNotice} from "./shooting";
export function LibraryChat({onCollapse,onFocus}:{onCollapse:()=>void;onFocus:(id:string)=>void}){
 const state=useLibraryStore(),task=state.task!,modelState=useModelStore();
 const [text,setText]=useState(""),[busy,setBusy]=useState(false),[count,setCount]=useState(4),[ratio,setRatio]=useState("1:1"),[feeOpen,setFeeOpen]=useState(false);
 const body=useRef<HTMLDivElement>(null),selected=usePreviewStore(s=>s.contextId);
 const ready=task.categoryConfirmed!==false&&!task.shootingChoicePending;
 const cost=estimateCost(modelState,demoSession,count);
 useEffect(()=>{useModelStore.getState().startSession(demoSession);},[]);
 useEffect(()=>{body.current?.scrollTo({top:body.current.scrollHeight,behavior:"smooth"});},[task.messages.length,task.suggestions.length,busy]);
 const drop=useDropzone({noClick:true,onDropAccepted:async files=>{const incoming=await readMockFiles(files);state.ingest(incoming.photos,incoming.documents,true);toast.success("资料已补充，产品卡角度清单已更新");}});
 function plan(){try{state.preparePlan(count,cost);}catch(error){toast.error(error instanceof Error?error.message:"请先补充一张实拍");}}
 async function generate(confirmed=false){
  const current=useLibraryStore.getState();if(!current.task)return;
  // 模型切换后以当前报价重排配方，并在付费动作前展示本次费用。
  try{current.preparePlan(count,cost);}catch(error){toast.error(String(error));return;}
  if(cost>.20&&!confirmed){setFeeOpen(true);return;}
  setFeeOpen(false);setBusy(true);usePreviewStore.getState().update("frame-0",{loading:true});
  await new Promise(resolve=>setTimeout(resolve,1100));
  const images=usePreviewStore.getState().addBatch([25,5,7,28].slice(0,count).map(n=>"r3-"+String(n).padStart(2,"0")));
  const selection=resolveSelection(useModelStore.getState(),demoSession),model=models.find(m=>m.id===(selection.auto?selection.imageIds[0]:selection.imageId))!;
  useLibraryStore.getState().finishGeneration(images.map(i=>({...i,image:"/design-preview/"+i.image+".webp"})),model.name);
  usePreviewStore.getState().update("frame-0",{loading:false});setBusy(false);
 }
 function send(){if(!text.trim())return;const instruction=text.trim();state.appendMessage(instruction);setText("");const intent=workflowIntent(instruction);if(intent){launchWorkflow(intent,instruction);return;}if(ready&&/改|消除|换色|重绘|不对/.test(instruction)&&selected){usePreviewStore.getState().setEditor({id:selected,action:/消除/.test(instruction)?"erase":"paint"});onFocus(selected);toast.info("请涂出需要调整的区域，原始实拍将一并保留");}else if(ready&&task.product.photos.length&&(task.stage==="ready"||/生成|再来|场景|一套图|规划/.test(instruction)))plan();}
 const scene=state.data.scenes.find(s=>s.id===task.templateId),groups=state.data.propSets.filter(g=>scene?.defaultPropSetIds.includes(g.id));
 return <aside className="p-chat l-chat"><div className="p-chat-header"><h2><span className="p-agent-avatar"><Sparkles size="sm"/></span>创作搭档</h2><Button variant="ghost" size="icon" aria-label="收起对话" onClick={onCollapse}><PanelLeftClose size="md"/></Button></div><div className="p-chat-body" ref={body}><p className="p-chat-date">今天 · {task.product.name}</p>{task.messages.map(m=><div key={m.id} className={m.role==="user"?"p-chat-bubble":"p-agent-message"}>{m.role==="assistant"&&<span><span className="p-agent-avatar"><Sparkles size="sm"/></span>创作搭档</span>}<p>{m.text}</p></div>)}
 <BrandSummary/><div className="w-chat-quick-actions"><Button variant="ghost" onClick={()=>launchWorkflow("variants")}>批量换色</Button><Button variant="ghost" onClick={()=>launchWorkflow("translate")}>多语言版本</Button><Button variant="ghost" onClick={()=>launchWorkflow("check")}>导出前检查</Button></div><CategoryConfirmation/>
 <StrictNotice onUpload={drop.open}/>
 {ready&&!task.product.photos.length&&<div className="l-shooting-card"><span className="concept-icon-box"><Camera size="md"/></span><h3>先放一张产品实拍</h3><p>一张也能开始，后续随时补充。</p><Button variant="outline" onClick={drop.open}><Upload size="sm"/>添加资料</Button></div>}
 {ready&&task.stage==="ready"&&task.product.photos.length>0&&<div className="l-plan-card"><span className="l-card-eyebrow">为这件产品，选一个好场景</span><h3>{scene?.name??"选择场景"}</h3><p>保留颜色、结构与尺寸，用现有实拍直接规划。</p><div className="l-scene-choices">{state.data.scenes.filter(s=>s.categoryIds.includes(task.product.categoryId)&&canView(s,designer)).slice(0,3).map(s=><button key={s.id} className={s.id===task.templateId?"active":""} onClick={()=>state.setTemplate(s.id)}><img src={s.coverImage} alt=""/><span>{s.name.split("·").slice(0,2).join("·")}</span>{s.id===task.templateId&&<Check size="sm"/>}</button>)}</div><Button onClick={plan}>规划图包<ArrowRight size="sm"/></Button></div>}
 {task.stage==="planned"&&<div className="l-plan-card"><span className="l-card-eyebrow"><span className="concept-icon-box"><Check size="md"/></span>图包方案</span><h3>{scene?.name}</h3><p>{groups.map(g=>g.name).join("、")} · 每张选 {state.planned[0]?.propIds.length??0} 件道具</p><div className="l-plan-variants">{state.planned.map((p,i)=><div key={i}><span>0{i+1}</span><p>{scene?.variables.map(v=>v.options.find(o=>o.value===p.variables[v.key])?.label).join(" · ")}</p></div>)}</div><p className="p-subtle">已避开本 SKU 与同品类近 30 天用过的组合。</p><div className="l-plan-fee"><span>预计 ${cost.toFixed(2)} · {count} 张</span><Button disabled={busy} onClick={()=>void generate()}>{busy?"正在创作…":"生成候选"}</Button></div></div>}
 {busy&&<div className="l-generation-grid" aria-label="正在生成"><div/><div/><div/><div/></div>}
 {task.stage==="generated"&&<button className="l-chat-candidate" onClick={()=>{const recipe=state.data.recipes.find(r=>r.id===task.recipeIds.at(-Math.min(count,task.recipeIds.length)));if(recipe)onFocus(recipe.imageId);}}><img src={state.data.recipes.find(r=>r.id===task.recipeIds.at(-1))?.image} alt="本批候选"/><div><strong>看看这次的候选</strong><span>点击定位，再挑出终稿 <ArrowRight size="sm"/></span></div></button>}{task.stage==="generated"&&<Button className="l-replan-button" variant="outline" onClick={plan}>再规划一组<ArrowRight size="sm"/></Button>}
 {task.suggestions.filter(s=>s.status!=="dismissed").map(s=><CaptureCard key={s.id} suggestion={s}/>)}
 {(modelState.events[demoSession]??[]).map((event,i)=><p className="p-system-message" key={i}>{event}</p>)}
 </div><div {...drop.getRootProps()} className={`p-console ${drop.isDragActive?"p-drop-active":""}`}><input {...drop.getInputProps()} aria-label="对话上传资料"/><div className="l-console-meta"><span>{task.categoryConfirmed===false?"待确认品类":state.data.categories.find(c=>c.id===task.product.categoryId)?.name}</span><span>{task.product.photos.length} 张原始实拍</span></div><div className="p-console-input"><Textarea className="shadow-none focus-visible:ring-0 focus-visible:outline-none border-0" rows={3} aria-label="创作控制台" placeholder={selected?"选中了图片，说说想改哪里…":"说说你的想法，或把资料拖进来…"} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send();}}}/><ComposerToolbar scope={demoSession} count={count} ratio={ratio} onCount={setCount} onRatio={setRatio} onAdd={drop.open} onSend={send} showCost={!!text.trim()} disabled={!text.trim()||busy}/></div></div>
 <Dialog open={feeOpen} onOpenChange={setFeeOpen}><DialogContent className="p-portal"><DialogHeader><DialogTitle>确认这次创作费用</DialogTitle><DialogDescription>本次预计 ${cost.toFixed(2)}，超过单次 ${(.20).toFixed(2)} 的确认额度。</DialogDescription></DialogHeader><p>这是本地费用演示，不会产生扣费。</p><Button onClick={()=>void generate(true)}>确认费用并生成</Button></DialogContent></Dialog></aside>;
}
function CaptureCard({suggestion:s}:{suggestion:Suggestion}){
 const state=useLibraryStore(),[name,setName]=useState(s.name);
 const labels={scene:"这张效果不错，存成场景模板？",reference:"把这个画面留作参考？",prop:"把框选的物体存为道具？",snippet:"这段描述又用到了，存成关键词片段？"};
 const entry=s.entryId?[...state.data.scenes,...state.data.props,...state.data.references,...state.data.snippets].find(e=>e.id===s.entryId):null;
 return <div className="l-capture-card" data-capture-kind={s.kind}><div className="l-capture-heading"><IconBadge concept={s.kind}/><strong>{s.status==="saved"?"已存到我的收藏":labels[s.kind]}</strong>{s.status!=="saved"&&<Button variant="ghost" size="icon" aria-label="关闭沉淀建议" onClick={()=>state.suppress(s.id)}><X size="sm"/></Button>}</div>{s.status==="saved"?<><p>{s.name} · {entry?.visibility==="pending"?"待审核":"仅自己可见"}</p><div><Button variant="ghost" asChild><Link href={"/library?tab="+(s.kind==="scene"?"scene":s.kind==="prop"?"prop":s.kind==="snippet"?"snippet":"reference")}>去库里看看<ArrowRight size="sm"/></Link></Button>{entry?.visibility==="private"&&<Button variant="outline" onClick={()=>state.recommend(s.entryId!)}>推荐到公共库</Button>}</div></>:<><div className="l-capture-preview">{s.image&&<img src={s.image} alt="待保存的画面"/>}<div><Input aria-label="收藏名称" value={name} onChange={e=>setName(e.target.value)}/><p>{s.tags.join(" · ")}</p></div></div>{s.text&&<p>{s.text}</p>}<div><Button variant="ghost" onClick={()=>state.suppress(s.id,true)}>不再提示这类</Button><Button disabled={!name.trim()} onClick={()=>{state.saveSuggestion(s.id,name);toast.success("已保存，默认仅自己可见");}}>存</Button></div></>}</div>;
}
