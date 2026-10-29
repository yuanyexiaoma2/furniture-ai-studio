/** 3a本地DOM验收；调用方拦截所有业务写入。 */
import {expect,type Page} from "@playwright/test";
export async function verifyCanvasControls(page:Page,state:string){
 const result:Record<string,unknown>={};
 if(state==="workspace-failed"){
  await expect(page.locator(".p-generation-error")).toContainText("生成服务暂时不可用");
  if(page.viewportSize()!.width>390){await expect(page.locator(".p-generation-stage")).toHaveText(["排队中","生成中"]);expect(await page.locator(".p-shimmer").count()).toBe(2);}else{await expect(page.locator(".p-generation-stage").first()).toHaveText("排队中");await expect(page.locator(".p-shimmer").first()).toBeVisible();}
  await page.getByRole("button",{name:"重试",exact:true}).click();
  await expect(page.locator('[data-picture="job-ui-failed"] .p-generation-stage')).toHaveText("排队中");
  result.originalRetry=true;return result;
 }
 if(state==="workspace-lowres"){
  await expect(page.locator(".p-pixel-badge")).toContainText("960 × 720");await expect(page.locator(".p-pixel-badge")).toHaveAttribute("data-pending","true");result.naturalPixels="960 × 720";
 }
 if(state==="workspace-toolbar-flip"){
  const toolbar=await page.locator(".p-live-image-toolbar").boundingBox(),image=await page.locator('[data-picture="ui-scene-a"]').boundingBox();expect(toolbar!.y).toBeGreaterThan(image!.y+image!.height);const badge=await page.locator(".p-pixel-badge").boundingBox();expect(toolbar!.y).toBeGreaterThanOrEqual(badge!.y+badge!.height+8);result.flipped=true;result.badgeNotCovered=true;
 }
 if(state==="workspace-multi"){
  await expect(page.locator(".p-selection-count")).toHaveText("已选 2 张");
  await page.getByRole("button",{name:"对比",exact:true}).click();await expect(page.getByRole("dialog",{name:"对比选中的图片"})).toBeVisible();await expect(page.locator(".p-compare-grid img")).toHaveCount(2);await page.keyboard.press("Escape");
  const downloads: string[]=[];page.on("download",d=>{downloads.push(d.suggestedFilename());void d.cancel();});await page.getByRole("button",{name:"批量下载",exact:true}).click();await expect.poll(()=>downloads.length).toBe(2);
  await page.getByRole("button",{name:"删除",exact:true}).click();await expect(page.locator('[data-picture="ui-scene-a"]')).toHaveCount(0);await expect(page.locator('[data-picture="ui-scene-b"]')).toHaveCount(0);
  await page.getByRole("button",{name:"撤销布局（Ctrl + Z）",exact:true}).click();await expect(page.locator('[data-picture="ui-scene-a"]')).toBeAttached();await expect(page.locator('[data-picture="ui-scene-b"]')).toBeAttached();result.multi={compare:2,downloads:downloads.length,deleteUndo:true};return result;
 }
 if(state!=="workspace-single")return result;
 const toolbar=page.locator(".p-image-toolbar");expect((await toolbar.boundingBox())!.height).toBe(36);
 const icons=await toolbar.locator("svg").evaluateAll(es=>es.map(e=>e.getBoundingClientRect().width));expect(icons.every(v=>v===20)).toBe(true);
 await expect(toolbar.getByRole("group",{name:"AI操作",exact:true})).toBeVisible();await expect(toolbar.getByRole("group",{name:"普通操作",exact:true})).toBeAttached();
 const dock=page.getByRole("toolbar",{name:"画布工具"});for(const label of ["选择（V）","平移（H）","添加便签（N）","添加参考图（Ctrl + O）","撤销布局（Ctrl + Z）","重做布局（Ctrl + Shift + Z）","图层","历史"])await expect(dock.getByRole("button",{name:label,exact:true})).toBeAttached();
 const dockBox=(await dock.boundingBox())!,controls=(await page.locator(".r1-canvas-controls").boundingBox())!;expect(dockBox.x+dockBox.width).toBeLessThanOrEqual((await page.viewportSize())!.width);expect(dockBox.y+dockBox.height<=controls.y||dockBox.x+dockBox.width<=controls.x).toBe(true);result.dockNoOverlap=true;
 await page.getByRole("button",{name:"缩放百分比菜单"}).click();await page.getByRole("button",{name:"100%",exact:true}).click();await expect.poll(async()=>Math.round((await toolbar.boundingBox())!.height)).toBe(36);await page.keyboard.press("Escape");
 result.fixedHeight=36;result.icons=20;
 const minimap=page.locator(".p-canvas-minimap");await expect(minimap).toHaveCount(0);await page.getByRole("button",{name:"切换小地图"}).click();await expect(minimap).toBeAttached();await page.getByRole("button",{name:"切换小地图"}).click();await expect(minimap).toHaveCount(0);
 if(!await page.locator(".p-canvas-guide").isVisible())await page.getByRole("button",{name:"画布操作说明"}).click();await expect(page.locator(".p-canvas-guide")).toBeVisible();await page.getByRole("button",{name:"画布操作说明"}).click();await expect(page.locator(".p-canvas-guide")).toHaveCount(0);
 await dock.getByRole("button",{name:"图层",exact:true}).click();await expect(page.getByRole("heading",{name:"图位与参考图"})).toBeVisible();await dock.getByRole("button",{name:"图层",exact:true}).click();
 await dock.getByRole("button",{name:"历史",exact:true}).click();await expect(page.getByRole("heading",{name:"创作历史"})).toBeVisible();await dock.getByRole("button",{name:"历史",exact:true}).click();
 await page.locator(".react-flow__pane").focus();await page.keyboard.press("h");await expect(dock.getByRole("button",{name:"平移（H）"})).toHaveClass(/active/);await page.keyboard.press("v");await expect(dock.getByRole("button",{name:"选择（V）"})).toHaveClass(/active/);
 const chooser=page.waitForEvent("filechooser");await dock.getByRole("button",{name:"添加参考图（Ctrl + O）"}).click();await chooser;
 await dock.getByRole("button",{name:"添加便签（N）"}).click();await expect(page.getByLabel("画布便签")).toHaveCount(1);await dock.getByRole("button",{name:"撤销布局（Ctrl + Z）"}).click();await expect(page.getByLabel("画布便签")).toHaveCount(0);await dock.getByRole("button",{name:"重做布局（Ctrl + Shift + Z）"}).click();await expect(page.getByLabel("画布便签")).toHaveCount(1);
 result.entryPoints=true;result.layoutUndoRedo=true;return result;
}
