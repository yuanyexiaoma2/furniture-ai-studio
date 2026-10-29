/* eslint-disable @next/next/no-img-element -- 本地原型图片。 */
"use client";
import {SHOW_UNCONNECTED_FEATURES} from "@/lib/ui-features";
import {useEffect,useRef,useState} from "react";
import {useLiveStore} from "./live-store";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {useDropzone} from "react-dropzone";
import {motion} from "motion/react";
import {ArrowRight,ChevronLeft,ChevronRight,ImagePlus,FileText,X} from "@/components/icons/concept-icons";
import {toast} from "sonner";
import {Button} from "./ui/button";
import {Textarea} from "./ui/textarea";
import {ComposerToolbar} from "./model-picker";
import {taskCatalog} from "@/design-preview/mock/tasks";
import {IconBadge} from "@/components/icons/icon-badge";
import {TaskCover} from "./task-cover";

import {demoSession,useModelStore} from "./model-store";
import {usePreviewStore} from "./store";
import {useLibraryStore,readMockFiles} from "./library/library-store";
import {LibraryDetail} from "./library/browser";
import type {SceneTemplate} from "@/design-preview/library/types";
import {canView} from "@/design-preview/library/rules";
import {designer} from "@/design-preview/mock/library";
const placeholder="把新品实拍拖进来，帮我做一套亚马逊图";
export function Home(){
 const live=useLiveStore(),router=useRouter(),state=useLibraryStore(),rail=useRef<HTMLDivElement>(null);
 const [text,setText]=useState(""),[detail,setDetail]=useState<SceneTemplate|null>(null);
 useEffect(()=>{useLibraryStore.setState({draftPhotos:[],draftDocuments:[]});useLiveStore.setState({files:[]});},[]);
 const hasContent=!!text.trim()||state.draftPhotos.length>0||state.draftDocuments.length>0;
 const drop=useDropzone({noClick:true,onDropAccepted:async files=>{try{live.addFiles(files);const incoming=await readMockFiles(files);state.ingest(incoming.photos,incoming.documents);toast.success("资料已添加");}catch(e){toast.error(e instanceof Error?e.message:"资料添加失败");}}});
 async function start(){if(!hasContent||live.busy)return;try{const id=await live.create(text);useLibraryStore.setState({draftPhotos:[],draftDocuments:[]});usePreviewStore.getState().clearTask();useModelStore.getState().startSession(demoSession,true);router.push("/workspace?sku="+id+"&init=1");}catch(e){toast.error(e instanceof Error?e.message:"创建任务失败");}}
 const entries=state.data.scenes.filter(s=>canView(s,designer)).slice(0,8);
 const tasks=taskCatalog.filter(t=>(SHOW_UNCONNECTED_FEATURES?["pack","variants","edit"]:["pack","edit"]).includes(t.id));
 const libraryLinks=[{label:"场景",tab:"scene",count:state.data.scenes.filter(e=>canView(e,designer)).length},{label:"道具",tab:"prop",count:state.data.props.filter(e=>canView(e,designer)).length},{label:"道具组",tab:"set",count:state.data.propSets.filter(e=>canView(e,designer)).length},{label:"参考图",tab:"reference",count:state.data.references.filter(e=>canView(e,designer)).length}];
 return <main className="p-home l-home"><section className="p-home-hero"><div className="p-home-heading"><span className="p-eyebrow"><span/>家具商品图</span><h1>制作产品图片</h1><p>上传产品实拍，选择任务开始制作。</p></div>
 <motion.div className="p-home-composer-wrap" initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{duration:.16}}><div {...drop.getRootProps()} className={`p-home-input ${drop.isDragActive?"p-drop-active":""}`}><input {...drop.getInputProps()} aria-label="首页上传实拍"/><div className="r4-input-body">{(state.draftPhotos.length>0||state.draftDocuments.length>0)&&<div className="r4-attachments" aria-label="首页附件">{state.draftPhotos.map(p=><div className="r4-attachment" key={p.id} title={p.name}><img src={p.image} alt={p.name}/><Button variant="ghost" size="icon" aria-label={"删除附件 "+p.name} onClick={e=>{e.stopPropagation();state.removeDraftPhoto(p.id);live.removeFile(p.name,state.draftPhotos.slice(0,state.draftPhotos.findIndex(photo=>photo.id===p.id)).filter(photo=>photo.name===p.name).length);}}><X size="sm"/></Button></div>)}{state.draftDocuments.map((name,i)=><div className="r4-attachment r4-file" key={name+i} title={name}><FileText size="md"/><span>{name.split(".").at(-1)?.slice(0,5).toUpperCase()}</span><Button variant="ghost" size="icon" aria-label={"删除附件 "+name} onClick={e=>{e.stopPropagation();state.removeDraftDocument(i);live.removeFile(name,state.draftDocuments.slice(0,i).filter(file=>file===name).length);}}><X size="sm"/></Button></div>)}</div>}<div className="p-home-textarea"><Textarea rows={3} aria-label="首页创作要求" placeholder={placeholder} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Tab"&&!e.shiftKey&&!text){e.preventDefault();setText(placeholder);}if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();start();}}}/></div></div><ComposerToolbar scope="home" onAdd={drop.open} onSend={start} showCost={hasContent} disabled={!hasContent||live.busy}/></div></motion.div><p className="p-home-footnote"><ImagePlus size="sm"/>拖入实拍或资料，随时补充</p></section>
 <section className="r1-home-tasks"><h2>选择任务</h2><div className="r1-task-grid">{tasks.map(task=><button className="r1-task-card" key={task.id} onClick={()=>{useModelStore.getState().startSession(demoSession,true);if(task.id==="variants"){toast.info("批量换色 · 即将开放");return;}router.push("/workspace?task="+task.id);}} aria-label={task.title}><TaskCover kind={task.id as "pack"|"variants"|"edit"}/><IconBadge concept={task.concept}/><div className="r1-task-caption"><h3>{task.title}</h3><p>{task.description}</p></div><span className="r1-task-start">开始<ArrowRight size="sm"/></span></button>)}</div>{SHOW_UNCONNECTED_FEATURES&&<nav className="r1-library-links" aria-label="你的库"><span>你的库：</span>{libraryLinks.map((entry,i)=><span key={entry.tab}><Link href={"/library?tab="+entry.tab}>{entry.label} {entry.count}</Link>{i<libraryLinks.length-1&&<i>·</i>}</span>)}<ArrowRight size="sm"/></nav>}</section>
 {SHOW_UNCONNECTED_FEATURES&&<section className="l-home-scenes"><div className="l-section-heading"><div><span className="p-section-kicker">A GOOD PLACE TO BEGIN</span><h2>场景模板</h2></div><div><Button variant="outline" size="icon" aria-label="上一个场景" onClick={()=>rail.current?.scrollBy({left:-390,behavior:"smooth"})}><ChevronLeft size="md"/></Button><Button variant="outline" size="icon" aria-label="下一个场景" onClick={()=>rail.current?.scrollBy({left:390,behavior:"smooth"})}><ChevronRight size="md"/></Button></div></div><div className="l-scene-rail" ref={rail}>{entries.map(s=><motion.button whileHover={{y:-2}} transition={{duration:.2,ease:"easeOut"}} className="l-scene-feature" key={s.id} onClick={()=>setDetail(s)}><img src={s.coverImage} alt={s.name}/><div><h3>{s.name}</h3><p>{s.tags.slice(0,3).join(" · ")}<ArrowRight size="sm"/></p></div></motion.button>)}</div></section>}<div className="l-home-last"><p>已保存的产品与图包</p><Link href="/skus">继续上次的创作 <ArrowRight size="sm"/></Link></div>{SHOW_UNCONNECTED_FEATURES&&<LibraryDetail entry={detail} onClose={()=>setDetail(null)}/>}</main>;
}
