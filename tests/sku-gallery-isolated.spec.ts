import {test,expect} from "@playwright/test";
import {build} from "esbuild";
import {createServer,type Server} from "node:http";
import {readFileSync,readdirSync} from "node:fs";
import {resolve} from "node:path";
let server:Server,origin:string;
test.beforeAll(async()=>{
 const result=await build({entryPoints:["tests/fixtures/sku-gallery-browser.tsx"],bundle:true,write:false,platform:"browser",format:"iife",jsx:"automatic",define:{"process.env.NODE_ENV":'"development"',"process.env":'{}'},plugins:[{name:"隔离路由",setup(b){
  b.onResolve({filter:/^next\/(navigation|link|dynamic)$/},args=>({path:args.path,namespace:"test-next"}));
  b.onLoad({filter:/.*/,namespace:"test-next"},args=>({resolveDir:process.cwd(),loader:"tsx",contents:args.path.endsWith("navigation")?`const router={push:()=>{},replace:()=>{}};export const useRouter=()=>router;export const useSearchParams=()=>new URLSearchParams(location.search);export const usePathname=()=>location.pathname;`:args.path.endsWith("link")?`import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`:`import React from 'react';export default function dynamic(){return ()=>null}`}));
 }}]});
 const chunks=resolve(".next/static/chunks"),css=readdirSync(chunks).filter(f=>f.endsWith(".css")).map(f=>readFileSync(resolve(chunks,f),"utf8")).join("\n");
 server=createServer((req,res)=>{if(req.url==="/bundle.js"){res.setHeader("Content-Type","text/javascript");res.end(result.outputFiles[0].contents);}else if(req.url==="/style.css"){res.setHeader("Content-Type","text/css");res.end(css);}else{res.setHeader("Content-Type","text/html");res.end('<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');}});
 await new Promise<void>(done=>server.listen(0,"127.0.0.1",done));const address=server.address();if(!address||typeof address==="string")throw Error("测试服务未启动");origin=`http://127.0.0.1:${address.port}`;
});
test.afterAll(async()=>{if(server)await new Promise<void>((done,reject)=>server.close(error=>error?reject(error):done()));});
test("SKU卡片删除：取消不请求、失败保留、确认移除、撤销恢复与按钮权限（全部API模拟）",async({page})=>{
 const products=[{id:"one",sku:"TEST-ONE",name:"可删除项目",category:"狗笼",canDelete:true,assets:[]},{id:"two",sku:"TEST-TWO",name:"只读项目",category:"柜",canDelete:false,assets:[]}];
 let deleted=false,deletes=0,restores=0,fail=true;const errors:string[]=[],unexpected:string[]=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.route("**/*",async route=>{
  const request=route.request(),url=new URL(request.url());if(url.origin!==origin){unexpected.push(url.origin);await route.abort();return;}
  const path=url.pathname;if(!path.startsWith("/api/")){await route.continue();return;}
  if(path==="/api/auth/session")return route.fulfill({json:{user:{name:"隔离测试",role:"admin"},expires:"2099-01-01T00:00:00Z"}});
  if(path==="/api/studio/models")return route.fulfill({json:{models:[]}});
  if(path==="/api/studio")return route.fulfill({json:products.filter(p=>!deleted||p.id!=="one")});
  if(path==="/api/products/one"){
   if(request.method()==="DELETE"){
    deletes++;expect(request.postDataJSON()).toEqual({sku:"TEST-ONE"});
    if(fail){fail=false;return route.fulfill({status:409,json:{error:"项目有正在执行的生成或识别任务，请等待完成后再删除"}});}
    deleted=true;return route.fulfill({json:{id:"one",deleted:true}});
   }
   if(request.method()==="POST"){expect(request.postDataJSON()).toEqual({action:"restore"});restores++;deleted=false;return route.fulfill({json:{id:"one",deleted:false}});}
  }
  unexpected.push(path);await route.abort();
 });
 await page.goto(origin+"/skus");const button=page.getByRole("button",{name:"项目操作 可删除项目",exact:true});await expect(button).toBeAttached();
 await expect(button).toHaveCSS("opacity","0");await expect(button).toHaveCSS("border-style","none");await expect(button).toHaveCSS("box-shadow","none");
 await expect(page.getByRole("button",{name:"项目操作 只读项目",exact:true})).toHaveCount(0);
 const card=page.locator(".p-sku-card").filter({hasText:"可删除项目"});
 await card.hover();await expect(button).toHaveCSS("opacity","1");
 const cover=await card.locator(".p-sku-cover").boundingBox(),control=await button.boundingBox();expect(control!.y).toBeGreaterThanOrEqual(cover!.y+cover!.height);expect(control!.width).toBe(30);expect(control!.height).toBe(30);
 const openDelete=async()=>{await card.hover();await button.click();await page.getByRole("menuitem",{name:"删除项目",exact:true}).click();};
 await openDelete();await expect(page).toHaveURL(origin+"/skus");await page.getByRole("button",{name:"取消",exact:true}).click();expect(deletes).toBe(0);
 await openDelete();await page.getByRole("button",{name:"确认删除",exact:true}).click();await expect(page.getByText("项目有正在执行的生成或识别任务，请等待完成后再删除",{exact:true})).toBeVisible();await expect(page.locator(".p-sku-card")).toHaveCount(2);expect(deletes).toBe(1);
 await page.getByRole("button",{name:"确认删除",exact:true}).click();await expect(button).toHaveCount(0);expect(deletes).toBe(2);
 await page.getByRole("button",{name:"撤销",exact:true}).click();await expect(button).toBeAttached();expect(restores).toBe(1);
 await page.mouse.move(0,0);await button.focus();await expect(button).toHaveCSS("opacity","1");await button.press("Enter");await expect(page.getByRole("menuitem",{name:"删除项目",exact:true})).toBeVisible();await page.keyboard.press("Escape");
 await page.emulateMedia({colorScheme:"dark"});await expect(page.locator("html")).toHaveClass(/dark/);await card.hover();await button.click();await expect(page.getByRole("menuitem",{name:"删除项目",exact:true})).toBeVisible();await page.keyboard.press("Escape");
 await page.setViewportSize({width:390,height:844});await page.mouse.move(0,0);await expect(button).toHaveCSS("opacity","1");await expect(button).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();expect(errors).toEqual([]);expect(unexpected).toEqual([]);
});
