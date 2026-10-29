import test from "node:test";
import assert from "node:assert/strict";
import {captureLayoutHistory,imageToolbarPlacement,resolutionIsPending} from "../../src/components/design-preview/canvas-layout-history";
import type {StudioNode} from "../../src/components/design-preview/store";

test("布局撤销快照只记录位置、便签与隐藏，不携带任务、图片或终稿数据",()=>{
 const node:StudioNode={id:"candidate",type:"picture",position:{x:240,y:60},data:{image:"/api/assets/original",label:"候选",slot:"场景",final:true,loading:false,error:"服务端状态"}};
 const snapshot=captureLayoutHistory([node,{id:"note",type:"note",position:{x:10,y:20},data:{image:"",slot:"便签",label:"保持产品外观"}}],["hidden"]);
 assert.deepEqual(snapshot.nodes,[{id:"candidate",x:240,y:60}]);assert.equal(snapshot.notes[0].text,"保持产品外观");assert.deepEqual(snapshot.hiddenIds,["hidden"]);assert.equal(snapshot.viewport,null);assert(!JSON.stringify(snapshot).includes("original"));assert(!JSON.stringify(snapshot).includes("final"));
});
test("工具条以画布上缘计算翻转；像素角标按长边2000的边界判断",()=>{
 assert.equal(imageToolbarPlacement(100,62),"bottom");assert.equal(imageToolbarPlacement(126,62),"top");assert.equal(imageToolbarPlacement(500,462),"bottom");
 assert(resolutionIsPending(1999,1500));assert(!resolutionIsPending(1500,2000));assert(!resolutionIsPending(4096,1024));
});
