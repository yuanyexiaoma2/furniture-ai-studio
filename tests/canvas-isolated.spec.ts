import {test,expect} from "@playwright/test";
import {build} from "esbuild";
import {createServer,type Server} from "node:http";
import {readFileSync,readdirSync} from "node:fs";
import {resolve} from "node:path";
import sharp from "sharp";
import {emptyProfile} from "../src/lib/profile-rules";
import {models} from "../src/design-preview/mock/models";

let server:Server,origin:string;
test.beforeAll(async()=>{
 const result=await build({entryPoints:["tests/fixtures/canvas-browser.tsx"],bundle:true,write:false,platform:"browser",format:"iife",jsx:"automatic",define:{"process.env.NODE_ENV":'"development"',"process.env":'{}'},plugins:[{name:"测试路由适配",setup(b){
  b.onResolve({filter:/^next\/(navigation|link|dynamic)$/},args=>({path:args.path,namespace:"test-next"}));
  b.onLoad({filter:/.*/,namespace:"test-next"},args=>({resolveDir:process.cwd(),loader:"tsx",contents:args.path.endsWith("navigation")?`import {useMemo} from 'react';const router={push:(url)=>{location.href=url},replace:(url)=>{location.href=url},refresh:()=>{}};export const useRouter=()=>router;export const useSearchParams=()=>useMemo(()=>new URLSearchParams(location.search),[]);export const usePathname=()=>location.pathname;`:args.path.endsWith("link")?`import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`:`import React,{lazy,Suspense} from 'react';export default function dynamic(load){const C=lazy(load);return props=><Suspense fallback={null}><C {...props}/></Suspense>}`}));
 }}]});
 const chunks=resolve(".next/static/chunks"),css=readdirSync(chunks).filter(f=>f.endsWith(".css")).map(f=>readFileSync(resolve(chunks,f),"utf8")).join("\n");
 server=createServer((req,res)=>{if(req.url==="/bundle.js"){res.setHeader("Content-Type","text/javascript");res.end(result.outputFiles[0].contents);}else if(req.url==="/style.css"){res.setHeader("Content-Type","text/css");res.end(css);}else{res.setHeader("Content-Type","text/html");res.end('<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');}});
 await new Promise<void>(done=>server.listen(0,"127.0.0.1",done));const address=server.address();if(!address||typeof address==="string")throw Error("测试服务器未启动");origin=`http://127.0.0.1:${address.port}`;
});
test.afterAll(async()=>{if(server)await new Promise<void>((done,reject)=>server.close(error=>error?reject(error):done()));});

test("真实工作台组件：引用、修改对象、版本比较、布局撤销与找回（全部接口模拟）",async({page})=>{
 const errors:string[]=[],unexpected:string[]=[];page.on("pageerror",error=>{errors.push(error.message);console.error("隔离画布运行错误",error.message);});
 const photo={id:"photo-local",type:"photo",width:512,height:512},style={id:"style-local",type:"style_ref",width:512,height:512};
 const jobs=Array.from({length:5},(_,i)=>({id:"generation-"+i,status:"success",retriedById:null,assets:[{id:"result-"+i,width:512,height:512}],input:i?{sourceAssetId:"result-0",editCount:1}:{},costUsd:0,reservedUsd:0,costEstimated:false,provider:"simulation",model:"本地模拟"}));
 const snapshot={product:{id:"canvas-local",sku:"LOCAL",name:"模拟产品",category:"收纳柜",assets:[photo]},conversationAssets:[style],settings:{webEnabled:false,conversationImages:[{assetId:style.id,role:"reference",purpose:"参考陈列",mode:"prompt_only"}]},categories:[],searches:[],pack:{slots:[{id:"scene",name:"玄关场景",slotType:"scene",goal:"展示收纳",method:"ai_scene",candidateCount:1,finalAssetId:null as string|null,jobs}]},agent:{session:{id:"session",mode:"quick",running:false,confirmedPack:false,confirmedProfileId:null},profile:emptyProfile(),understanding:{percent:0},costs:{llmUsd:0,imagesUsd:0,searchUsd:0,estimated:false},cards:[],messages:[],tools:[],documents:[]}};
 let layout={version:1,nodes:[] as {id:string;x:number;y:number}[],notes:[],hiddenIds:[] as string[],viewport:{x:490,y:110,zoom:.55}},revision=0,submitted:Record<string,unknown>|undefined;
 const png=await sharp({create:{width:512,height:512,channels:3,background:"#bcb3a5"}}).png().toBuffer();
 await page.route("**/*",async route=>{
  const request=route.request(),url=new URL(request.url());if(url.origin!==origin){await route.abort();return;}
  const path=url.pathname;if(!path.startsWith("/api/")){await route.continue();return;}
  const respond=(json:unknown)=>route.fulfill({status:200,json});
  if(path==="/api/auth/session")return respond({user:{name:"本地测试",role:"designer"},expires:"2099-01-01T00:00:00Z"});
  if(path==="/api/studio/models")return respond({models});
  if(path.startsWith("/api/assets/"))return route.fulfill({status:200,contentType:"image/png",body:png});
  if(path.endsWith("/canvas")){if(request.method()==="PUT"){const body=request.postDataJSON();layout=body.layout;revision++;}return respond({layout,revision,canWrite:true});}
  if(path==="/api/studio/canvas-local"){if(request.method()==="POST"){const body=request.postDataJSON();if(body.action!=="settings")unexpected.push(body.action);return respond({ok:true});}return respond(snapshot);}
  if(path==="/api/products/canvas-local/agent"){submitted=request.postDataJSON();return route.fulfill({status:200,contentType:"text/event-stream",body:'data: {"type":"done"}\n\n'});}
  if(path==="/api/products/canvas-local/pack"){const body=request.postDataJSON();snapshot.pack.slots[0].finalAssetId=body.assetId;return respond({ok:true});}
  unexpected.push(path);await route.abort();
 });
 await page.goto(origin+"/workspace?sku=canvas-local");
 await expect(page.getByText("布局已保存",{exact:true})).toBeAttached();
 const first=page.locator('[data-picture="result-0"]');
 await first.click();await expect(page.getByLabel("本次引用图片")).toContainText("选中 · 版本 1");
 await page.getByRole("button",{name:"描述修改",exact:true}).click();await expect(page.getByLabel("工作台创作要求")).toBeFocused();
 await page.getByLabel("工作台创作要求").fill("保留这条未发送的修改意见");
 await page.getByRole("button",{name:"收起对话",exact:true}).click();await expect(page.locator("#workspace-chat")).toBeHidden();
 await page.getByRole("button",{name:"展开对话",exact:true}).click();await expect(page.getByLabel("工作台创作要求")).toHaveValue("保留这条未发送的修改意见");
 await page.getByLabel("工作台创作要求").fill("");
 await page.getByRole("button",{name:"加入对话引用",exact:true}).click();await page.getByRole("button",{name:"取消选择",exact:true}).click();
 await expect(page.getByLabel("本次引用图片")).toContainText("引用 · 版本 1");
 await page.getByLabel("取消引用 版本 1 · 生成",{exact:true}).click();await expect(page.getByLabel("本次引用图片")).toHaveCount(0);
 await page.getByLabel("图片版本",{exact:true}).click();await page.locator(".p-canvas-version").filter({hasText:"版本 2"}).click();await page.getByRole("button",{name:"收起",exact:true}).click();await page.getByRole("button",{name:"修改前后",exact:true}).click();
 const dialog=page.getByRole("dialog",{name:"对比选中的图片"});await expect(dialog.locator("img")).toHaveCount(2);
 await expect(dialog.locator("img").first()).toHaveAttribute("src","/api/assets/result-0");
 await dialog.getByRole("button",{name:"继续调整这张",exact:true}).first().click();await expect(dialog).toHaveCount(0);
 await page.getByRole("button",{name:"描述修改",exact:true}).click();await page.getByLabel("工作台创作要求").fill("只把台面道具移到右侧，其他保持");await page.getByRole("button",{name:"发送创作要求",exact:true}).click();
 await expect.poll(()=>submitted?.canvas).toEqual({selectedIds:["result-0"],referenceAssetIds:["result-0"]});
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
 // 缩窄对话后，输入控件仍全部可点；画布与聊天栏不重叠，底部工具分层排列。
 for(const width of [1440,1100,820]){
  await page.setViewportSize({width,height:800});
  const geometry=await page.evaluate(()=>{const rect=(s:string)=>{const r=document.querySelector(s)!.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width};};return {chat:rect("#workspace-chat"),canvas:rect("#workspace-canvas"),dock:rect(".p-canvas-dock"),zoom:rect(".r1-canvas-controls"),bodyWidth:document.documentElement.scrollWidth};});
  expect(geometry.chat.right).toBeLessThan(geometry.canvas.x);expect(geometry.bodyWidth).toBeLessThanOrEqual(width);
  expect(geometry.dock.bottom<=geometry.zoom.y||geometry.dock.right<=geometry.zoom.x||geometry.zoom.right<=geometry.dock.x).toBeTruthy();
  for(const label of ["智能体模型","生图模型","更多创作选项","发送创作要求"]){const box=await page.getByRole("button",{name:label,exact:true}).boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(geometry.chat.x);expect(box!.x+box!.width).toBeLessThanOrEqual(geometry.chat.right);}
 }
 await page.setViewportSize({width:390,height:844});await page.getByRole("tab",{name:"画布",exact:true}).click();await expect(page.locator("#workspace-chat")).toBeHidden();await page.getByLabel("图片版本",{exact:true}).click();await expect(page.locator(".p-canvas-version").first()).toBeVisible();await page.getByRole("button",{name:"收起",exact:true}).click();await page.getByRole("tab",{name:"对话",exact:true}).click();await expect(page.getByLabel("工作台创作要求")).toBeVisible();
 await page.setViewportSize({width:1100,height:800});
 await page.reload();await expect(page.getByText("布局已保存",{exact:true})).toBeAttached();
 expect(snapshot.pack.slots[0].finalAssetId).toBe("result-0");expect(unexpected).toEqual([]);expect(errors).toEqual([]);
});
