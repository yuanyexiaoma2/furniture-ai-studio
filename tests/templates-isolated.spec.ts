import {test,expect,type Page,type Request} from "@playwright/test";
import {build} from "esbuild";
import {createServer,type Server} from "node:http";
import {readFileSync,readdirSync} from "node:fs";
import {resolve} from "node:path";
import {models} from "../src/design-preview/mock/models";
import {emptyProfile} from "../src/lib/profile-rules";
let server:Server,origin:string;
test.beforeAll(async()=>{
 const result=await build({entryPoints:["tests/fixtures/interaction-recovery-browser.tsx"],bundle:true,write:false,platform:"browser",format:"iife",jsx:"automatic",define:{"process.env.NODE_ENV":'"development"',"process.env":'{}'},plugins:[{name:"本地审查路由",setup(b){
 b.onResolve({filter:/^next\/(navigation|link|dynamic)$/},args=>({path:args.path,namespace:"test-next"}));
 b.onLoad({filter:/.*/,namespace:"test-next"},args=>({resolveDir:process.cwd(),loader:"tsx",contents:args.path.endsWith("navigation")?`import {useMemo} from 'react';const router={push:(url)=>{location.href=url},replace:(url)=>{location.href=url},refresh:()=>{}};export const useRouter=()=>router;export const useSearchParams=()=>useMemo(()=>new URLSearchParams(location.search),[]);export const usePathname=()=>location.pathname;`:args.path.endsWith("link")?`import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`:`import React,{lazy,Suspense} from 'react';export default function dynamic(load){const C=lazy(load);return props=><Suspense fallback={null}><C {...props}/></Suspense>}`}));
 }}]});
 const chunks=resolve(".next/static/chunks"),css=readdirSync(chunks).filter(f=>f.endsWith(".css")).map(f=>readFileSync(resolve(chunks,f),"utf8")).join("\n")+readFileSync("src/styles/creative/workspace.css","utf8");
 server=createServer((req,res)=>{if(req.url==="/bundle.js"){res.setHeader("Content-Type","text/javascript; charset=utf-8");res.end(result.outputFiles[0].contents);}else if(req.url==="/style.css"){res.setHeader("Content-Type","text/css; charset=utf-8");res.end(css);}else{res.setHeader("Content-Type","text/html; charset=utf-8");res.end('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');}});
 await new Promise<void>(done=>server.listen(0,"127.0.0.1",done));const address=server.address();if(!address||typeof address==="string")throw Error("审查服务器未启动");origin=`http://127.0.0.1:${address.port}`;
});
test.afterAll(async()=>{if(server)await new Promise<void>((done,reject)=>server.close(error=>error?reject(error):done()));});
function state(){return {product:{id:"review",sku:"REVIEW",name:"本地审查",category:"柜",assets:[]},conversationAssets:[],settings:{agentId:models.find(m=>m.kind==="agent")!.id,imageId:models.find(m=>m.kind==="image")!.id,imageIds:[models.find(m=>m.kind==="image")!.id],auto:true,resolution:"2K",webEnabled:false},categories:[],searches:[],pack:{slots:[]},agent:{session:{id:"session",mode:"quick",running:false,confirmedPack:false,confirmedProfileId:null},profile:emptyProfile(),understanding:{percent:0},costs:{llmUsd:0,imagesUsd:0,searchUsd:0,estimated:false},cards:[],messages:[],tools:[],documents:[]}};}
async function intercept(page:Page,handler:(path:string,request:Request)=>Promise<unknown>,role="admin"){
 await page.route("**/*",async route=>{const request=route.request(),url=new URL(request.url());if(url.origin!==origin)return route.abort();if(!url.pathname.startsWith("/api/"))return route.continue();let result=await handler(url.pathname,request);if(result===undefined){if(url.pathname==="/api/auth/session")result={user:{id:"test-user",name:"本地审查",role},expires:"2099-01-01T00:00:00Z"};else if(url.pathname==="/api/studio/saved-references")result=[];else if(url.pathname==="/api/studio/models")result={models};else result={error:"未模拟路径："+url.pathname};}const response=result as {status?:number;json?:unknown};return route.fulfill(typeof response.status==="number"?response:{status:200,json:result});});
}

const template=()=>({id:"saved-1",version:1,ownerId:"test-user",productId:"old",assetId:"old-image",jobId:"old-job",name:"玄关自然光",purpose:"光线、场景和构图",category:"柜",scene:"玄关",reusablePrompt:"窗边的柜子，留白构图",prompt:"原始旧产品提示词",references:[],model:"mock",resolution:"2K",createdAt:"2026-11-16"});
async function fixture(page:Page,role="admin"){
 const row=template(),snapshot=state();snapshot.product.assets=[{id:"photo",width:100,height:100}] as never;const calls:Record<string,unknown>[]=[],direct:{action:string;selection:{prompt:string;referenceAssetIds:string[];productAssetIds:string[];referencePurpose:string};requestKey?:string}[]=[];
 await intercept(page,async(path,request)=>{
  if(path==="/api/studio/saved-references"){
   if(request.method()==="GET")return [row];const body=request.postDataJSON();calls.push(body);
   if(body.action==="update"){Object.assign(row,body.data);return row;}
   if(body.action==="prepare")return {assetId:"template-copy"};
   if(body.action==="reuse"){snapshot.conversationAssets=[{id:"template-copy",width:100,height:100}] as never;return {assetId:"template-copy"};}
  }
  if(path==="/api/studio/library")return [];
  if(path==="/api/studio")return [{id:"review",sku:"REVIEW",name:"当前柜子",category:"柜"}];
  if(path==="/api/studio/review")return request.method()==="GET"?snapshot:{ok:true};
  if(path.endsWith("/canvas"))return {layout:{version:1,nodes:[],notes:[],hiddenIds:[],viewport:null},revision:0,canWrite:role!=="viewer"};
  if(path==="/api/studio/direct"){const body=request.postDataJSON();direct.push(body);return body.action==="quote"?{fingerprint:"local"}:{productId:"review",jobId:"new-job"};}
  if(path.startsWith("/api/assets/"))return {};
 },role);
 return {row,calls,direct};
}

test("图片模板编辑、筛选、跨页面选择产品后直接生成，提示词和图片用途正确",async({page})=>{
 const {row,calls,direct}=await fixture(page);
 await page.goto(origin+"/library");await expect(page.getByRole("tab",{name:"图片模板",exact:true})).toHaveAttribute("aria-selected","true");
 await page.getByLabel("筛选模板品类").selectOption("柜");await page.getByLabel("筛选模板场景").selectOption("玄关");await page.getByLabel("搜索图片模板").fill("不存在");await expect(page.getByText("没有找到匹配的模板")).toBeVisible();await page.getByLabel("搜索图片模板").fill("");
 await page.getByRole("button",{name:"查看与编辑",exact:true}).click();await page.getByLabel("模板提示词").fill("当前产品摆在明亮玄关，侧面自然光");await page.getByRole("button",{name:"保存模板修改",exact:true}).click();await expect.poll(()=>row.reusablePrompt).toBe("当前产品摆在明亮玄关，侧面自然光");expect(row.prompt).toBe("原始旧产品提示词");
 await page.getByRole("button",{name:"使用模板",exact:true}).click();await page.getByLabel("模板目标产品").selectOption("review");await page.getByRole("button",{name:"进入工作台使用",exact:true}).click();
 await page.getByRole("button",{name:"修改提示词直接生成",exact:true}).click();await expect(page.getByLabel("单张图片描述")).toHaveValue(row.reusablePrompt);await expect(page.getByLabel("使用产品实拍 photo")).toBeChecked();await expect(page.getByLabel("参考 玄关自然光",{exact:true})).toBeChecked();
 await page.getByLabel("单张图片描述").fill("本次生成专用描述");await page.getByRole("button",{name:"生成一张",exact:true}).click();await expect.poll(()=>direct.length).toBe(2);
 expect(direct[1].selection).toMatchObject({prompt:"本次生成专用描述",productAssetIds:["photo"],referenceAssetIds:["template-copy"],referencePurpose:"光线、场景和构图"});expect(row.reusablePrompt).not.toBe("本次生成专用描述");expect(calls.some(c=>c.action==="reuse")).toBe(false);
});

test("模板可取消直接传图；取消弹层不提交任务；Agent适配走另一入口",async({page})=>{
 const {calls,direct}=await fixture(page);await page.goto(origin+"/workspace?sku=review&template=saved-1");await page.getByRole("button",{name:"修改提示词直接生成",exact:true}).click();await page.getByLabel("参考 玄关自然光",{exact:true}).uncheck();await page.getByRole("button",{name:"生成一张",exact:true}).click();await expect.poll(()=>direct.length).toBe(2);expect(direct[1].selection.referenceAssetIds).toEqual([]);expect(direct[1].selection.productAssetIds).toEqual(["photo"]);
 await page.getByRole("button",{name:"模板库",exact:true}).click();await page.getByRole("button",{name:"使用模板",exact:true}).click();await page.getByRole("button",{name:"修改提示词直接生成",exact:true}).click();await page.locator(".ws-edit-footer").getByRole("button",{name:"关闭",exact:true}).click();expect(direct.length).toBe(2);
 await page.getByRole("button",{name:"模板库",exact:true}).click();await page.getByRole("button",{name:"使用模板",exact:true}).click();await page.getByRole("button",{name:"交给搭档适配",exact:true}).click();await expect.poll(()=>calls.some(c=>c.action==="reuse"&&c.withPrompt===true)).toBe(true);expect(direct.length).toBe(2);
});

test("模板界面在亮暗主题和窄屏中使用统一卡片，表单不超出视口",async({page})=>{
 await fixture(page);await page.goto(origin+"/library");await expect(page.getByRole("button",{name:"使用模板",exact:true})).toBeVisible();
 for(const theme of ["亮色","暗色"]){await page.setViewportSize({width:1440,height:900});await page.getByLabel(theme+"主题",{exact:true}).click();for(const width of [1440,390]){await page.setViewportSize({width,height:900});await expect(page.getByRole("button",{name:"使用模板",exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.getByRole("button",{name:"查看与编辑",exact:true}).click();const dialog=page.getByRole("dialog",{name:"图片模板",exact:true});await expect(dialog).toBeVisible();const box=await dialog.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);await page.locator(".ws-edit-footer").getByRole("button",{name:"关闭",exact:true}).click();}}
});

test("只读成员可以看模板和提示词，不能编辑或使用",async({page})=>{
 const {calls}=await fixture(page,"viewer");await page.goto(origin+"/library");await expect(page.getByRole("button",{name:"使用模板",exact:true})).toBeDisabled();await page.getByRole("button",{name:"查看与编辑",exact:true}).click();await expect(page.getByLabel("模板提示词")).toBeDisabled();await expect(page.getByRole("button",{name:"保存模板修改",exact:true})).toBeDisabled();expect(calls).toEqual([]);
});
