/* eslint-disable @next/next/no-img-element -- 本地静态预览图片。 */
"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {useDropzone} from "react-dropzone";
import {motion} from "motion/react";
import {ArrowRight,ChevronLeft,ChevronRight,ImagePlus} from "lucide-react";
import {toast} from "sonner";
import {Button} from "./ui/button";
import {Textarea} from "./ui/textarea";
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from "./ui/dialog";
import {ComposerToolbar} from "./model-picker";
import {demoSession,useModelStore} from "./model-store";
import {imagePath,usePreviewStore} from "./store";
const prompts=["把新品实拍拖进来，帮我做一套亚马逊图","让这款沙发出现在温暖的午后客厅","保留产品外观，换一个自然简约的背景"];
const intents=[{name:"亚马逊套图",prompt:"为这款家具规划一套完整的亚马逊商品图"},{name:"A+ 详情",prompt:"用材质细节和生活场景制作一套 A+ 详情"},{name:"场景图",prompt:"保留产品外观，放进自然温暖的客厅场景"},{name:"白底图",prompt:"制作纯白背景主图，清晰展示产品的结构与材质"},{name:"尺寸图",prompt:"做一张简洁清晰的尺寸说明图，预留尺寸标注"}];
const templates=[{name:"亚马逊主图套图",desc:"从第一眼心动，到每一个产品细节",image:"sofa",meta:"7 个图位 · 商品上新"},{name:"A+ 生活提案",desc:"用材质、空间和故事，慢慢展开",image:"interior",meta:"品牌表达 · 详情页"},{name:"自然光里的客厅",desc:"让好家具，走进真实的生活",image:"living",meta:"场景氛围 · 生活方式"},{name:"把细节说清楚",desc:"尺寸、结构与质感，一目了然",image:"dining",meta:"产品细节 · 卖点图"}];
export function Home(){
 const router=useRouter();const [text,setText]=useState(""),[typed,setTyped]=useState(""),[promptIndex,setPromptIndex]=useState(0),[attachments,setAttachments]=useState<string[]>([]),[template,setTemplate]=useState<number|null>(null),[slide,setSlide]=useState(0);
 useEffect(()=>{let index=0,cursor=0,pause=0,deleting=false;const timer=setInterval(()=>{if(pause>0){pause--;return;}const phrase=prompts[index];cursor+=deleting?-1:1;setTyped(phrase.slice(0,Math.max(0,cursor)));if(cursor===phrase.length){pause=30;deleting=true;}if(cursor===0&&deleting){deleting=false;index=(index+1)%prompts.length;setPromptIndex(index);pause=5;}},65);return()=>clearInterval(timer);},[]);
 const drop=useDropzone({accept:{"image/*":[".jpg",".jpeg",".png",".webp"]},noClick:true,onDropAccepted:files=>{const urls=files.map(f=>URL.createObjectURL(f));setAttachments(v=>[...v,...urls]);urls.forEach(u=>usePreviewStore.getState().addImage(u));toast.success("实拍已放入创作区");}});
 function start(){if(!text.trim()&&!attachments.length)return;useModelStore.getState().startSession(demoSession,true);usePreviewStore.getState().send(text||"根据实拍规划商品图");router.push("/design-preview/workspace");}
 return <main className="p-home">
 <section className="p-home-hero"><div className="p-home-heading"><span className="p-eyebrow"><span/>为好产品，创造好画面</span><h1>下一件作品，从这里开始。</h1><p>带上实拍和一个想法，让创作搭档陪你把它变成一整套好图。</p></div>
 <div className="p-intent-row" aria-label="创作意图">{intents.map(i=><Button variant="ghost" key={i.name} onClick={()=>setText(i.prompt)}>{i.name}</Button>)}</div>
 <motion.div className="p-home-composer-wrap" initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{duration:.16}}><div {...drop.getRootProps()} className={`p-home-input ${drop.isDragActive?"p-drop-active":""}`}><input {...drop.getInputProps()} aria-label="首页上传实拍"/>{attachments.length>0&&<div className="p-attachment-row">{attachments.map(u=><img src={u} alt="已附上的实拍" key={u}/>)}</div>}
 <div className="p-home-textarea"><Textarea rows={3} aria-label="首页创作要求" placeholder={typed||"说说你想做的画面…"} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Tab"&&!text){e.preventDefault();setText(prompts[promptIndex]);}if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();start();}}}/>{!text&&<kbd className="p-tab-hint">Tab</kbd>}</div>
 <ComposerToolbar scope="home" onAdd={drop.open} onSend={start} disabled={!text.trim()&&!attachments.length}/>
 </div></motion.div><p className="p-home-footnote"><ImagePlus size={14}/>拖入产品实拍，或先说说你的想法<span>支持 JPG、PNG、WebP</span></p></section>
 <section className="p-home-collections"><div className="p-template-heading"><div><span className="p-section-kicker">CURATED FOR YOUR NEXT PROJECT</span><h2>从一个灵感开始</h2></div><span className="p-subtle">选一个方向，把它变成你的作品</span></div><div className="p-template-grid">{templates.map((t,i)=><motion.button whileHover={{y:-2,boxShadow:"0 14px 32px var(--p-shadow)"}} transition={{duration:.2,ease:"easeOut"}} className="p-template-card" key={t.name} onClick={()=>{setTemplate(i);setSlide(0);}}><div className="p-template-image"><motion.img whileHover={{scale:1.04}} transition={{duration:.2,ease:"easeOut"}} src={imagePath(t.image)} alt={t.name} loading="lazy"/><span className="p-template-cta">用这个模板 <ArrowRight size={16}/></span></div><div className="p-template-caption"><span>{t.meta}</span><strong>{t.name}</strong><p>{t.desc}</p></div></motion.button>)}</div></section>
 <section><div className="p-recent-heading"><h2>继续你的创作</h2><Button variant="ghost" asChild><Link href="/design-preview/skus">全部 SKU<ArrowRight size={16}/></Link></Button></div><div className="p-recent-row">{[{name:"云屿 · 三人布艺沙发",image:"sofa",progress:"5 / 7 图位",time:"12 分钟前"},{name:"栖木 · 客厅组合",image:"living",progress:"3 / 7 图位",time:"38 分钟前"},{name:"弧线 · 休闲单椅",image:"chair",progress:"已完成",time:"今天 10:24"},{name:"暖境 · 空间系列",image:"room",progress:"2 / 7 图位",time:"今天 09:42"}].map(s=><Link key={s.name} href="/design-preview/workspace" className="p-recent-item"><img src={imagePath(s.image)} alt={s.name}/><div><strong>{s.name}</strong><span>{s.progress} · {s.time}</span></div><ArrowRight size={15}/></Link>)}</div></section>
 <Dialog open={template!==null} onOpenChange={v=>!v&&setTemplate(null)}><DialogContent className="p-portal p-template-dialog"><DialogHeader><DialogTitle>{templates[template??0].name}</DialogTitle><DialogDescription>先看图包的整体画面，再把你的产品放进来。</DialogDescription></DialogHeader><img src={imagePath([templates[template??0].image,"room","interior"][slide])} alt={`模板效果 ${slide+1}`}/><div className="p-template-dialog-footer"><div><Button variant="ghost" size="icon" aria-label="上一张模板效果" onClick={()=>setSlide(v=>(v+2)%3)}><ChevronLeft size={18}/></Button><span>{slide+1} / 3</span><Button variant="ghost" size="icon" aria-label="下一张模板效果" onClick={()=>setSlide(v=>(v+1)%3)}><ChevronRight size={18}/></Button></div><Button onClick={()=>{setText(intents[template??0]?.prompt??intents[0].prompt);setTemplate(null);}}>用这个模板<ArrowRight size={16}/></Button></div></DialogContent></Dialog>
 </main>;
}
