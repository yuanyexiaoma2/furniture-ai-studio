/* eslint-disable @next/next/no-img-element -- 本地原型图片。 */
"use client";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {useDropzone} from "react-dropzone";
import {motion} from "motion/react";
import {ArrowRight,ChevronLeft,ChevronRight,ImagePlus,Layers3,Brush,Library,Shapes,ContactRound,Download} from "lucide-react";
import {toast} from "sonner";
import {Button} from "./ui/button";
import {Textarea} from "./ui/textarea";
import {ComposerToolbar} from "./model-picker";
import {demoSession,useModelStore} from "./model-store";
import {imagePath,usePreviewStore} from "./store";
import {DraftTaskControls} from "./library/shooting";
import {useLibraryStore,readMockFiles} from "./library/library-store";
import {LibraryDetail} from "./library/browser";
import type {SceneTemplate} from "@/design-preview/library/types";
import {canView} from "@/design-preview/library/rules";
import {designer} from "@/design-preview/mock/library";
const prompts=["把新品实拍拖进来，帮我做一套亚马逊图","给这款边桌做一组温暖自然的卧室场景","保留产品外观，换一个自然简约的背景"];
const intents=["亚马逊套图","A+ 详情","场景图","白底图","尺寸图"];
export function Home(){
 const router=useRouter(),state=useLibraryStore(),rail=useRef<HTMLDivElement>(null);
 const [text,setText]=useState(""),[typed,setTyped]=useState(""),[detail,setDetail]=useState<SceneTemplate|null>(null);
 useEffect(()=>{let cursor=0,index=0,hold=0;const timer=setInterval(()=>{if(hold){hold--;return;}cursor++;setTyped(prompts[index].slice(0,cursor));if(cursor>prompts[index].length){hold=30;cursor=0;index=(index+1)%prompts.length;}},80);return()=>clearInterval(timer);},[]);
 const drop=useDropzone({noClick:true,onDropAccepted:async files=>{const incoming=await readMockFiles(files);state.ingest(incoming.photos,incoming.documents);toast.success("资料已收好，角度标签为本地演示，可在产品卡修改");}});
 function start(){if(!text.trim()&&!state.draftPhotos.length)return;state.startTask();if(text.trim())useLibraryStore.getState().appendMessage(text);usePreviewStore.getState().clearTask();useModelStore.getState().startSession(demoSession,true);router.push("/design-preview/workspace");}
 const entries=state.data.scenes.filter(s=>canView(s,designer)).slice(0,8);
 function demo(path:string){if(!state.task){state.startDemo();usePreviewStore.getState().clearTask();}router.push(path);}
 const features=[{title:"做一套图包",desc:"从实拍到完整表达",Icon:Layers3,go:()=>document.querySelector<HTMLTextAreaElement>('[aria-label="首页创作要求"]')?.focus()},{title:"改一张图",desc:"把细节交回你的手里",Icon:Brush,go:()=>demo("/design-preview/workspace")},{title:"场景库",desc:"让产品走进好空间",Icon:Library,go:()=>router.push("/design-preview/library?tab=scene")},{title:"道具库",desc:"恰到好处的小点缀",Icon:Shapes,go:()=>router.push("/design-preview/library?tab=prop")},{title:"产品卡",desc:"记住每一个产品细节",Icon:ContactRound,go:()=>demo("/design-preview/product")},{title:"导出",desc:"把挑好的作品带走",Icon:Download,go:()=>{router.push("/design-preview/workspace?export=1");}}];
 return <main className="p-home l-home"><section className="p-home-hero"><div className="p-home-heading"><span className="p-eyebrow"><span/>为好产品，创造好画面</span><h1>下一件作品，从这里开始。</h1><p>带上实拍和一个想法，让创作搭档陪你把它变成一整套好图。</p></div><div className="p-intent-row">{intents.map(i=><Button key={i} variant="ghost" onClick={()=>setText("为这个产品制作"+i)}>{i}</Button>)}</div>
 <motion.div className="p-home-composer-wrap" initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{duration:.16}}><div {...drop.getRootProps()} className={`p-home-input ${drop.isDragActive?"p-drop-active":""}`}><input {...drop.getInputProps()} aria-label="首页上传实拍"/><DraftTaskControls/>{state.draftPhotos.length>0&&<div className="p-attachment-row">{state.draftPhotos.map(p=><img key={p.id} src={p.image} alt={p.name}/>)}</div>}{state.draftDocuments.length>0&&<p className="p-subtle">{state.draftDocuments.join(" · ")}</p>}<div className="p-home-textarea"><Textarea rows={3} aria-label="首页创作要求" placeholder={typed||"说说你想做的画面…"} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Tab"&&!text){e.preventDefault();setText(prompts[0]);}if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();start();}}}/>{!text&&<kbd className="p-tab-hint">Tab</kbd>}</div><ComposerToolbar scope="home" onAdd={drop.open} onSend={start} disabled={!text.trim()&&!state.draftPhotos.length}/></div></motion.div><p className="p-home-footnote"><ImagePlus size={14}/>拖入产品实拍或文档，先用手边的资料开始<span>随时补充，不打断创作</span></p></section>
 <section className="l-bento-section"><div className="l-section-heading"><div><span className="p-section-kicker">MAKE ROOM FOR YOUR IDEAS</span><h2>一个想法，有很多种开始。</h2></div></div><div className="l-bento"><motion.button whileHover={{y:-2}} transition={{duration:.2}} className="l-bento-story" onClick={features[0].go}><div className="l-collage">{[25,5,7,28].map((n,i)=><img className={"l-collage-"+i} key={n} src={imagePath("r3-"+String(n).padStart(2,"0"))} alt={["产品主图","生活场景","材质细节","尺寸展示"][i]}/>)}</div><div><span>ONE PRODUCT. A WHOLE STORY.</span><h2>从一件产品，到一整套好图。</h2><p>实拍、场景、细节，连成同一个故事。</p></div><span className="l-bento-arrow"><ArrowRight size={20}/></span></motion.button><div className="l-bento-actions">{features.map(f=><motion.button whileHover={{y:-2}} transition={{duration:.2,ease:"easeOut"}} key={f.title} aria-label={f.title} onClick={f.go}><f.Icon size={24} strokeWidth={1.5}/><div><strong>{f.title}</strong><p>{f.desc}</p></div><ArrowRight size={15}/></motion.button>)}</div></div></section>
 <section className="l-home-scenes"><div className="l-section-heading"><div><span className="p-section-kicker">A GOOD PLACE TO BEGIN</span><h2>下一幅画面，已经有了灵感。</h2></div><div><Button variant="outline" size="icon" aria-label="上一个场景" onClick={()=>rail.current?.scrollBy({left:-390,behavior:"smooth"})}><ChevronLeft size={18}/></Button><Button variant="outline" size="icon" aria-label="下一个场景" onClick={()=>rail.current?.scrollBy({left:390,behavior:"smooth"})}><ChevronRight size={18}/></Button></div></div><div className="l-scene-rail" ref={rail}>{entries.map(s=><motion.button whileHover={{y:-2}} transition={{duration:.2,ease:"easeOut"}} className="l-scene-feature" key={s.id} onClick={()=>setDetail(s)}><img src={s.coverImage} alt={s.name}/><div><h3>{s.name}</h3><p>{s.tags.slice(0,3).join(" · ")}<ArrowRight size={16}/></p></div></motion.button>)}</div></section><div className="l-home-last"><p>每一次好选择，都成为下一次的起点。</p><Link href="/design-preview/skus">继续上次的创作 <ArrowRight size={15}/></Link></div><LibraryDetail entry={detail} onClose={()=>setDetail(null)}/></main>;
}
