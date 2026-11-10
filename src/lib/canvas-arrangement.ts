// 前后端共用默认几何，保证 Agent 看到的位置与未保存的画布一致。
export function canvasGridPosition(index:number,columns=3){return {x:24+index%columns*260,y:30+Math.floor(index/columns)*270};}
export function canvasGridSize(count:number,columns=3){return {width:Math.max(540,Math.min(count,columns)*260+28),height:Math.max(280,Math.ceil(count/columns)*270+30)};}
