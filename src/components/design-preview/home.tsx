/* eslint-disable @next/next/no-img-element -- 本地原型图片。 */
"use client";
import {SHOW_UNCONNECTED_FEATURES} from "@/lib/ui-features";
import {useEffect,useRef,useState} from "react";
import {useStudioAccess} from "./studio-access";
import {defaultPackPrompt,useLiveStore} from "./live-store";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {useDropzone} from "react-dropzone";
import {motion} from "motion/react";
import {ArrowRight,ChevronLeft,ChevronRight,FileText,X} from "@/components/icons/concept-icons";
import {toast} from "sonner";
import {Button} from "./ui/button";
import {Textarea} from "./ui/textarea";
import {ComposerToolbar} from "./model-picker";
import {HomeTools} from "./home-tools";

import {demoSession,useModelStore} from "./model-store";
import {usePreviewStore} from "./store";
import {useLibraryStore,readMockFiles} from "./library/library-store";
import {LibraryDetail} from "./library/browser";
import type {SceneTemplate} from "@/design-preview/library/types";
import {canView} from "@/design-preview/library/rules";
import {designer} from "@/design-preview/mock/library";
const placeholder="把新品实拍拖进来，帮我做一套亚马逊图";
export function Home(){
 const live=useLiveStore(),router=useRouter(),state=useLibraryStore(),rail=useRef<HTMLDivElement>(null),mounted=useRef(false),access=useStudioAccess();
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const [text,setText]=useState(""),[detail,setDetail]=useState<SceneTemplate|null>(null);
 useEffect(()=>{useLibraryStore.setState({draftPhotos:[],draftDocuments:[]});useLiveStore.setState({files:[],packPrompt:null});},[]);
 const hasContent=!!text.trim()||state.draftPhotos.length>0||state.draftDocuments.length>0;
 const drop=useDropzone({noClick:true,noKeyboard:true,disabled:!access.canWrite||live.busy,onDropAccepted:async files=>{try{live.addFiles(files);const incoming=await readMockFiles(files);state.ingest(incoming.photos,incoming.documents);toast.success("资料已添加");}catch(e){toast.error(e instanceof Error?e.message:"资料添加失败");}}});
 async function start(){if(!hasContent||live.busy||!access.canWrite)return;try{const id=await live.create(text);if(!mounted.current)return;useLibraryStore.setState({draftPhotos:[],draftDocuments:[]});usePreviewStore.getState().clearTask();useModelStore.getState().startSession(demoSession,true);router.push("/workspace?sku="+id+(useLiveStore.getState().initializationReady?"&init=1":""));}catch(e){toast.error(e instanceof Error?e.message:"创建任务失败");}}
 function openPack(){
  useLiveStore.setState({packPrompt:text.trim()?text:defaultPackPrompt});
  router.push("/workspace?tool=pack");
 }
 const entries=state.data.scenes.filter(s=>canView(s,designer)).slice(0,8);
 const libraryLinks=[{label:"场景",tab:"scene",count:state.data.scenes.filter(e=>canView(e,designer)).length},{label:"道具",tab:"prop",count:state.data.props.filter(e=>canView(e,designer)).length},{label:"道具组",tab:"set",count:state.data.propSets.filter(e=>canView(e,designer)).length},{label:"参考图",tab:"reference",count:state.data.references.filter(e=>canView(e,designer)).length}];
 return <main className="p-home l-home"><section className="p-home-hero"><div className="home-ambient" aria-hidden="true"/><div className="p-home-heading"><h1>亲爱的朋友，开始创作吧！</h1></div>
 <motion.div className="p-home-composer-wrap" initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{duration:.16}}><div {...drop.getRootProps()} className={`p-home-input ${drop.isDragActive?"p-drop-active":""}`}><input {...drop.getInputProps()} aria-label="首页上传实拍"/><div className="r4-input-body">{(state.draftPhotos.length>0||state.draftDocuments.length>0)&&<div className="r4-attachments" aria-label="首页附件">{state.draftPhotos.map(p=><div className="r4-attachment" key={p.id} title={p.name}><img src={p.image} alt={p.name}/><Button variant="ghost" size="icon" aria-label={"删除附件 "+p.name} onClick={e=>{e.stopPropagation();state.removeDraftPhoto(p.id);live.removeFile(p.name,state.draftPhotos.slice(0,state.draftPhotos.findIndex(photo=>photo.id===p.id)).filter(photo=>photo.name===p.name).length);}}><X size="sm"/></Button></div>)}{state.draftDocuments.map((name,i)=><div className="r4-attachment r4-file" key={name+i} title={name}><FileText size="md"/><span>{name.split(".").at(-1)?.slice(0,5).toUpperCase()}</span><Button variant="ghost" size="icon" aria-label={"删除附件 "+name} onClick={e=>{e.stopPropagation();state.removeDraftDocument(i);live.removeFile(name,state.draftDocuments.slice(0,i).filter(file=>file===name).length);}}><X size="sm"/></Button></div>)}</div>}<div className="p-home-textarea"><Textarea disabled={!access.canWrite||live.busy} className="shadow-none focus-visible:ring-0 focus-visible:outline-none border-0" rows={3} aria-label="首页创作要求" placeholder={placeholder} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Tab"&&!e.shiftKey&&!text){e.preventDefault();setText(placeholder);}if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();start();}}}/></div></div><ComposerToolbar scope="home" onAdd={drop.open} onSend={start} showCost={hasContent} readOnly={!access.canWrite} settingsDisabled={live.busy} disabled={!hasContent||live.busy||!access.canWrite}/></div></motion.div>{access.ready&&!access.canWrite&&<p className="p-home-access-note">只读模式</p>}</section>
 <HomeTools disabled={!access.canWrite||live.busy} onPack={openPack}/>{SHOW_UNCONNECTED_FEATURES&&<nav className="r1-library-links" aria-label="你的库"><span>你的库：</span>{libraryLinks.map((entry,i)=><span key={entry.tab}><Link href={"/library?tab="+entry.tab}>{entry.label} {entry.count}</Link>{i<libraryLinks.length-1&&<i>·</i>}</span>)}<ArrowRight size="sm"/></nav>}
 {SHOW_UNCONNECTED_FEATURES&&<section className="l-home-scenes"><div className="l-section-heading"><div><span className="p-section-kicker">A GOOD PLACE TO BEGIN</span><h2>场景模板</h2></div><div><Button variant="outline" size="icon" aria-label="上一个场景" onClick={()=>rail.current?.scrollBy({left:-390,behavior:"smooth"})}><ChevronLeft size="md"/></Button><Button variant="outline" size="icon" aria-label="下一个场景" onClick={()=>rail.current?.scrollBy({left:390,behavior:"smooth"})}><ChevronRight size="md"/></Button></div></div><div className="l-scene-rail" ref={rail}>{entries.map(s=><motion.button whileHover={{y:-2}} transition={{duration:.2,ease:"easeOut"}} className="l-scene-feature" key={s.id} onClick={()=>setDetail(s)}><img src={s.coverImage} alt={s.name}/><div><h3>{s.name}</h3><p>{s.tags.slice(0,3).join(" · ")}<ArrowRight size="sm"/></p></div></motion.button>)}</div></section>}<div className="l-home-last"><Link href="/skus">继续上次的创作 <ArrowRight size="sm"/></Link></div>{SHOW_UNCONNECTED_FEATURES&&<LibraryDetail entry={detail} onClose={()=>setDetail(null)}/>}</main>;
}
