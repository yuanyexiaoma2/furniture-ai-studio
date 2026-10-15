/* eslint-disable @next/next/no-img-element -- 使用预生成缩略图及本地 Blob，避免图片接口请求。 */
"use client";
import {useState,useEffect,useSyncExternalStore} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {useTheme} from "next-themes";
import {ArrowLeft,Download,Layers3,Monitor,Moon,Plus,Settings2,Sun,UserRound} from "@/components/icons/concept-icons";
import {motion} from "motion/react";
import {Button} from "./ui/button";
import {Input} from "./ui/input";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "./ui/select";
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator,DropdownMenuTrigger,DropdownMenuRadioGroup,DropdownMenuRadioItem} from "./ui/dropdown-menu";
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from "./ui/dialog";
import {Tooltip,TooltipContent,TooltipTrigger} from "./ui/tooltip";
import {usePreviewStore,imagePath} from "./store";
import {Workspace} from "./canvas";
import {ProductCard} from "./product-card";
import {Home} from "./home";
import {Admin} from "./admin";
import {LibraryBrowser} from "./library/browser";
import {IconGuide} from "./icon-guide";
import {BrandPicker} from "./batch/brand";
import {ExportCheckDialog} from "./batch/workflow";
import {useLibraryStore} from "./library/library-store";
export type PreviewPage="home"|"skus"|"workspace"|"product"|"admin"|"library"|"icons";
const emptySubscribe=()=>()=>{};
export function TipButton({label,children,onClick,className=""}:{label:string;children:React.ReactNode;onClick?:()=>void;className?:string}) {
 return <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className={`p-icon-button ${className}`} aria-label={label} onClick={onClick}>{children}</Button></TooltipTrigger><TooltipContent className="p-portal">{label}</TooltipContent></Tooltip>;
}
export function Pick({label,value,values,onChange}:{label:string;value:string;values:string[];onChange:(v:string)=>void}){return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent className="p-portal">{values.map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>;}
export function PreviewApp({page}:{page:PreviewPage}) {
 const router=useRouter();const {theme,setTheme}=useTheme();const syncTheme=usePreviewStore(s=>s.setTheme);
 const mounted=useSyncExternalStore(emptySubscribe,()=>true,()=>false);
 const [assetsOpen,setAssetsOpen]=useState(false),[productOpen,setProductOpen]=useState(page==="product"),[settings,setSettings]=useState(false),[exportOpen,setExportOpen]=useState(false);
 const task=useLibraryStore(s=>s.task);
 const understanding=task&&task.categoryConfirmed!==false&&task.product.photos.length?Math.round(task.product.features.filter(f=>f.locked).length/Math.max(1,task.product.features.length)*100):0;
 const workspace=page==="workspace"||page==="product";
 const requestedExport=mounted&&new URLSearchParams(window.location.search).get("export")==="1";
 useEffect(()=>{syncTheme(theme??"system");},[theme,syncTheme]);
 return <div className="p-app"><header className="p-topbar">
   {workspace?<TipButton label="返回 SKU" onClick={()=>router.push('/design-preview/skus')}><ArrowLeft size={18}/></TipButton>:<Link className="p-logo" href="/design-preview"><Layers3 strokeWidth={1.7}/><span>家具创作室</span></Link>}
   {!workspace&&<nav className="p-product-nav" aria-label="产品导航"><Link className={page==="home"?"active":""} href="/design-preview">首页</Link><Link className={page==="skus"?"active":""} href="/design-preview/skus">SKU</Link><Link className={page==="library"?"active":""} href="/design-preview/library">模板库</Link></nav>}
   {workspace&&<><div className="p-topbar-title"><img src={task?.product.photos[0]?.image??imagePath('sofa')} alt="SKU 缩略图"/><strong>{task?.product.name??"云屿 · 三人布艺沙发"}</strong></div><BrandPicker/><Button variant="outline" className="p-top-product-button" onClick={()=>setProductOpen(true)} aria-label={understanding?"产品卡，理解度 "+understanding+"%":"产品卡 · 未建档"}>{understanding>0&&<span className="p-mini-ring" style={{background:"conic-gradient(var(--p-selection) "+understanding+"%,var(--border) 0)"}} aria-hidden="true"/>}<span>{understanding?"产品卡":"产品卡 · 未建档"}</span></Button></>}
   <div className="p-topbar-end"><div className="w-theme-segments" role="group" aria-label="主题切换">{[{value:"system",label:"跟随系统",Icon:Monitor},{value:"light",label:"亮色",Icon:Sun},{value:"dark",label:"暗色",Icon:Moon}].map(t=><button key={t.value} aria-label={t.label+"主题"} title={t.label} aria-pressed={mounted&&theme===t.value} onClick={()=>setTheme(t.value)}><t.Icon size={16}/></button>)}</div>
   <TipButton label="设置" onClick={()=>setSettings(true)}><Settings2 size={18}/></TipButton>
   {workspace&&<Button onClick={()=>setExportOpen(true)}><Download size={16}/>导出图包</Button>}
   <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="p-icon-button" aria-label="头像菜单"><span className="p-avatar">悦</span></Button></DropdownMenuTrigger><DropdownMenuContent className="p-portal" align="end"><DropdownMenuLabel>林悦 · 设计预览</DropdownMenuLabel><DropdownMenuSeparator/><DropdownMenuRadioGroup value={theme} onValueChange={setTheme}><DropdownMenuRadioItem value="light"><Sun size={16} className="mr-2"/>亮色</DropdownMenuRadioItem><DropdownMenuRadioItem value="dark"><Moon size={16} className="mr-2"/>暗色</DropdownMenuRadioItem><DropdownMenuRadioItem value="system"><Monitor size={16} className="mr-2"/>跟随系统</DropdownMenuRadioItem></DropdownMenuRadioGroup><DropdownMenuSeparator/><DropdownMenuItem onClick={()=>router.push('/design-preview/admin')}><UserRound size={16} className="mr-2"/>管理后台</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
 </header>
 {page==="icons"&&<IconGuide/>}{page==="library"&&<LibraryBrowser/>}{page==="home"&&<Home/>}{page==="skus"&&<SkuGallery/>}{workspace&&<Workspace/>}{page==="admin"&&<Admin/>}
 <Dialog open={assetsOpen} onOpenChange={setAssetsOpen}><DialogContent className="p-portal p-template-dialog"><DialogHeader><DialogTitle>素材库</DialogTitle><DialogDescription>收集灵感，让下一次创作更轻松。</DialogDescription></DialogHeader><div className="p-assets-grid">{["sofa","living","chair","room","interior","dining"].map(n=><img key={n} src={imagePath(n)} alt="家具灵感素材"/>)}</div></DialogContent></Dialog>
 <ProductCard open={productOpen} onOpenChange={setProductOpen}/>
 <Dialog open={settings} onOpenChange={setSettings}><DialogContent className="p-portal"><DialogHeader><DialogTitle>设置</DialogTitle><DialogDescription>按你的创作习惯调整工作空间。</DialogDescription></DialogHeader><div className="p-settings"><strong>外观</strong><div>{[{value:"light",label:"亮色",Icon:Sun},{value:"dark",label:"暗色",Icon:Moon},{value:"system",label:"跟随系统",Icon:Monitor}].map(t=><Button key={t.value} variant={theme===t.value?"default":"outline"} onClick={()=>setTheme(t.value)}><t.Icon size={16}/>{t.label}</Button>)}</div><small>主题会保存在这台设备。当前原型中的图片、费用与成员均为样例。</small></div></DialogContent></Dialog>
 <ExportCheckDialog open={exportOpen||requestedExport} onOpenChange={v=>{setExportOpen(v);if(!v&&requestedExport)router.replace("/design-preview/workspace");}}/>
 </div>;
}
export const source=(image:string)=>image.startsWith('/')||image.startsWith('blob:')||image.startsWith('data:')?image:imagePath(image);
export function downloadImages(images:{src:string;name:string}[]){images.forEach(({src,name})=>{const a=document.createElement('a');a.href=src;a.download=`${name}.webp`;a.click();});}
const skuData=[{sku:"SF-2401",name:"云屿 · 三人布艺沙发",image:"sofa",progress:"5/7 图位",time:"12 分钟前",notice:"等你回答",state:"进行中"},{sku:"LV-2406",name:"栖木 · 客厅组合",image:"living",progress:"3/7 图位",time:"38 分钟前",notice:"待挑选 3 张",state:"进行中"},{sku:"CH-2403",name:"弧线 · 休闲单椅",image:"chair",progress:"7/7 图位",time:"今天 10:24",notice:"",state:"已完成"},{sku:"RM-2408",name:"暖境 · 空间系列",image:"room",progress:"2/7 图位",time:"今天 09:42",notice:"待挑选 2 张",state:"进行中"},{sku:"IN-2412",name:"留白 · 软装组合",image:"interior",progress:"7/7 图位",time:"昨天 17:30",notice:"",state:"已完成"},{sku:"DN-2402",name:"共席 · 餐厅组合",image:"dining",progress:"4/7 图位",time:"昨天 15:16",notice:"",state:"进行中"}];
function SkuGallery(){const [filter,setFilter]=useState('全部'),[query,setQuery]=useState(''),[sort,setSort]=useState('最近更新');const visible=skuData.filter(s=>`${s.name}${s.sku}`.toLowerCase().includes(query.toLowerCase())&&(filter==='全部'||filter==='需要我处理'&&!!s.notice||s.state===filter));if(sort==='名称排序')visible.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));return <main className="p-gallery"><div className="p-gallery-header"><h1>全部 SKU</h1><Button asChild><Link href="/design-preview"><Plus size={16}/>新建创作</Link></Button></div><div className="p-gallery-toolbar"><div className="p-filter-group">{['全部','进行中','已完成','需要我处理'].map(v=><Button key={v} variant="ghost" className={filter===v?'active':''} onClick={()=>setFilter(v)}>{v}</Button>)}</div><div className="p-gallery-tools"><Input aria-label="搜索 SKU" placeholder="搜索产品名称或 SKU" value={query} onChange={e=>setQuery(e.target.value)}/><Pick label="SKU 排序" value={sort} values={['最近更新','名称排序']} onChange={setSort}/></div></div><div className="p-sku-grid">{visible.map(s=><motion.article whileHover={{y:-2}} transition={{duration:.2,ease:"easeOut"}} className="p-sku-card" key={s.name}><Link href="/design-preview/workspace" className="p-sku-cover"><img src={imagePath(s.image)} alt={s.name} loading="lazy"/>{s.notice?<span className="p-corner-label"><i className="p-dot p-dot-warning"/>{s.notice}</span>:<span className="p-corner-label"><i className={`p-dot ${s.state==='已完成'?'p-dot-success':''}`}/>{s.state==='已完成'?'终稿已选好':'创作中'}</span>}</Link><strong>{s.name}</strong><p>{s.progress} · {s.time}</p></motion.article>)}</div>{!visible.length&&<p className="p-muted">没有找到这个产品，试试其他名称。</p>}</main>;}
