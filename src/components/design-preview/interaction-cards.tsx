"use client";
import {Fragment,useState} from "react";
import {profileFields,profileLabels,type Profile} from "@/lib/profile-rules";
import {acknowledgeProfileConflict,questionsComplete,type UserQuestion} from "@/lib/interaction-rules";
import {Button} from "./ui/button";
import {Input} from "./ui/input";
import {toast} from "sonner";

export function QuestionsCard({questions,busy,onSubmit}:{questions:UserQuestion[];busy:boolean;onSubmit:(answers:string[])=>void}){
 const [answers,setAnswers]=useState<string[]>(()=>questions.map(()=>""));
 const answer=(index:number,value:string)=>setAnswers(old=>old.map((v,i)=>i===index?value:v));
 return <div className="l-shooting-card">{questions.map((q,i)=><div key={i}><h3>{q.question}</h3>{q.options.map(option=><Button key={option} variant={answers[i]===option?"secondary":"outline"} aria-pressed={answers[i]===option} disabled={busy} onClick={()=>answer(i,option)}>{option}</Button>)}{q.allowFreeText&&<Input aria-label={"问题"+(i+1)+"回答"} placeholder="也可直接填写" maxLength={2000} value={answers[i]} disabled={busy} onChange={e=>answer(i,e.target.value)}/>}</div>)}<Button disabled={busy||!questionsComplete(answers,questions)} onClick={()=>onSubmit(answers)}>提交回答</Button></div>;
}
export function ProfileForm({profile,busy=false,onSave}:{profile:Profile;busy?:boolean;onSave:(profile:Profile)=>Promise<void>}){
 const [value,setValue]=useState<Profile>(()=>structuredClone(profile)),[checked,setChecked]=useState<Partial<Record<keyof Profile,boolean>>>({});
 async function save(){const next=structuredClone(value);for(const field of Object.values(next)){if(field.value.trim()&&!field.conflicts.length)field.status="confirmed";else if(!field.value.trim())field.status="missing";}await onSave(next);}
 return <div className="l-shooting-card"><h3>核对产品档案</h3><p className="p-subtle">确认可见特征；没有依据的尺寸和结构请留空。</p>{profileFields.map(k=><Fragment key={k}><label className="t10-profile-field"><span>{profileLabels[k]}</span><Input aria-label={profileLabels[k]} value={value[k].value} disabled={busy} onChange={e=>setValue(s=>({...s,[k]:{...s[k],value:e.target.value}}))}/></label>{profile[k].conflicts.length>0&&<div className="history-warning">冲突：{profile[k].conflicts.map(c=>`${c.value}（${c.source.quote}）`).join(" / ")}<label><input type="checkbox" checked={!!checked[k]} disabled={busy} onChange={e=>{const yes=e.target.checked;setChecked(s=>({...s,[k]:yes}));setValue(s=>acknowledgeProfileConflict(s,k,yes,profile[k]));}}/>我已核实，以上填写值为准</label></div>}</Fragment>)}<Button disabled={busy||Object.values(value).some(f=>f.conflicts.length>0)} onClick={()=>void save().catch(e=>toast.error(e instanceof Error?e.message:"保存失败"))}>确认并保存档案</Button></div>;
}
