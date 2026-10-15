/* eslint-disable @next/next/no-img-element -- 本地审核样图。 */
"use client";
import {useState} from "react";
import {Check,ChevronRight,Settings2,X} from "@/components/icons/concept-icons";
import {toast} from "sonner";
import type {Category} from "@/design-preview/library/types";
import {shotLabels} from "@/design-preview/library/types";
import {administrator,librarian} from "@/design-preview/mock/library";
import {Button} from "../ui/button";
import {Input} from "../ui/input";
import {Textarea} from "../ui/textarea";
import {Switch} from "../ui/switch";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "../ui/select";
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from "../ui/sheet";
import {useLibraryStore,libraryEntries} from "./library-store";
import {entryImage,LibraryDetail} from "./browser";
import type {LibraryEntry} from "@/design-preview/library/types";
export function CategorySettings(){
 const state=useLibraryStore(),[editing,setEditing]=useState<Category|null>(null);
 return <section className="l-admin-section"><p className="p-subtle">按品类设置新任务的默认标准。美工仍可在任务中调整；缺少实拍允许跳过。</p><div className="l-category-table"><div className="l-category-table-head"><span>品类</span><span>默认拍摄标准</span><span>快速档提示语</span><span>严格档清单</span></div>{state.data.categories.map(c=><div className="l-category-row" key={c.id}><strong>{c.name}</strong><Select value={c.defaultShootingMode} onValueChange={v=>state.updateCategory({...c,defaultShootingMode:v as "quick"|"strict"})}><SelectTrigger aria-label={c.name+"默认标准"}><SelectValue/></SelectTrigger><SelectContent className="p-portal"><SelectItem value="quick">快速</SelectItem><SelectItem value="strict">严格</SelectItem></SelectContent></Select><span>{c.quickHint}</span><Button variant="ghost" onClick={()=>setEditing(structuredClone(c))}>{c.strictChecklist.filter(r=>r.required).length} 项必需<Settings2 size={16}/></Button></div>)}</div><Sheet open={!!editing} onOpenChange={v=>!v&&setEditing(null)}><SheetContent className="p-portal l-category-editor"><SheetHeader><SheetTitle>{editing?.name} · 拍摄标准</SheetTitle><SheetDescription>清单检查只作资料提示，始终允许继续创作。</SheetDescription></SheetHeader>{editing&&<div className="l-detail-scroll"><label>快速提示语<Textarea aria-label="快速档提示语" value={editing.quickHint} onChange={e=>setEditing({...editing,quickHint:e.target.value})}/></label><h3>严格拍摄清单</h3>{Object.entries(shotLabels).map(([angle,label])=>{const req=editing.strictChecklist.find(r=>r.angle===angle);return <div className="l-checklist-editor" key={angle}><div><strong>{label}</strong><Switch aria-label={label+"设为必需"} checked={req?.required??false} onCheckedChange={required=>setEditing({...editing,strictChecklist:req?editing.strictChecklist.map(r=>r.angle===angle?{...r,required}:r):[...editing.strictChecklist,{angle:angle as keyof typeof shotLabels,required,hint:"清晰展示"+label}]})}/></div><Input aria-label={label+"拍摄说明"} value={req?.hint??""} placeholder={"清晰展示"+label} onChange={e=>setEditing({...editing,strictChecklist:req?editing.strictChecklist.map(r=>r.angle===angle?{...r,hint:e.target.value}:r):[...editing.strictChecklist,{angle:angle as keyof typeof shotLabels,required:false,hint:e.target.value}]})}/></div>})}<Button onClick={()=>{state.updateCategory(editing);setEditing(null);toast.success("品类标准已保存到本地预览");}}>保存标准</Button></div>}</SheetContent></Sheet></section>;
}
export function PendingReviews(){
 const state=useLibraryStore(),[actor,setActor]=useState("admin"),[detail,setDetail]=useState<LibraryEntry|null>(null),pending=libraryEntries(state.data).filter(e=>e.visibility==="pending"),reviewer=actor==="admin"?administrator:librarian;
 return <section className="l-admin-section"><div className="l-review-heading"><p>{pending.length} 条推荐等待审核 · 通过后对团队公开</p><Select value={actor} onValueChange={setActor}><SelectTrigger aria-label="审核身份"><SelectValue/></SelectTrigger><SelectContent className="p-portal"><SelectItem value="admin">管理员 · 周明</SelectItem><SelectItem value="editor">模板编辑 · 许宁</SelectItem></SelectContent></Select></div><div className="l-review-list">{pending.map(e=><article className="l-review-row" key={e.id}>{e.kind!=="snippet"?<img src={entryImage(e,state.data)} alt={e.name}/>:<span className="l-review-quote">“</span>}<div><span className="l-card-eyebrow">{{scene:"场景模板",prop:"道具",set:"道具组",reference:"参考图",snippet:"关键词"}[e.kind]} · {e.owner==="U01"?"林悦":"许宁"} 推荐</span><h3>{e.name}</h3><p>{e.tags.join(" · ")}</p></div><Button variant="ghost" onClick={()=>setDetail(e)}>查看<ChevronRight size={16}/></Button><Button variant="outline" onClick={()=>{state.review(e.id,false,reviewer);toast.success("已退回个人收藏");}}><X size={16}/>退回</Button><Button onClick={()=>{state.review(e.id,true,reviewer);toast.success("审核通过，已进入公共库");}}><Check size={16}/>通过</Button></article>)}</div>{!pending.length&&<div className="l-empty-state"><Check size={20}/><h2>推荐已全部处理</h2></div>}<LibraryDetail entry={detail} onClose={()=>setDetail(null)}/></section>;
}
