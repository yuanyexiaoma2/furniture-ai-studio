import {StudioError} from "./studio-error";
import type {Profile} from "./profile-rules";

export type UserQuestion={question:string;options:string[];allowFreeText:boolean};
export function validateQuestionAnswers(raw:unknown,questions:Pick<UserQuestion,"options"|"allowFreeText">[]):string[]{
 if(!Array.isArray(raw)||raw.length!==questions.length||raw.some((a,i)=>typeof a!=="string"||!a.trim()||a.length>2000||!questions[i].allowFreeText&&!questions[i].options.includes(a)))throw new StudioError("请回答全部问题，或点击停止提问继续策划");
 return raw;
}
export function questionsComplete(answers:string[],questions:UserQuestion[]){try{validateQuestionAnswers(answers,questions);return true;}catch{return false;}}
export function acknowledgeProfileConflict(profile:Profile,key:keyof Profile,checked:boolean,original:Profile[typeof key]){
 const next=structuredClone(profile),field=next[key];
 field.conflicts=checked?[]:structuredClone(original.conflicts);
 field.status=!field.value.trim()?"missing":checked?"confirmed":"inferred";
 return next;
}
export type GenerationSlot={id:string;method:string;goal:string;finalAssetId:string|null;visualPlan?:unknown};
export function currentGenerationSlot<T extends GenerationSlot>(slots:T[],confirmedPlanId?:string|null){
 return slots.find(s=>s.method==="ai_scene"&&!!s.goal.trim()&&!s.finalAssetId&&(!confirmedPlanId||(s.visualPlan as {confirmationCardId?:string}|null)?.confirmationCardId===confirmedPlanId));
}
export function imageCostLabel(data:{costUsd?:number|null;reservedUsd?:number;costEstimated?:boolean}){
 if(data.costUsd!=null)return `${data.costEstimated?"预估":"实际"} $${data.costUsd.toFixed(4)}`;
 return data.reservedUsd!=null?`预估 $${data.reservedUsd.toFixed(4)} · 待回填`:"费用待回填";
}
