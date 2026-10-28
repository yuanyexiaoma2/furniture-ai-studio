import {z} from "zod";
import {visualPlanSchema} from "./visual-plan-rules";
export const ratingDecisions=["adopt","minor","redo"] as const;
export const ratingLabels={adopt:"采用",minor:"小改",redo:"重做"};
export const reviewActionSchema=z.discriminatedUnion("action",[
 z.object({action:z.literal("start"),planVersion:z.string().min(1),nextRound:z.number().int().min(1)}).strict(),
 z.object({action:z.literal("score"),roundId:z.string().min(1),slotKey:z.string().min(1),decision:z.enum(ratingDecisions),reason:z.string().trim().min(1,"请填写一句原因").max(300).refine(s=>!/[\r\n]/.test(s),"请用一句话说明原因")}).strict(),
]);
export const reviewSnapshotSchema=z.object({sku:z.string(),name:z.string(),plan:visualPlanSchema,images:z.array(z.object({id:z.string(),src:z.string(),slot:z.string()})),diff:z.unknown().optional(),generatedAt:z.string()});
export type ReviewSnapshot=z.infer<typeof reviewSnapshotSchema>;
export type Rating={slotKey:string;decision:string;reason:string;reviewerId:string;reviewerName:string;createdAt:string};
export function latestRatings(ratings:Rating[]){const rows=new Map<string,Rating>();for(const r of ratings)rows.set(r.slotKey,r);return [...rows.values()];}
export function ratingCounts(slotKeys:string[],ratings:Rating[]){
 const valid=new Set(slotKeys),counts={adopt:0,minor:0,redo:0,unrated:0,total:slotKeys.length};
 for(const r of latestRatings(ratings))if(valid.has(r.slotKey)&&ratingDecisions.includes(r.decision as typeof ratingDecisions[number]))counts[r.decision as typeof ratingDecisions[number]]++;
 counts.unrated=counts.total-counts.adopt-counts.minor-counts.redo;return counts;
}
export type ReviewRoundView={id:string;number:number;planVersion:string;libraryEntryCount:number;libraryEligibleCount:number;createdByName:string;createdAt:string;ratings:Rating[]};
export type ReviewControls={productId:string;planVersion:string;libraryEntryCount:number;libraryEligibleCount:number;rounds:ReviewRoundView[];activeRound:ReviewRoundView|null;nextRound:number;liveUrl:string;readOnly?:boolean};
export type SummaryRow=ReviewRoundView&{productId:string;sku:string;name:string;slotKeys:string[]};
export function compareFirstTwo(rows:SummaryRow[]){const first=rows.find(r=>r.number===1),second=rows.find(r=>r.number===2);if(!first||!second)return null;const a=ratingCounts(first.slotKeys,first.ratings),b=ratingCounts(second.slotKeys,second.ratings);return {first:a,second:b,delta:{adopt:b.adopt-a.adopt,minor:b.minor-a.minor,redo:b.redo-a.redo}};}
