import {test,expect,type Page,type Request} from "@playwright/test";
import {build} from "esbuild";
import {createServer,type Server} from "node:http";
import {readFileSync,readdirSync} from "node:fs";
import {mkdir,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import sharp from "sharp";
import {models} from "../src/design-preview/mock/models";
import {emptyProfile} from "../src/lib/profile-rules";
let server:Server,origin:string;
test.beforeAll(async()=>{
 const result=await build({entryPoints:["tests/fixtures/interaction-recovery-browser.tsx"],bundle:true,write:false,platform:"browser",format:"iife",jsx:"automatic",define:{"process.env.NODE_ENV":'"development"',"process.env":'{}'},plugins:[{name:"本地审查路由",setup(b){
 b.onResolve({filter:/^next\/(navigation|link|dynamic)$/},args=>({path:args.path,namespace:"test-next"}));
 b.onLoad({filter:/.*/,namespace:"test-next"},args=>({resolveDir:process.cwd(),loader:"tsx",contents:args.path.endsWith("navigation")?`import {useMemo} from 'react';const router={push:(url)=>{location.href=url},replace:(url)=>{location.href=url},refresh:()=>{}};export const useRouter=()=>router;export const useSearchParams=()=>useMemo(()=>new URLSearchParams(location.search),[]);export const usePathname=()=>location.pathname;`:args.path.endsWith("link")?`import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`:`import React,{lazy,Suspense} from 'react';export default function dynamic(load){const C=lazy(load);return props=><Suspense fallback={null}><C {...props}/></Suspense>}`}));
 }}]});
 const chunks=resolve(".next/static/chunks"),css=readdirSync(chunks).filter(f=>f.endsWith(".css")).map(f=>readFileSync(resolve(chunks,f),"utf8")).join("\n");
 server=createServer((req,res)=>{if(req.url==="/bundle.js"){res.setHeader("Content-Type","text/javascript; charset=utf-8");res.end(result.outputFiles[0].contents);}else if(req.url==="/style.css"){res.setHeader("Content-Type","text/css; charset=utf-8");res.end(css);}else{res.setHeader("Content-Type","text/html; charset=utf-8");res.end('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');}});
 await new Promise<void>(done=>server.listen(0,"127.0.0.1",done));const address=server.address();if(!address||typeof address==="string")throw Error("审查服务器未启动");origin=`http://127.0.0.1:${address.port}`;
});
test.afterAll(async()=>{if(server)await new Promise<void>((done,reject)=>server.close(error=>error?reject(error):done()));});
function state(){return {product:{id:"review",sku:"REVIEW",name:"本地审查",category:"柜",assets:[{id:"photo",width:512,height:512}]},conversationAssets:[],settings:{agentId:models.find(m=>m.kind==="agent")!.id,imageId:models.find(m=>m.kind==="image")!.id,imageIds:[models.find(m=>m.kind==="image")!.id],auto:true,resolution:"2K",webEnabled:false},categories:[],searches:[],pack:{slots:[]},agent:{session:{id:"session",mode:"quick",running:false,confirmedPack:false,confirmedProfileId:null},profile:emptyProfile(),understanding:{percent:0},costs:{llmUsd:0,imagesUsd:0,searchUsd:0,estimated:false},cards:[],messages:[],tools:[],documents:[]}};}
async function intercept(page:Page,handler:(path:string,request:Request)=>Promise<unknown>,role="admin"){
 await page.route("**/*",async route=>{const request=route.request(),url=new URL(request.url());if(url.origin!==origin)return route.abort();if(!url.pathname.startsWith("/api/"))return route.continue();let result=await handler(url.pathname,request);if(result===undefined){if(url.pathname==="/api/auth/session")result={user:{id:"test-user",name:"本地审查",role},expires:"2099-01-01T00:00:00Z"};else if(url.pathname==="/api/studio/saved-references")result=[];else if(url.pathname==="/api/studio/models")result={models};else result={error:"未模拟路径："+url.pathname};}const response=result as {status?:number;json?:unknown};return route.fulfill(typeof response.status==="number"?response:{status:200,json:result});});
}
test("识别失败后刷新不自动重试，保留手动入口",async({page})=>{
 let inspect=0;const snapshot=state();await intercept(page,async(path,request)=>{
  if(path.endsWith("/canvas"))return {layout:{version:1,nodes:[],notes:[],hiddenIds:[],viewport:null},revision:0,canWrite:true};
  if(path==="/api/studio/review"){if(request.method()==="POST"){if(request.postDataJSON().action==="inspect"){inspect++;return {status:503,json:{error:"模拟识别失败"}};}return {ok:true};}return snapshot;}
 });
 await page.goto(origin+"/workspace?sku=review&init=1");await expect.poll(()=>inspect).toBe(1);await expect(page).not.toHaveURL(/init=1/);await page.reload();await expect(page.getByRole("button",{name:"识别实拍与产品资料",exact:true})).toBeEnabled();expect(inspect).toBe(1);
});
test("首页响应丢失后重试沿用同一提交编号",async({page})=>{
 const posts:string[]=[];await intercept(page,async(path,request)=>{
  if(path==="/api/studio"&&request.method()==="POST"){posts.push(request.postData()??"");return posts.length===1?{status:500,json:{error:"模拟创建已保存，但响应未确认"}}:{productId:"review",results:[]};}
  if(path.endsWith("/canvas"))return {layout:{version:1,nodes:[],notes:[],hiddenIds:[],viewport:null},revision:0,canWrite:true};
  if(path==="/api/studio/review")return request.method()==="POST"?{ok:true}:state();
 });
 await page.goto(origin+"/");await page.getByLabel("首页创作要求").fill("为柜子做场景图");await page.getByRole("button",{name:"发送并进入工作台",exact:true}).click();await expect.poll(()=>posts.length).toBe(1);await expect(page.getByText("模拟创建已保存，但响应未确认",{exact:true})).toBeVisible();await page.getByRole("button",{name:"发送并进入工作台",exact:true}).click();await expect.poll(()=>posts.length).toBe(2);
 const keys=posts.map(body=>/name="requestKey"\r\n\r\n([^\r\n]+)/.exec(body)?.[1]);expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);expect(keys[1]).toBe(keys[0]);
});
test("只读账号禁用识别、上传、模型和生成操作",async({page})=>{
 let rejected=0;await intercept(page,async(path,request)=>{
  if(path.endsWith("/canvas"))return {layout:{version:1,nodes:[],notes:[],hiddenIds:[],viewport:null},revision:0,canWrite:false};
  if(path==="/api/studio/review"){if(request.method()==="POST"){rejected++;return {status:403,json:{error:"只读成员不能修改商品或生成图片"}};}return state();}
 },"viewer");await page.goto(origin+"/workspace?sku=review");const button=page.getByRole("button",{name:"识别实拍与产品资料",exact:true});await expect(button).toBeDisabled();await expect(page.getByLabel("工作台创作要求")).toBeDisabled();await expect(page.getByRole("button",{name:"单张生图",exact:true})).toBeDisabled();await expect(page.getByRole("button",{name:"智能体模型",exact:true})).toBeDisabled();expect(rejected).toBe(0);
});
test("联网设置即时保存，刷新恢复已保存的选择",async({page})=>{
 let writes=0;const saved=state();await intercept(page,async(path,request)=>{
  if(path.endsWith("/canvas"))return {layout:{version:1,nodes:[],notes:[],hiddenIds:[],viewport:null},revision:0,canWrite:true};
  if(path==="/api/studio/review"){if(request.method()==="POST"){writes++;Object.assign(saved.settings,request.postDataJSON().data);return {ok:true};}return saved;}
 });await page.goto(origin+"/workspace?sku=review");await expect(page.getByText("布局已保存",{exact:true})).toBeAttached();const toggle=page.getByRole("switch",{name:"联网",exact:true});await expect(toggle).toHaveAttribute("aria-checked","false");await toggle.click();await expect(toggle).toHaveAttribute("aria-checked","true");await expect.poll(()=>writes).toBe(1);await page.reload();await expect(toggle).toHaveAttribute("aria-checked","true");expect(writes).toBe(1);
});
test("缺少imageIds的历史会话正常打开并补齐默认值",async({page})=>{
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));const snapshot=state();snapshot.settings={agentId:models.find(m=>m.kind==="agent")!.id} as never;
 await intercept(page,async(path,request)=>{
  if(path.endsWith("/canvas"))return {layout:{version:1,nodes:[],notes:[],hiddenIds:[],viewport:null},revision:0,canWrite:true};
  if(path==="/api/studio/review")return request.method()==="POST"?{ok:true}:snapshot;
 });await page.goto(origin+"/workspace?sku=review");await expect(page.getByRole("button",{name:"识别实拍与产品资料",exact:true})).toBeVisible();expect(errors).toEqual([]);
});
test("KIE卡片的智能体测试标记实际ZenMux线路",async({page})=>{
 let requested:unknown;await intercept(page,async(path,request)=>{
  if(path==="/api/admin/gateways/test"){requested=request.postDataJSON();return {provider:"zenmux",fallback:false,message:"模拟ZenMux结果"};}
  if(path==="/api/admin/gateways")return {preference:"kie",gateways:[],routes:[]};
 });await page.goto(origin+"/gateway");await page.locator(".gateway-card").filter({has:page.getByRole("heading",{name:"KIE",exact:true})}).getByRole("button",{name:"连通性测试 · LLM（ZenMux）",exact:true}).click();await expect(page.getByText("ZenMux：模拟ZenMux结果",{exact:true})).toBeVisible();expect(requested).toMatchObject({kind:"llm"});
});
test("Listing拆解成功后列表失败只重读，重传沿用编号",async({page})=>{
 const folder=resolve(".local/review-listing-folder");await mkdir(folder,{recursive:true});await writeFile(resolve(folder,"scene.png"),await sharp({create:{width:32,height:32,channels:3,background:"white"}}).png().toBuffer());
 let posts=0;const keys:string[]=[];await intercept(page,async(path,request)=>{
  if(path==="/api/studio/library/import"){posts++;keys.push(/name="requestKey"\r\n\r\n([^\r\n]+)/.exec(request.postData()??"")?.[1]??"");return {id:"draft-replay",type:"case",name:"已完成拆解",status:"draft",categories:["收纳柜"],content:{isListingImport:true,summary:"本地待审核",entries:[],originalImageRefs:[]}};}
  if(path==="/api/studio/library")return posts?{status:503,json:{error:"模拟导入后的列表读取失败"}}:[];
 });await page.goto(origin+"/library");await page.getByRole("tab",{name:"品类经验",exact:true}).click();await page.getByLabel("导入品类",{exact:true}).fill("收纳柜");await page.getByLabel("选择Listing文件夹",{exact:true}).setInputFiles(folder);await expect(page.getByText("已完成拆解 · 待审核",{exact:false})).toBeVisible();await page.getByRole("button",{name:"刷新经验列表",exact:true}).click();expect(posts).toBe(1);await page.getByLabel("选择Listing文件夹",{exact:true}).setInputFiles(folder);await expect.poll(()=>posts).toBe(2);expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);expect(keys[1]).toBe(keys[0]);
});

test("设置保存失败显示重试，刷新后恢复草稿并继续保存",async({page})=>{
 let offline=true,writes=0;const saved=state();
 await intercept(page,async(path,request)=>{
  if(path.endsWith("/canvas"))return {layout:{version:1,nodes:[],notes:[],hiddenIds:[],viewport:null},revision:0,canWrite:true};
  if(path==="/api/studio/review"){if(request.method()==="POST"){writes++;if(offline)return {status:503,json:{error:"模拟设置保存离线"}};Object.assign(saved.settings,request.postDataJSON().data);return {ok:true};}return saved;}
 });
 await page.goto(origin+"/workspace?sku=review");const toggle=page.getByRole("switch",{name:"联网",exact:true});await expect(toggle).toHaveAttribute("aria-checked","false");await toggle.click();
 await expect(page.getByRole("button",{name:"重试保存设置",exact:true})).toBeVisible();expect(saved.settings.webEnabled).toBe(false);
 offline=false;await page.reload();await expect(toggle).toHaveAttribute("aria-checked","true");await expect.poll(()=>saved.settings.webEnabled).toBe(true);expect(writes).toBeGreaterThanOrEqual(2);
});

test("历史修改报价不再显示，报价后的警告仍保留",async({page})=>{
 const saved=state();saved.agent.messages=[{id:"old-price",role:"system",content:{text:"本次修改预计 $0.03（估），提交后开始。"}},{id:"old-warning",role:"system",content:{text:"本次修改预计 $0.04（估），提交后开始。\n参考图超出上限"}}] as never;
 await intercept(page,async(path,request)=>{
  if(path.endsWith("/canvas"))return {layout:{version:1,nodes:[],notes:[],hiddenIds:[],viewport:null},revision:0,canWrite:true};
  if(path==="/api/studio/review")return request.method()==="POST"?{ok:true}:saved;
 });
 await page.goto(origin+"/workspace?sku=review");await expect(page.getByText("参考图超出上限",{exact:true})).toBeVisible();await expect(page.getByText(/本次修改预计/)).toHaveCount(0);
});
