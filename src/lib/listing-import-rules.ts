import {z} from "zod";
import {patternSchema} from "./visual-plan-rules";
export const listingAnalysisSchema=z.object({summary:z.string(),entries:z.array(z.object({type:z.enum(["scene_pattern","selling_point_pattern","prop_pool","slot_sequence"]),name:z.string().min(1),sellingPoints:z.array(z.string()).default([]),content:z.record(z.string(),z.unknown())})).min(1).max(40)});
export function reviewedListingEntries(raw:unknown,category:string,batchId:string){
 return z.array(patternSchema).min(1).max(40).parse(raw).map((e,i)=>({...e,id:batchId+"-"+i,categories:[category],is_sample:false,source:"人工确认" as const,status:"ready" as const}));
}
