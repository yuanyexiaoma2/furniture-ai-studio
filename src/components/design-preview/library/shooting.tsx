/* eslint-disable @next/next/no-img-element -- 静态样图和本地上传预览。 */
"use client";
import {useEffect,useState} from "react";
import {useDropzone} from "react-dropzone";
import {Camera,Check,ChevronDown,ImagePlus,LockKeyhole,Upload,X} from "@/components/icons/concept-icons";
import {toast} from "sonner";
import {Button} from "../ui/button";
import {Popover,PopoverContent,PopoverTrigger} from "../ui/popover";
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from "../ui/sheet";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "../ui/select";
import {Input} from "../ui/input";
import {Switch} from "../ui/switch";
import {shotLabels,type ShootingMode} from "@/design-preview/library/types";
import {coverage} from "@/design-preview/library/rules";
import {ProductVariants} from "../batch/brand";
import {CategoryPicker} from "./category-confirmation";
import {readMockFiles,useLibraryStore} from "./library-store";
export function ShootingModePicker({active=false}:{active?:boolean}){
 const [open,setOpen]=useState(false);const state=useLibraryStore(),mode=active?state.task?.product.shootingMode??state.draftMode:state.draftMode;
 return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="ghost" className="l-shooting-pill" aria-label="拍摄标准"><Camera size={16}/>拍摄标准：{mode==="quick"?"快速":"严格"}<ChevronDown size={16}/></Button></PopoverTrigger><PopoverContent className="p-portal l-mode-panel" side="top" align="start"><h3>选择拍摄标准</h3>{([{id:"quick",name:"快速",desc:"先用现有实拍开始，随时补充。"}, {id:"strict",name:"严格",desc:"对照品类清单，缺少的可以先跳过。"}] as const).map(m=><Button key={m.id} variant="ghost" aria-pressed={mode===m.id} onClick={()=>{state.setMode(m.id,active);setOpen(false);}}><span><strong>{m.name}</strong><small>{m.desc}</small></span>{mode===m.id&&<Check size={16}/>}</Button>)}</PopoverContent></Popover>;
}
export function StrictNotice({onUpload}:{onUpload:()=>void}){
 const state=useLibraryStore(),task=state.task;if(!task||task.categoryConfirmed===false||task.shootingChoicePending)return null;
 const category=state.data.categories.find(c=>c.id===task.product.categoryId)!,c=coverage(task.product,category);
 if(task.product.photos.length===1&&!task.singlePhotoAcknowledged)return <div className="l-single-notice"><p>只有 1 张实拍，产品还原度可能不稳定</p><Button size="icon" variant="ghost" aria-label="知道了" onClick={state.acknowledgeSingle}><X size={16}/></Button></div>;
 if(task.product.shootingMode!=="strict"||task.strictSkipped||task.shootingPrompted||!c.missing.length)return null;
 return <div className="l-shooting-card"><span className="l-card-eyebrow"><span className="concept-icon-box"><Camera size={20}/></span>拍摄资料</span><strong>已有 {c.present}/{c.total}，还缺{c.missing.map(r=>shotLabels[r.angle]).join("、")}。</strong><p>要补充这些实拍，还是先用现有资料继续？</p><div><Button variant="outline" onClick={onUpload}><Upload size={16}/>补充实拍</Button><Button variant="ghost" onClick={state.skipStrict}>先跳过</Button></div></div>;
}
export function TaskProductCard({open,onOpenChange}:{open:boolean;onOpenChange:(v:boolean)=>void}){
 const state=useLibraryStore(),task=state.task!,category=state.data.categories.find(c=>c.id===task.product.categoryId)!,c=coverage(task.product,category);
 const [quickVisible,setQuickVisible]=useState(!task.quickHintSeen),[editing,setEditing]=useState<string|null>(null),[value,setValue]=useState("");
 const drop=useDropzone({noClick:true,accept:{"image/*":[".jpg",".jpeg",".png",".webp"]},onDropAccepted:async files=>{const result=await readMockFiles(files);state.ingest(result.photos,result.documents,true);toast.success("实拍已补充，拍摄清单已更新");}});
 const seenQuick=useLibraryStore(s=>s.seenQuick);
 useEffect(()=>{if(open&&quickVisible&&task.product.shootingMode==="quick"&&task.product.photos.length>1)seenQuick();},[open,quickVisible,task.product.shootingMode,task.product.photos.length,seenQuick]);
 function close(v:boolean){if(!v&&quickVisible&&task.product.shootingMode==="quick"){state.seenQuick();setQuickVisible(false);}onOpenChange(v);}
 return <Sheet open={open} onOpenChange={close}><SheetContent className="p-portal l-product-card"><SheetHeader><SheetTitle>{task.product.name} · 产品卡</SheetTitle><SheetDescription>{task.product.sku}</SheetDescription><div className="r4-product-header-controls"><CategoryPicker header label={task.categoryConfirmed===false?"品类待确认":"品类："+category.name}/><ShootingModePicker active/></div><div className="l-product-mode">{task.product.shootingMode==="quick"&&<Button variant="ghost" onClick={()=>state.setMode("strict",true)}>升级为严格</Button>}</div></SheetHeader>
 <div className="l-product-scroll"><div className="l-coverage-line">{task.product.shootingMode==="strict"?<><strong>已有 {c.present}/{c.total}</strong><span>{c.missing.length?"缺："+c.missing.map(r=>shotLabels[r.angle]).join("、"):"拍摄清单已齐全"}</span></>:<strong>已收好 {task.product.photos.length} 张实拍</strong>}</div>
 {task.product.photos.length===1?<p className="l-quick-hint">只有 1 张实拍，产品还原度可能不稳定</p>:task.product.shootingMode==="quick"&&quickVisible&&<p className="l-quick-hint">{category.quickHint}</p>}
 <div {...drop.getRootProps()} className={`l-photo-collection ${drop.isDragActive?"active":""}`}><input {...drop.getInputProps()} aria-label="产品卡补充实拍"/><div className="l-photo-grid">{task.product.photos.map(p=><div key={p.id}><img src={p.image} alt={p.name}/><Select value={p.angle} onValueChange={v=>state.setAngle(p.id,v as keyof typeof shotLabels)}><SelectTrigger aria-label={p.name+"角度"}><SelectValue/></SelectTrigger><SelectContent className="p-portal">{Object.entries(shotLabels).map(([key,label])=><SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>)}</div><Button variant="outline" onClick={drop.open}><ImagePlus size={16}/>补充实拍</Button><span className="p-subtle">角度为原型演示标签，可手动调整</span></div>
 {task.product.shootingMode==="strict"&&<section className="l-checklist"><h3>品类拍摄清单</h3>{category.strictChecklist.map(r=><div key={r.angle}><span className={task.product.photos.some(p=>p.angle===r.angle)?"complete":""}>{task.product.photos.some(p=>p.angle===r.angle)?<Check size={16}/>:<Camera size={16}/>}</span><div><strong>{shotLabels[r.angle]}{!r.required&&" · 可选"}</strong><p>{r.hint}</p></div></div>)}</section>}
 <ProductVariants/><section className="l-locked-features"><h3>产品特征</h3>{task.product.features.map(f=><div key={f.key}><div><strong>{f.key}</strong><label><LockKeyhole size={16}/>锁定<Switch aria-label={"锁定"+f.key} checked={f.locked} onCheckedChange={v=>state.updateFeature(f.key,f.value,v)}/></label></div>{editing===f.key?<div className="l-inline-edit"><Input value={value} aria-label={"修改"+f.key} onChange={e=>setValue(e.target.value)}/><Button variant="outline" onClick={()=>{state.updateFeature(f.key,value,f.locked);setEditing(null);}}>保存</Button></div>:<p>{f.value}<Button variant="ghost" onClick={()=>{setEditing(f.key);setValue(f.value);}}>修改</Button></p>}</div>)}</section></div><footer className="l-product-foot">修图时始终保留原始实拍参考与已锁定特征。</footer></SheetContent></Sheet>;
}
export function modeLabel(mode:ShootingMode){return mode==="quick"?"快速":"严格";}
