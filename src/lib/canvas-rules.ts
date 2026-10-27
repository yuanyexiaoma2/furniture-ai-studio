import {z} from "zod";

const coordinate=z.number().finite().min(-100000).max(100000);
const point={x:coordinate,y:coordinate};
const size={width:z.number().finite().min(40).max(10000).optional(),height:z.number().finite().min(40).max(10000).optional()};
export const canvasLayoutSchema=z.object({
 version:z.literal(1),
 nodes:z.array(z.object({id:z.string().min(1).max(120),...point,...size}).strict()).max(500),
 notes:z.array(z.object({id:z.string().regex(/^note-[a-zA-Z0-9-]+$/),text:z.string().max(2000),...point,...size}).strict()).max(50),
 hiddenIds:z.array(z.string().min(1).max(120)).max(500),
 viewport:z.object({...point,zoom:z.number().finite().min(.1).max(4)}).strict().nullable(),
}).strict().superRefine((v,ctx)=>{
 const ids=[...v.nodes,...v.notes].map(n=>n.id);
 if(new Set(ids).size!==ids.length)ctx.addIssue({code:"custom",message:"画布元素不能重复"});
});
export type CanvasLayout=z.infer<typeof canvasLayoutSchema>;
export const emptyCanvasLayout=():CanvasLayout=>({version:1,nodes:[],notes:[],hiddenIds:[],viewport:null});
// 只处理服务端已核实属于当前商品的旧元素，保留便签、视口及有效图片的手动位置。
export function reconcileCanvasLayout(layout:CanvasLayout,replacements:Map<string,string[]>):CanvasLayout{
 const nodes=layout.nodes.filter(n=>!replacements.has(n.id)),seen=new Set(nodes.map(n=>n.id));
 for(const node of layout.nodes)for(const [index,id]of(replacements.get(node.id)??[]).entries())if(!seen.has(id)){nodes.push({...node,id,x:node.x+index*260});seen.add(id);}
 return {...layout,nodes,hiddenIds:[...new Set(layout.hiddenIds.flatMap(id=>replacements.get(id)??[id]))]};
}
export function sameCanvasLayout(left:CanvasLayout,right:CanvasLayout){
 const ordered=(layout:CanvasLayout)=>({...layout,nodes:[...layout.nodes].sort((a,b)=>a.id.localeCompare(b.id)),notes:[...layout.notes].sort((a,b)=>a.id.localeCompare(b.id)),hiddenIds:[...layout.hiddenIds].sort()});
 return JSON.stringify(ordered(left))===JSON.stringify(ordered(right));
}
export const canvasSelectionSchema=z.object({selectedIds:z.array(z.string().min(1).max(120)).max(20).default([]),referenceAssetIds:z.array(z.string().min(1).max(120)).max(6).default([])}).strict();
export type CanvasSelection=z.infer<typeof canvasSelectionSchema>;
export type CanvasElement={id:string;type:"frame"|"picture"|"note";label:string;assetId?:string;slotId?:string;parentId?:string;final?:boolean;x:number;y:number;width:number;height:number;alias?:string};

// 借鉴Loomic的结构化摘要：只传有限元素，坐标使用画布坐标而非屏幕像素。
export function summarizeCanvas(elements:CanvasElement[],selectedIds:string[],viewport:CanvasLayout["viewport"]){
 const selected=new Set(selectedIds),visible=[...elements].sort((a,b)=>Number(selected.has(b.id))-Number(selected.has(a.id)));
 return {elementCount:elements.length,selectedIds:[...selected],viewport,elements:visible.slice(0,60).map(e=>({...e,label:e.label.slice(0,500),selected:selected.has(e.id)})),truncated:elements.length>60};
}
