import {canvasGridPosition,canvasGridSize} from "@/lib/canvas-arrangement";
import type {StudioNode} from "./store";

export function canvasSelection(nodes:StudioNode[],ids:string[]){
 const selected=[...new Set(ids)].filter(id=>nodes.some(n=>n.id===id));
 const target=nodes.find(n=>selected.includes(n.id)&&n.type==="picture")??nodes.find(n=>selected.includes(n.id)&&n.type==="frame");
 return {nodes:nodes.map(n=>!!n.selected===selected.includes(n.id)?n:{...n,selected:selected.includes(n.id)}),selected,contextId:target?.type==="picture"?target.id:null,...(target?{target:target.data.slot}:{})};
}

// 轮询追加新图时避开旧图；只修复完全相同的历史坐标，不重排自由布局。
export function placeCanvasResults(nodes:StudioNode[],existingIds:Set<string>){
 const positions=new Map<string,StudioNode["position"]>();
 for(const frame of nodes.filter(n=>n.type==="frame"&&n.id.startsWith("slot-"))){
  const children=nodes.filter(n=>n.parentId===frame.id),occupied:StudioNode[]=[];
  const overlaps=(p:StudioNode["position"])=>occupied.some(n=>p.x<n.position.x+240&&p.x+240>n.position.x&&p.y<n.position.y+220&&p.y+220>n.position.y);
  for(const node of [...children.filter(n=>existingIds.has(n.id)),...children.filter(n=>!existingIds.has(n.id))]){
   let position=node.position;
   if(occupied.some(n=>n.position.x===position.x&&n.position.y===position.y)||!existingIds.has(node.id)&&overlaps(position)){
    let index=0;while(overlaps(canvasGridPosition(index)))index++;
    position=canvasGridPosition(index);
   }
   positions.set(node.id,position);occupied.push({...node,position});
  }
 }
 const placed=nodes.map(n=>positions.has(n.id)?{...n,position:positions.get(n.id)!}:n);
 return placed.map(n=>{
  if(n.type!=="frame")return n;
  const children=placed.filter(child=>child.parentId===n.id);
  return {...n,style:{...n.style,width:Math.max(Number(n.style?.width??0),...children.map(child=>child.position.x+Number(child.style?.width??240)+24)),height:Math.max(Number(n.style?.height??0),...children.map(child=>child.position.y+Number(child.style?.height??220)+30))}};
 });
}

// 只在用户主动整理时重排；轮询不会覆盖用户手动摆放。
export function arrangeCanvasNodes(nodes:StudioNode[]){
 let top=0;
 const placements=new Map<string,{position:{x:number;y:number};style?:StudioNode["style"]}>();
 for(const frame of nodes.filter(n=>n.type==="frame")){
  const children=nodes.filter(n=>n.parentId===frame.id),columns=frame.id==="reference-frame"?2:3,size=canvasGridSize(children.length,columns);
  placements.set(frame.id,{position:{x:frame.id==="reference-frame"?-620:0,y:frame.id==="reference-frame"?0:top},style:{...frame.style,...size}});
  if(frame.id!=="reference-frame")top+=size.height+70;
  children.forEach((n,i)=>placements.set(n.id,{position:canvasGridPosition(i,columns)}));
 }
 return nodes.map(n=>placements.has(n.id)?{...n,...placements.get(n.id)}:n);
}

export function restoreCanvasNodes(nodes:StudioNode[],base:StudioNode[],hiddenIds:string[],id:string){
 const target=base.find(n=>n.id===id);if(!target)return {nodes,hiddenIds};
 const restore=new Set([id,...(target.parentId?[target.parentId]:[]),...base.filter(n=>n.parentId===id).map(n=>n.id)]);
 const hidden=hiddenIds.filter(key=>!restore.has(key)),visible=new Set(nodes.map(n=>n.id));
 const added=base.filter(n=>restore.has(n.id)&&!visible.has(n.id)&&!hidden.includes(n.id)&&!hidden.includes(n.parentId??""));
 // 父分组必须出现在子节点之前；已有节点及便签位置原样保留。
 return {nodes:placeCanvasResults([...nodes.filter(n=>!n.parentId),...added.filter(n=>!n.parentId),...nodes.filter(n=>n.parentId),...added.filter(n=>n.parentId)],new Set(nodes.map(n=>n.id))),hiddenIds:hidden};
}
