import {z} from "zod";
export const competitorInputSchema=z.object({assetIds:z.array(z.string().min(1)).max(10).default([]),links:z.array(z.string().url().max(2000)).max(10).default([])});
export type CompetitorInput=z.infer<typeof competitorInputSchema>;
export function researchEnvelope(raw:unknown){const r=raw&&typeof raw==="object"?raw as Record<string,unknown>:{};return {inputs:competitorInputSchema.parse(r.inputs??{}),cache:r.cache??(r.status?r:null)};}
export function propPoolFrom(entries:{type:string;content:Record<string,unknown>}[]){return [...new Set(entries.filter(e=>e.type==="prop_pool").flatMap(e=>[...(Array.isArray(e.content.props)?e.content.props:[]),...(Array.isArray(e.content.displayItems)?e.content.displayItems:[])].filter((s):s is string=>typeof s==="string")))];}
