import {test,expect} from "@playwright/test";
import {build} from "esbuild";
import {createServer,type Server} from "node:http";
import {readFileSync,readdirSync} from "node:fs";
import {resolve} from "node:path";
import sharp from "sharp";
import {fixture} from "./fixtures/visual-plan";
import {bindPlanningReferences} from "../src/lib/visual-plan-rules";
import {emptyProfile} from "../src/lib/profile-rules";
import {models} from "../src/design-preview/mock/models";

let server:Server,origin:string;
test.beforeAll(async()=>{
 const result=await build({entryPoints:["tests/fixtures/canvas-browser.tsx"],bundle:true,write:false,platform:"browser",format:"iife",jsx:"automatic",define:{"process.env.NODE_ENV":'"development"',"process.env":'{}'},plugins:[{name:"测试路由适配",setup(b){
  b.onResolve({filter:/^next\/(navigation|link|dynamic)$/},args=>({path:args.path,namespace:"test-next"}));
  b.onLoad({filter:/.*/,namespace:"test-next"},args=>({resolveDir:process.cwd(),loader:"tsx",contents:args.path.endsWith("navigation")?`import {useMemo} from 'react';const router={push:(url)=>{location.href=url},replace:(url)=>{location.href=url},refresh:()=>{}};export const useRouter=()=>router;export const useSearchParams=()=>useMemo(()=>new URLSearchParams(location.search),[]);export const usePathname=()=>location.pathname;`:args.path.endsWith("link")?`import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`:`import React,{lazy,Suspense} from 'react';export default function dynamic(load){const C=lazy(load);return props=><Suspense fallback={null}><C {...props}/></Suspense>}`}));
 }}]});
 const chunks=resolve(".next/static/chunks"),css=readdirSync(chunks).filter(f=>f.endsWith(".css")).map(f=>readFileSync(resolve(chunks,f),"utf8")).join("\n");
 // 与真实 Next 页面一致使用 UTF-8，避免中文 aria-label 的 CSS 选择器被错误解码。
 server=createServer((req,res)=>{if(req.url==="/bundle.js"){res.setHeader("Content-Type","text/javascript; charset=utf-8");res.end(result.outputFiles[0].contents);}else if(req.url==="/style.css"){res.setHeader("Content-Type","text/css; charset=utf-8");res.end(css);}else{res.setHeader("Content-Type","text/html; charset=utf-8");res.end('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');}});
 await new Promise<void>(done=>server.listen(0,"127.0.0.1",done));const address=server.address();if(!address||typeof address==="string")throw Error("测试服务器未启动");origin=`http://127.0.0.1:${address.port}`;
});
test.afterAll(async()=>{if(server)await new Promise<void>((done,reject)=>server.close(error=>error?reject(error):done()));});

test("真实工作台组件：引用、修改对象、版本比较、布局撤销与找回（全部接口模拟）",async({page})=>{
 const errors:string[]=[],unexpected:string[]=[];page.on("pageerror",error=>{errors.push(error.message);console.error("隔离画布运行错误",error.message);});
 const photo={id:"photo-local",type:"photo",width:512,height:512},style={id:"style-local",type:"style_ref",width:512,height:512};
 const jobs=Array.from({length:5},(_,i)=>({id:"generation-"+i,status:"success",retriedById:null,assets:[{id:"result-"+i,width:512,height:512}],input:i?{sourceAssetId:"result-0",editCount:1}:{},costUsd:0,reservedUsd:0,costEstimated:false,provider:"simulation",model:"本地模拟"}));
 const snapshot={product:{id:"canvas-local",sku:"LOCAL",name:"模拟产品",category:"收纳柜",assets:[photo]},conversationAssets:[style],settings:{webEnabled:false,conversationImages:[{assetId:style.id,role:"reference",purpose:"参考陈列",mode:"prompt_only"}]},categories:[],searches:[],pack:{slots:[{id:"scene",name:"玄关场景",slotType:"scene",goal:"展示收纳",method:"ai_scene",candidateCount:1,finalAssetId:null as string|null,jobs}]},agent:{session:{id:"session",mode:"quick",running:false,confirmedPack:false,confirmedProfileId:null},profile:emptyProfile(),understanding:{percent:0},costs:{llmUsd:0,imagesUsd:0,searchUsd:0,estimated:false},cards:[] as {id:string;kind:string;status:string;data:Record<string,unknown>}[],messages:[],tools:[],documents:[]}};
 let rewritten:Record<string,unknown>|undefined;
 const edits:Record<string,unknown>[]=[],saved:Record<string,unknown>[]=[];let reused=false;
 const generations:Record<string,unknown>[]=[];
 const directRequests:{action:string;selection:{referenceAssetIds:string[];prompt:string};requestKey?:string}[]=[];let loseDirectResponse=true;
 let layout={version:1,nodes:[] as {id:string;x:number;y:number}[],notes:[],hiddenIds:[] as string[],viewport:{x:490,y:110,zoom:.55}},revision=0,submitted:Record<string,unknown>|undefined;
 const png=await sharp({create:{width:512,height:512,channels:3,background:"#bcb3a5"}}).png().toBuffer();
 await page.route("**/*",async route=>{
  const request=route.request(),url=new URL(request.url());if(url.origin!==origin){await route.abort();return;}
  const path=url.pathname;if(!path.startsWith("/api/")){await route.continue();return;}
  const respond=(json:unknown)=>route.fulfill({status:200,json});
  if(path==="/api/auth/session")return respond({user:{name:"本地测试",role:"designer"},expires:"2099-01-01T00:00:00Z"});
  if(path==="/api/studio/models")return respond({models});
  if(path==="/api/studio/direct"){
   const body=request.postDataJSON();directRequests.push(body);
   if(body.action==="quote")return respond({fingerprint:"local-direct",estimatedCostUsd:.03});
   if(loseDirectResponse){loseDirectResponse=false;return route.fulfill({status:500,json:{error:"模拟响应丢失，保留重试编号"}});}
   snapshot.pack.slots.push({...snapshot.pack.slots[0],id:"direct-slot",name:"单张生图",method:"manual_upload",jobs:[{...jobs[0],id:"direct-job",input:{generationMode:"direct"} as unknown as typeof jobs[number]["input"],assets:[{id:"direct-result",width:512,height:512}]}]});
   return respond({productId:"canvas-local",jobId:"direct-job"});
  }
  if(path.startsWith("/api/assets/"))return route.fulfill({status:200,contentType:"image/png",body:png});
  if(path.endsWith("/canvas")){if(request.method()==="PUT"){const body=request.postDataJSON();layout=body.layout;revision++;}return respond({layout,revision,canWrite:true});}
  if(path==="/api/studio/canvas-local"){if(request.method()==="POST"){const body=request.postDataJSON();if(body.action==="rewrite_plan"){rewritten=body.data;snapshot.agent.cards=[];return respond({ok:true});}if(body.action==="edit_quote")return respond({estimatedCostUsd:.04,fingerprint:"local-fingerprint",warning:null});if(body.action==="edit"){edits.push(body.data);return respond({jobId:"local-new-edit"});}if(body.action==="generate"){generations.push(body.data);if(snapshot.agent.session.mode==="manual"&&!body.data.scope)return respond({modeChoiceRequired:true});if(body.data.scope==="batch")snapshot.agent.session.mode="quick";return respond({ok:true});}if(body.action!=="settings")unexpected.push(body.action);return respond({ok:true});}return respond(snapshot);}
  if(path==="/api/studio/saved-references"){if(request.method()==="GET")return respond(new URL(request.url()).searchParams.has("assetId")?{category:"柜",scene:"玄关",reusablePrompt:"当前产品窗边场景"}:saved);const body=request.postDataJSON();if(body.action==="save"){saved.push({id:"local-saved",...body.data,prompt:"旧产品提示词，只供追溯"});return respond(saved[0]);}if(body.action==="reuse"){reused=true;return respond({assetId:"style-local"});}}
  if(path==="/api/products/canvas-local/agent"){submitted=request.postDataJSON();return route.fulfill({status:200,contentType:"text/event-stream",body:'data: {"type":"done"}\n\n'});}
  if(path==="/api/products/canvas-local/pack"){const body=request.postDataJSON();snapshot.pack.slots[0].finalAssetId=body.assetId;return respond({ok:true});}
  unexpected.push(path);await route.abort();
 });
 await page.goto(origin+"/workspace?sku=canvas-local");
 await expect(page.getByText("布局已保存",{exact:true})).toBeAttached();
 const first=page.locator('[data-picture="result-0"]');
 await first.click();await expect(page.getByLabel("本次引用图片")).toContainText("选中 · 版本 1");
 await first.getByRole("button",{name:"放大查看图片",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:"修改这张图",exact:true}).click();await expect(page.getByRole("dialog",{name:"修改这张图",exact:true})).toBeVisible();await page.getByRole("button",{name:"暂不修改",exact:true}).click();
 await page.getByRole("button",{name:"修改这张图",exact:true}).click();await expect(page.getByLabel("本次修改要求")).toBeFocused();await expect(page.locator(".ws-edit-footer")).not.toContainText(/预估|预计|\$/);
 await page.getByLabel("本次修改要求").fill("先保留这条单图草稿");await page.getByRole("button",{name:"暂不修改",exact:true}).click();
 await page.getByRole("button",{name:"修改这张图",exact:true}).click();await expect(page.getByLabel("本次修改要求")).toHaveValue("先保留这条单图草稿");await page.setViewportSize({width:390,height:844});await expect.poll(async()=>(await page.getByRole("dialog",{name:"修改这张图",exact:true}).boundingBox())!.width).toBeLessThanOrEqual(390);await expect.poll(async()=>(await page.getByRole("dialog",{name:"修改这张图",exact:true}).boundingBox())!.x).toBeGreaterThanOrEqual(0);await page.getByRole("button",{name:"暂不修改",exact:true}).click();await page.setViewportSize({width:1280,height:800});
 await page.getByLabel("工作台创作要求").fill("保留这条未发送的修改意见");
 for(const [width,height,theme] of [[1440,900,"亮色主题"],[820,560,"暗色主题"],[1100,720,"亮色主题"]] as const){
  await page.setViewportSize({width,height});await page.getByRole("button",{name:theme,exact:true}).click();
  await page.getByRole("button",{name:"收起对话",exact:true}).click();await expect(page.locator("#workspace-chat")).toBeHidden();
  const reopen=page.locator(".p-canvas-context").getByRole("button",{name:"展开对话",exact:true});
  await expect(reopen).toBeVisible();await expect(reopen).toBeInViewport();await expect(reopen).toHaveAttribute("aria-controls","workspace-chat");await expect(reopen).toHaveAttribute("aria-expanded","false");
  await expect(page.locator(".p-canvas-dock").getByRole("button",{name:"展开对话",exact:true})).toHaveCount(0);
  const placement=await reopen.evaluate(el=>{const b=el.getBoundingClientRect(),c=document.getElementById("workspace-canvas")!.getBoundingClientRect();return {left:b.left-c.left,top:b.top-c.top,hit:el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))};});
  expect(placement.left).toBeGreaterThanOrEqual(0);expect(placement.left).toBeLessThan(40);expect(placement.top).toBeGreaterThanOrEqual(0);expect(placement.top).toBeLessThan(40);expect(placement.hit).toBe(true);
  await reopen.focus();await reopen.press("Enter");await expect(page.getByLabel("工作台创作要求")).toHaveValue("保留这条未发送的修改意见");await expect(page.getByLabel("本次引用图片")).toContainText("选中 · 版本 1");await expect(reopen).toHaveCount(0);
 }
 // 收起时跨到手机宽度，仍可通过常驻“对话”标签找回同一份草稿。
 await page.getByRole("button",{name:"收起对话",exact:true}).click();await page.setViewportSize({width:390,height:844});await expect(page.getByRole("tab",{name:"对话",exact:true})).toBeInViewport();await page.getByRole("tab",{name:"对话",exact:true}).click();await expect(page.getByLabel("工作台创作要求")).toHaveValue("保留这条未发送的修改意见");await page.setViewportSize({width:1280,height:800});
 await page.getByLabel("工作台创作要求").fill("");
 await page.getByRole("button",{name:"加入对话引用",exact:true}).click();await page.getByRole("button",{name:"取消选择",exact:true}).click();
 await expect(page.getByLabel("本次引用图片")).toContainText("引用 · 版本 1");
 await page.getByLabel("取消引用 版本 1 · 生成",{exact:true}).click();await expect(page.getByLabel("本次引用图片")).toHaveCount(0);
 await page.getByLabel("图片版本",{exact:true}).click();await page.locator(".p-canvas-version").filter({hasText:"版本 2"}).click();await page.getByRole("button",{name:"收起",exact:true}).click();await page.getByRole("button",{name:"修改前后",exact:true}).click();
 const dialog=page.getByRole("dialog",{name:"对比选中的图片"});await expect(dialog.locator("img")).toHaveCount(2);
 await expect(dialog.locator("img").first()).toHaveAttribute("src","/api/assets/result-0");
 await dialog.getByRole("button",{name:"继续调整这张",exact:true}).first().click();await expect(dialog).toHaveCount(0);
 await expect(page.getByRole("dialog",{name:"修改这张图",exact:true})).toBeVisible();await page.getByLabel("本次修改要求").fill("只把台面道具移到右侧，其他保持");await page.getByRole("button",{name:"按意见生成新版本",exact:true}).click();
 await expect.poll(()=>edits.length).toBe(1);expect(edits[0].assetId).toBe("result-0");expect(edits[0].instruction).toContain("道具移到右侧");expect(edits[0].fingerprint).toBe("local-fingerprint");expect(submitted).toBeUndefined();
 await page.getByLabel("工作台创作要求").fill("再讨论这个图位");await page.getByRole("button",{name:"发送创作要求",exact:true}).click();
 await expect.poll(()=>submitted?.canvas).toEqual({selectedIds:["result-0"],referenceAssetIds:["result-0"]});
 await page.getByRole("button",{name:"更多图片操作",exact:true}).click();await expect(page.locator(".p-image-toolbar")).not.toContainText(/预估|预计|\$/);await page.getByRole("button",{name:"同款换色 / 材质",exact:true}).click();await expect(page.locator(".ws-edit-footer")).not.toContainText(/预估|预计|\$/);
 await page.getByLabel("颜色材质参考",{exact:true}).selectOption("style-local");await page.getByLabel("目标颜色和材质",{exact:true}).fill("深胡桃木台面、哑光黑框架");await page.getByRole("button",{name:"生成同款新配色",exact:true}).click();
 await expect.poll(()=>edits.length).toBe(2);expect(edits[1].appearanceChange).toEqual({referenceAssetId:"style-local",description:"深胡桃木台面、哑光黑框架",environment:"keep"});
 await page.getByRole("button",{name:"收藏",exact:true}).click();await page.getByLabel("模板名称",{exact:true}).fill("玄关右侧留白");await page.getByRole("button",{name:"保存到模板库",exact:true}).click();await expect.poll(()=>saved.length).toBe(1);
 await page.getByRole("button",{name:"模板库",exact:true}).click();await expect(page.getByRole("dialog",{name:"模板库",exact:true})).toContainText("玄关右侧留白");await page.getByRole("button",{name:"使用模板",exact:true}).click();await page.getByRole("button",{name:"交给搭档适配",exact:true}).click();await expect.poll(()=>reused).toBe(true);await expect(page.getByLabel("本次引用图片")).toContainText("场景参考");await page.getByLabel("取消引用 场景参考 2",{exact:true}).click();
 await page.getByRole("button",{name:"更多图片操作",exact:true}).click();await page.getByRole("button",{name:"从画布隐藏",exact:true}).click();await expect(first).toHaveCount(0);await expect(page.getByLabel("本次引用图片")).toHaveCount(0);
 await expect.poll(()=>layout.hiddenIds).toContain("result-0");
 await page.getByLabel("图片版本",{exact:true}).click();await page.locator(".p-canvas-version").filter({hasText:"版本 1"}).click();await expect(first).toBeVisible();await page.getByRole("button",{name:"收起",exact:true}).click();
 await page.getByRole("button",{name:"设为终稿",exact:true}).click();await expect(page.getByRole("button",{name:"当前终稿",exact:true})).toBeDisabled();
 await page.getByRole("button",{name:"整理画布",exact:true}).click();await expect(page.getByLabel("撤销布局（Ctrl + Z）")).toBeEnabled();
 await page.getByLabel("撤销布局（Ctrl + Z）").click();await expect(page.getByLabel("重做布局（Ctrl + Shift + Z）")).toBeEnabled();
 await page.getByLabel("图位与资料",{exact:true}).click();await page.getByRole("button",{name:"场景参考 2",exact:true}).click();await page.getByRole("button",{name:"收起",exact:true}).click();
 await expect(page.getByRole("button",{name:"围绕这张图聊",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"设为终稿",exact:true})).toHaveCount(0);
 await page.getByRole("button",{name:"取消选择",exact:true}).click();
 await page.setViewportSize({width:1100,height:800});await page.getByRole("button",{name:"暗色主题",exact:true}).click();await expect(page.locator("html")).toHaveClass(/dark/);await page.getByLabel("图片版本",{exact:true}).click();await expect(page.locator(".p-canvas-version").first()).toBeVisible();await page.getByRole("button",{name:"收起",exact:true}).click();
 snapshot.agent.session.confirmedPack=true;await page.reload();await expect(page.getByText("布局已保存",{exact:true})).toBeAttached();
 await page.getByRole("button",{name:"生图模型",exact:true}).click();await expect(page.locator(".p-model-image")).not.toContainText(/\$/);await page.keyboard.press("Escape");await expect(page.locator(".p-model-image")).toHaveCount(0);await expect(page.locator(".p-chat-session-cost")).toContainText("本次创作");
 // 缩窄对话后，输入控件仍全部可点；画布与聊天栏不重叠，底部工具分层排列。
 for(const width of [1440,1100,820]){
  await page.setViewportSize({width,height:800});
  const geometry=await page.evaluate(()=>{const rect=(s:string)=>{const r=document.querySelector(s)!.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width};};return {chat:rect("#workspace-chat"),canvas:rect("#workspace-canvas"),dock:rect(".p-canvas-dock"),zoom:rect(".r1-canvas-controls"),bodyWidth:document.documentElement.scrollWidth};});
  expect(geometry.chat.right).toBeLessThan(geometry.canvas.x);expect(geometry.bodyWidth).toBeLessThanOrEqual(width);
  expect(geometry.dock.bottom<=geometry.zoom.y||geometry.dock.right<=geometry.zoom.x||geometry.zoom.right<=geometry.dock.x).toBeTruthy();
  for(const label of ["智能体模型","生图模型","更多创作选项","发送创作要求"]){const box=await page.getByRole("button",{name:label,exact:true}).boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(geometry.chat.x);expect(box!.x+box!.width).toBeLessThanOrEqual(geometry.chat.right);}
 }
 // 操作区不展示预估费用；两行输入工具在亮暗、窄屏和输入状态下不重叠。
 for(const theme of ["亮色主题","暗色主题"]){
  await page.getByRole("button",{name:theme,exact:true}).click();
  for(const width of [1440,820,390,320]){
   await page.setViewportSize({width,height:844});if(width<=760)await page.getByRole("tab",{name:"对话",exact:true}).click();
   const step=page.locator(".ws-next-step");await expect(step).toContainText("图片已就绪");await expect(step.getByRole("button",{name:"去画布选图"})).toBeInViewport();
   await expect(step).not.toContainText(/预估|预计|\$/);
   for(const text of ["","检查工具栏输入状态"]){
    await page.getByLabel("工作台创作要求").fill(text);
    const layout=await page.locator(".p-chat-input").evaluate(el=>{const box=(selector:string)=>{const e=el.querySelector(selector)!,r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};const send=el.querySelector(".p-send-circle")!;return {composer:el.getBoundingClientRect().toJSON(),models:[box('[aria-label="智能体模型"]'),box('[aria-label="生图模型"]')],tools:[box(".p-composer-add"),box(".p-composer-more"),box(".w-web-toggle"),...(el.querySelector(".p-cost-estimate")?[box(".p-cost-estimate")]:[]),box(".p-send-circle")],sendRadius:parseFloat(getComputedStyle(send).borderRadius),opacity:getComputedStyle(send).opacity,costFont:el.querySelector(".p-cost-estimate")?parseFloat(getComputedStyle(el.querySelector(".p-cost-estimate")!).fontSize):null};});
    expect(Math.abs(layout.models[0].width-layout.models[1].width)).toBeLessThan(1);expect(layout.models[0].y).toBe(layout.models[1].y);expect(layout.models[0].bottom,JSON.stringify({width,theme,text,layout})).toBeLessThan(layout.tools[0].y);
    for(const [i,tool] of layout.tools.entries()){expect(tool.x).toBeGreaterThanOrEqual(layout.composer.x);expect(tool.right).toBeLessThanOrEqual(layout.composer.right);if(i)expect(tool.x).toBeGreaterThanOrEqual(layout.tools[i-1].right);}
    expect(layout.sendRadius).toBeGreaterThanOrEqual(18);expect(layout.opacity).toBe("1");expect(layout.costFont).toBeNull();
   }
  }
  await page.setViewportSize({width:1100,height:800});
 }
 await page.getByLabel("工作台创作要求").fill("");
 const agentBeforeGenerate=JSON.stringify(submitted);await page.getByRole("button",{name:/^再生成候选/}).click();await expect.poll(()=>generations.length).toBe(1);expect(generations[0].requestKey).toBeTruthy();expect(generations[0].scope).toBeUndefined();
 snapshot.agent.session.mode="manual";
 snapshot.pack.slots.push({...snapshot.pack.slots[0],id:"waiting-slot",name:"待生成图位",finalAssetId:null,jobs:[]});
 await page.reload();await expect(page.getByText("布局已保存",{exact:true})).toBeAttached();
 await page.getByRole("button",{name:/^再生成候选/}).click();await expect(page.getByRole("button",{name:"只生成当前图位",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:/^再生成候选/})).toHaveCount(0);
 await page.getByRole("button",{name:"只生成当前图位",exact:true}).click();await expect.poll(()=>generations.at(-1)?.scope).toBe("current");await expect(page.getByRole("button",{name:/^再生成候选/})).toBeEnabled();
 await page.getByRole("button",{name:/^再生成候选/}).click();await page.getByRole("button",{name:"切回整套",exact:true}).click();await expect.poll(()=>generations.at(-1)?.scope).toBe("batch");expect(JSON.stringify(submitted)).toBe(agentBeforeGenerate);
 await page.setViewportSize({width:390,height:844});await page.getByRole("tab",{name:"画布",exact:true}).click();await expect(page.locator("#workspace-chat")).toBeHidden();await page.getByLabel("图片版本",{exact:true}).click();await expect(page.locator(".p-canvas-version").first()).toBeVisible();await page.getByRole("button",{name:"收起",exact:true}).click();await page.getByRole("tab",{name:"对话",exact:true}).click();await expect(page.getByLabel("工作台创作要求")).toBeVisible();
 await page.setViewportSize({width:1100,height:800});
 const reference={assetId:"style-local",purpose:"参考摆放和光线",mode:"prompt_only" as const};
 const plan={...structuredClone(fixture),conversationImages:[{...reference,role:"reference" as const}],identityLock:{...fixture.identityLock,referenceAssetIds:["photo-local"]},slots:bindPlanningReferences([{...fixture.slots[0],references:[reference]}],[{...reference,role:"reference"}])};
 snapshot.agent.cards=[{id:"plan-local",kind:"pack",status:"pending",data:{visualPlan:plan}}];
 await page.reload();await expect(page.getByText("布局已保存",{exact:true})).toBeAttached();
 await expect(page.getByAltText("产品身份实拍 1")).toBeAttached();await expect(page.getByRole("button",{name:"采用这套方案",exact:true})).toBeEnabled();
 await page.getByRole("button",{name:"环境自由配色",exact:true}).click();await expect(page.getByLabel("门厅 环境色调",{exact:true})).toHaveValue(/产品颜色保持实拍/);
 await page.getByLabel("门厅 陈列",{exact:true}).fill("托盘放右后方，左侧留白，不挡把手");
 await page.getByRole("button",{name:"放大门厅参考图1",exact:true}).click();await expect(page.getByRole("dialog")).toBeVisible();await page.getByRole("dialog").getByRole("button",{name:"关闭",exact:true}).click();
 await page.getByRole("button",{name:"借鉴氛围",exact:true}).click();await expect(page.getByRole("button",{name:"采用这套方案",exact:true})).toBeDisabled();await page.getByRole("button",{name:"按意见重写",exact:true}).click();
 await expect.poll(()=>rewritten?.feedback).toContain("托盘放右后方");expect(rewritten?.feedback).toContain("只借鉴整体氛围");
 const agentBefore=JSON.stringify(submitted);
 await page.getByRole("button",{name:"单张生图",exact:true}).click();
 await expect(page.locator(".ws-edit-footer")).not.toContainText(/预估|预计|\$/);
 await page.getByLabel("单张图片描述",{exact:true}).fill("纯文字生成一把绿色椅子");
 await page.getByLabel("单张生图模型",{exact:true}).selectOption("image-banana");
 await page.getByLabel("单张图片比例",{exact:true}).selectOption("3:4");
 await page.getByLabel("单张图片分辨率",{exact:true}).selectOption("4K");
 await page.getByRole("button",{name:"生成一张",exact:true}).click();
 await expect(page.getByText("模拟响应丢失，保留重试编号",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"生成一张",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);
 await expect(page.locator('[data-picture="direct-result"]')).toBeAttached();
 const attempts=directRequests.filter(r=>r.action==="submit");expect(attempts).toHaveLength(2);expect(attempts[0].requestKey).toBe(attempts[1].requestKey);expect(attempts[0].selection.referenceAssetIds).toEqual([]);
 await page.getByRole("button",{name:"单张生图",exact:true}).click();
 await page.getByRole("checkbox",{name:"参考 场景参考 2",exact:true}).check();
 await page.getByRole("button",{name:"生成一张",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);
 expect(directRequests.filter(r=>r.action==="submit").at(-1)?.selection.referenceAssetIds).toEqual(["style-local"]);
 expect(JSON.stringify(submitted)).toBe(agentBefore);
 expect(snapshot.pack.slots[0].finalAssetId).toBe("result-0");expect(unexpected).toEqual([]);expect(errors).toEqual([]);
});
