import type {CanvasLayout} from "@/lib/canvas-rules";
import type {StudioNode} from "./store";

/** 只撤销本地布局/便签/隐藏，不还原生成状态、终稿或费用。 */
export function captureLayoutHistory(nodes:StudioNode[],hiddenIds:string[]):CanvasLayout {
 const size=(n:StudioNode)=>({...(typeof n.style?.width==="number"?{width:n.style.width}:{}),...(typeof n.style?.height==="number"?{height:n.style.height}:{})});
 return {version:1,viewport:null,hiddenIds:[...hiddenIds],nodes:nodes.filter(n=>n.type!=="note").map(n=>({id:n.id,...n.position,...size(n)})),notes:nodes.filter(n=>n.type==="note").map(n=>({id:n.id,text:n.data.label,...n.position,...size(n)}))};
}

export function imageToolbarPlacement(imageTop:number,canvasTop:number){return imageTop-canvasTop<64?"bottom":"top";}
export function resolutionIsPending(width:number,height:number){return Math.max(width,height)<2000;}
