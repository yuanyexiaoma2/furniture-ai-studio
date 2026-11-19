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
 b.onLoad({filter:/.*/,namespace:"test-next"},args=>({resolveDir:process.cwd(),loader:"tsx",contents:args.path.endsWith("navigation")?`
 import {useMemo,useSyncExternalStore} from 'react';
 function subscribe(listener){window.addEventListener('popstate',listener);return ()=>window.removeEventListener('popstate',listener)}
 function navigate(url,method){history[method](null,'',url);window.dispatchEvent(new PopStateEvent('popstate'))}
 const router={push:(url)=>navigate(url,'pushState'),replace:(url)=>navigate(url,'replaceState'),refresh:()=>{}};
 export const useRouter=()=>router;
 export const useSearchParams=()=>{const search=useSyncExternalStore(subscribe,()=>location.search);return useMemo(()=>new URLSearchParams(search),[search]);};
 export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname);
 `:args.path.endsWith("link")?`import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`:`import React,{lazy,Suspense} from 'react';export default function dynamic(load){const C=lazy(load);return props=><Suspense fallback={null}><C {...props}/></Suspense>}`}));
 }}]});
 const chunks=resolve(".next/static/chunks"),css=readdirSync(chunks).filter(f=>f.endsWith(".css")).map(f=>readFileSync(resolve(chunks,f),"utf8")).join("\n")+readFileSync("src/styles/creative/workspace.css","utf8")+readFileSync("src/styles/creative/home.css","utf8");
 server=createServer((req,res)=>{if(req.url==="/bundle.js"){res.setHeader("Content-Type","text/javascript; charset=utf-8");res.end(result.outputFiles[0].contents);}else if(req.url==="/style.css"){res.setHeader("Content-Type","text/css; charset=utf-8");res.end(css);}else{res.setHeader("Content-Type","text/html; charset=utf-8");res.end('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');}});
 await new Promise<void>(done=>server.listen(0,"127.0.0.1",done));const address=server.address();if(!address||typeof address==="string")throw Error("审查服务器未启动");origin=`http://127.0.0.1:${address.port}`;
});
test.afterAll(async()=>{if(server)await new Promise<void>((done,reject)=>server.close(error=>error?reject(error):done()));});
function state(){return {product:{id:"review",sku:"REVIEW",name:"本地审查",category:"柜",assets:[]},conversationAssets:[],settings:{agentId:models.find(m=>m.kind==="agent")!.id,imageId:models.find(m=>m.kind==="image")!.id,imageIds:[models.find(m=>m.kind==="image")!.id],auto:true,resolution:"2K",webEnabled:false},categories:[],searches:[],pack:{slots:[]},agent:{session:{id:"session",mode:"quick",running:false,confirmedPack:false,confirmedProfileId:null},profile:emptyProfile(),understanding:{percent:0},costs:{llmUsd:0,imagesUsd:0,searchUsd:0,estimated:false},cards:[],messages:[],tools:[],documents:[]}};}
async function intercept(page:Page,handler:(path:string,request:Request)=>Promise<unknown>,role="admin"){
 await page.route("**/*",async route=>{const request=route.request(),url=new URL(request.url());if(url.origin!==origin)return route.abort();if(/^\/design-preview\/home-banana\/[a-z-]+\.webp$/.test(url.pathname))return route.fulfill({status:200,contentType:"image/webp",body:readFileSync("public"+url.pathname)});if(url.pathname.startsWith("/design-preview/")||url.pathname.startsWith("/api/assets/"))return route.fulfill({status:200,contentType:"image/webp",body:readFileSync("public/design-preview/sofa.webp")});if(!url.pathname.startsWith("/api/"))return route.continue();let result=await handler(url.pathname,request);if(result===undefined){if(url.pathname==="/api/auth/session")result={user:{id:"test-user",name:"本地审查",role},expires:"2099-01-01T00:00:00Z"};else if(url.pathname==="/api/studio/saved-references")result=[];else if(url.pathname==="/api/studio/models")result={models};else result={error:"未模拟路径："+url.pathname};}const response=result as {status?:number;json?:unknown};return route.fulfill(typeof response.status==="number"?response:{status:200,json:result});});
}

async function fixture(page:Page,role="admin",hidden=false){
 const snapshot=state(),calls:string[]=[];
 snapshot.pack.slots=[{id:"slot",name:"客厅场景",slotType:"scene",method:"manual_upload",candidateCount:1,finalAssetId:null,jobs:[{id:"generation",status:"success",retriedById:null,assets:[{id:"image",width:512,height:512}],input:{generationMode:"direct"},costUsd:0,reservedUsd:0,provider:"simulation",model:"本地模拟"}]}] as never;
 await intercept(page,async(path,request)=>{
  if(request.method()==="POST")calls.push(request.postDataJSON()?.action??"post");
  if(path==="/api/studio")return [{id:"review",name:"当前柜子",sku:"REVIEW"},{id:"empty",name:"空项目",sku:"EMPTY"}];
  if(path==="/api/studio/review")return request.method()==="GET"?snapshot:{ok:true};
  if(path==="/api/studio/empty")return state();
  if(path.endsWith("/canvas"))return {layout:{version:1,nodes:[],notes:[],hiddenIds:hidden?["image"]:[],viewport:null},revision:0,canWrite:role!=="viewer"};
 },role);
 return calls;
}

test("五张首页卡片在亮暗主题及窄屏可见，套图直接打开画布并带入首页草稿",async({page})=>{
 const calls=await fixture(page);await page.goto(origin+"/");
 for(const theme of ["亮色","暗色"]){await page.setViewportSize({width:1440,height:900});await page.getByLabel(theme+"主题",{exact:true}).click();for(const width of [1440,390]){await page.setViewportSize({width,height:900});await expect(page.locator(".home-tool-card")).toHaveCount(5);await expect.poll(()=>page.locator(".home-tool-cover img").evaluateAll(images=>images.every(image=>image instanceof HTMLImageElement&&image.complete&&image.naturalWidth>0&&image.src.includes("/home-banana/")))).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);const grid=await page.locator(".home-tools-grid").evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(" ").length);expect(grid).toBe(width===390?2:5);await expect(page.locator(".home-tool-caption p,.home-tool-tag,.home-tool-cover span")).toHaveCount(0);expect(await page.locator(".home-tool-cover img").evaluateAll(images=>images.every(image=>getComputedStyle(image).objectFit==="contain"&&/\/(refine-before|refine-wide|expand|direct-entryway-wide|pack-stairway-wide|pack-foyer-wide|recolor|cutout)\.webp$/.test(image.getAttribute("src")??"")))).toBe(true);}}
 const fitted=page.locator(".home-tool-cover-pack img,.home-tool-cover-direct img");
 await expect(fitted).toHaveCount(5);
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});
  expect(await fitted.evaluateAll(images=>images.every(image=>{
   const img=image as HTMLImageElement, box=img.getBoundingClientRect();
   return img.naturalWidth===1000&&img.naturalHeight===750&&Math.abs(box.width-box.height*4/3)<1;
  }))).toBe(true);
 }
 await page.mouse.move(0,0);const reveal=page.locator(".home-tool-cover-recolor .home-banana-after");await expect.poll(()=>reveal.evaluate(el=>getComputedStyle(el).clipPath)).toContain("50%");await page.getByRole("button",{name:"同款换色",exact:true}).hover();await expect.poll(()=>reveal.evaluate(el=>getComputedStyle(el).clipPath)).toContain("28%");await page.mouse.move(0,0);await expect.poll(()=>reveal.evaluate(el=>getComputedStyle(el).clipPath)).toContain("50%");
 await page.getByLabel("首页创作要求").fill("保留我的创作要求");
 await page.getByLabel("首页上传实拍").setInputFiles("public/design-preview/home-banana/refine-before.webp");
 let filePickerOpened=false;
 page.on("filechooser",()=>{filePickerOpened=true;});
 await page.getByRole("button",{name:"套图生成",exact:true}).click();
 await expect(page).toHaveURL(/\/workspace\?tool=pack$/);
 await expect(page.getByRole("heading",{name:"套图生成",exact:true})).toBeVisible();
 await expect(page.getByLabel("工作台创作要求")).toHaveValue("保留我的创作要求");
 await expect(page.getByRole("list",{name:"套图素材"})).toContainText("refine-before.webp");
 await expect(page.getByRole("button",{name:"开始做套图",exact:true})).toBeEnabled();
 expect(filePickerOpened).toBe(false);expect(calls).toEqual([]);
});

test("换色、扩图和抠图卡片打开相应面板，取消不会提交生成",async({page})=>{
 const calls=await fixture(page);
 for(const [name,tool,title] of [["同款换色","recolor","同款换色 / 材质"],["智能扩图","expand","扩展画面"],["产品抠图","cutout","修改这张图"]]){
  await page.goto(origin+"/");await page.getByRole("button",{name,exact:true}).click();await expect(page.getByLabel("上传新产品原图")).toBeAttached();await page.getByRole("button",{name:"从历史作品选择"}).click();await page.getByLabel("功能目标产品").selectOption("review");await page.getByRole("button",{name:"客厅场景 · 图片 1",exact:true}).click();await page.getByRole("button",{name:tool==="expand"?"进入扩图":"进入修改",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:title,exact:true});await expect(dialog).toBeVisible();await expect.poll(()=>new URL(page.url()).searchParams.has("tool")).toBe(false);
  if(tool==="cutout")await expect(page.getByLabel("本次修改要求")).toHaveValue(/移除背景/);
  if(tool==="recolor")await expect(page.getByLabel("目标颜色和材质")).toBeVisible();
  await (tool==="expand"?page.getByLabel("取消扩图"):page.getByRole("button",{name:"暂不修改",exact:true})).click();await expect(dialog).not.toBeVisible();
 }
 expect(calls.filter(c=>!["settings"].includes(c))).toEqual([]);
});

test("单张卡片直接打开无Agent入口，空项目提示明确，只读禁用",async({page})=>{
 const calls=await fixture(page);await page.goto(origin+"/");await page.getByRole("button",{name:"单张生图",exact:true}).click();await expect(page.getByRole("heading",{name:"单张生图",exact:true})).toBeVisible();await expect(page.getByLabel("上传新产品参考图")).toBeAttached();expect(calls).toEqual([]);
 await page.goto(origin+"/");await page.getByRole("button",{name:"智能扩图",exact:true}).click();await page.getByRole("button",{name:"从历史作品选择"}).click();await page.getByLabel("功能目标产品").selectOption("empty");await expect(page.getByText("这个产品还没有可处理的生成图。可以先打开项目继续创作。")).toBeVisible();await expect(page.getByRole("button",{name:"打开项目",exact:true})).toBeEnabled();
 await page.unrouteAll();await fixture(page,"viewer");await page.goto(origin+"/");for(const button of await page.locator(".home-tool-card").all())await expect(button).toBeDisabled();
});

test("入口恢复隐藏的目标图；无效目标不会打开错误图片",async({page})=>{
 const calls=await fixture(page,"admin",true);await page.goto(origin+"/workspace?sku=review&tool=recolor&image=image");await expect(page.getByRole("dialog",{name:"同款换色 / 材质",exact:true})).toBeVisible();await page.getByRole("button",{name:"暂不修改",exact:true}).click();
 await page.goto(origin+"/workspace?sku=review&tool=edit&image=missing");await expect(page.getByText("这张图片已不可用，请在画布中重新选择")).toBeVisible();await expect(page.getByRole("dialog",{name:"修改这张图",exact:true})).toHaveCount(0);expect(calls.filter(c=>c!=="settings")).toEqual([]);
});

test("新产品可从四个独立入口上传并提交，扩图冻结范围，失败重试保留设置和幂等号",async({page})=>{
 for(const tool of ["recolor","expand","cutout","direct"]){
  await page.unrouteAll();const requests:Record<string,unknown>[]=[],paths:string[]=[];let uploads=0,submitCount=0;
  await intercept(page,async(path,request)=>{
   paths.push(path);
   if(path==="/api/studio/direct"){
    if(request.headers()["content-type"]?.startsWith("multipart")){uploads++;return {productId:"fresh",results:[{assetId:"uploaded",filename:"new-product.webp"}]};}
    const body=request.postDataJSON();requests.push(body);
    if(body.action==="quote")return {fingerprint:"frozen"};
    if(body.action==="submit"){submitCount++;if(submitCount===1&&tool==="recolor")return {status:503,json:{error:"暂时不可用，请重试"}};return {productId:"fresh",jobId:"new-job"};}
   }
   if(path==="/api/studio/fresh"){const s=state();s.product.id="fresh";return s;}
   if(path.endsWith("/canvas"))return {layout:{version:1,nodes:[],notes:[],hiddenIds:[],viewport:null},revision:0,canWrite:true};
  });
  await page.goto(origin+"/tools/"+tool);
  if(tool==="recolor")await page.getByLabel("目标颜色和材质",{exact:true}).fill("黑色木纹");
  if(tool==="direct")await page.getByLabel("图片处理要求").fill("把新产品放在温暖玄关里");
  await page.getByLabel(tool==="direct"?"上传新产品参考图":"上传新产品原图",{exact:true}).setInputFiles("public/design-preview/home-banana/refine-before.webp");
  await expect(page.getByAltText("新产品原图",{exact:true})).toBeVisible();expect(new URL(page.url()).pathname).toBe("/tools/"+tool);expect(uploads).toBe(1);expect(requests).toEqual([]);
  if(tool==="expand"){
   await page.getByRole("button",{name:"设置扩图范围"}).click();const dialog=page.getByRole("dialog",{name:"扩展画面"});await expect(dialog).toBeVisible();await dialog.getByRole("button",{name:"16:9",exact:true}).click();await dialog.getByRole("button",{name:"确认",exact:true}).click();await expect(dialog).not.toBeVisible();expect(requests).toEqual([]);
  }
  const button=page.getByRole("button",{name:{recolor:"生成新配色",expand:"开始扩图",cutout:"开始抠图",direct:"生成一张"}[tool],exact:true});
  await button.click();
  if(tool==="recolor"){await expect(page.getByRole("alert")).toContainText("暂时不可用");await expect(page.getByLabel("目标颜色和材质",{exact:true})).toHaveValue("黑色木纹");await expect(page.getByAltText("新产品原图",{exact:true})).toBeVisible();await button.click();}
  await expect.poll(()=>new URL(page.url()).pathname).toBe("/workspace");
  const submitted=requests.filter(r=>r.action==="submit") as {selection:{productId:string;referenceAssetIds:string[];edit?:{tool:string;sourceAssetId:string;expansion?:unknown};prompt:string};requestKey:string}[];
  expect(submitted[0].selection.productId).toBe("fresh");expect(submitted[0].requestKey).toBe(submitted.at(-1)?.requestKey);
  if(tool==="direct"){expect(submitted[0].selection.referenceAssetIds).toEqual(["uploaded"]);expect(submitted[0].selection.prompt).toContain("温暖玄关");}
  else {expect(submitted[0].selection.edit?.tool).toBe(tool);expect(submitted[0].selection.edit?.sourceAssetId).toBe("uploaded");if(tool==="expand")expect(submitted[0].selection.edit?.expansion).toBeTruthy();}
  expect(paths.some(p=>p.includes("/agent")||p.endsWith("/inspect"))).toBe(false);
 }
});

test("新工具支持纯文字生成、上传失败重试、只读保护及窄屏布局",async({page})=>{
 let failed=true;const submissions:Record<string,unknown>[]=[];
 await intercept(page,async(path,request)=>{
  if(path==="/api/studio/direct"){
   if(request.headers()["content-type"]?.startsWith("multipart")){if(failed){failed=false;return {status:503,json:{error:"上传失败，请重试"}};}return {productId:"fresh",results:[{assetId:"uploaded",filename:"new.webp"}]};}
   const body=request.postDataJSON();submissions.push(body);return body.action==="quote"?{fingerprint:"f"}:{productId:"fresh",jobId:"job"};
  }
  if(path==="/api/studio/fresh"){const s=state();s.product.id="fresh";return s;}
  if(path.endsWith("/canvas"))return {layout:{version:1,nodes:[],notes:[],hiddenIds:[],viewport:null},revision:0,canWrite:true};
 });
 await page.goto(origin+"/tools/cutout");await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 const input=page.getByLabel("上传新产品原图",{exact:true});await input.setInputFiles("public/design-preview/home-banana/refine-before.webp");await expect(page.getByRole("alert")).toContainText("上传失败");await input.setInputFiles("public/design-preview/home-banana/refine-before.webp");await expect(page.getByAltText("新产品原图",{exact:true})).toBeVisible();
 await page.goto(origin+"/tools/direct");await page.getByLabel("图片处理要求").fill("一张白色椅子产品图");await page.getByLabel("工具生图模型").selectOption("image-banana");await page.getByRole("button",{name:"生成一张",exact:true}).click();await expect.poll(()=>new URL(page.url()).pathname).toBe("/workspace");expect((submissions[0].selection as {referenceAssetIds:string[]}).referenceAssetIds).toEqual([]);
 await page.unrouteAll();await fixture(page,"viewer");await page.goto(origin+"/tools/cutout");await expect(page.getByLabel("上传新产品原图",{exact:true})).toBeDisabled();await expect(page.getByRole("button",{name:"开始抠图"})).toBeDisabled();
});

test("工作台单张生成首次上传保留提示词、模型、参考图且不提前跳转",async({page})=>{
 await intercept(page,async(path,request)=>path==="/api/studio/direct"&&request.headers()["content-type"]?.startsWith("multipart")?{productId:"fresh",results:[{assetId:"uploaded",filename:"new.webp"}]}:undefined);
 await page.goto(origin+"/workspace?tool=direct");const dialog=page.getByRole("dialog",{name:"单张生图",exact:true});await expect(dialog).toBeVisible();await page.getByLabel("单张图片描述").fill("保留上传前的描述");await page.getByLabel("单张图片分辨率").selectOption("4K");await dialog.locator('input[type="file"]').setInputFiles("public/design-preview/home-banana/refine-before.webp");await expect(page.getByLabel("参考 new.webp",{exact:true})).toBeChecked();await expect(page.getByLabel("单张图片描述")).toHaveValue("保留上传前的描述");await expect(page.getByLabel("单张图片分辨率")).toHaveValue("4K");expect(new URL(page.url()).searchParams.has("sku")).toBe(false);
});

test("新人在套图画布准备实拍，失败可重试，确认方案后生成并选图修改",async({page})=>{
 const snapshot=state(),actions:string[]=[];
 const creations:string[]=[];
 let planned=false;
 await intercept(page,async(path,request)=>{
  if(path==="/api/studio"&&request.method()==="POST"){
   const payload=request.postData()??"";
   creations.push(payload);
   if(creations.length===1)return {status:503,json:{error:"连接中断，请重试"}};
   snapshot.product.assets=[{id:"photo",width:512,height:512}] as never;
   return {productId:"review",results:[],initializationReady:false};
  }
  if(path.endsWith("/canvas"))return {layout:{version:1,nodes:[],notes:[],hiddenIds:[],viewport:null},revision:0,canWrite:true};
  if(path!=="/api/studio/review")return;
  if(request.method()==="GET")return snapshot;
  const {action,data}=request.postDataJSON();
  if(action!=="settings")actions.push(action);
  if(action==="inspect")snapshot.agent.cards=[{id:"category",kind:"category",status:"pending",data:{categoryId:"cabinet",name:"玄关柜"}}] as never;
  if(action==="category"){
   snapshot.agent.cards=[{id:"profile",kind:"profile",status:"pending",data:{profile:emptyProfile()}}] as never;
   Object.assign(snapshot.settings,{categoryConfirmed:true});
  }
  if(action==="approve"&&data.cardId==="profile"){
   snapshot.agent.cards=[];Object.assign(snapshot.agent.session,{confirmedProfileId:"approved-profile"});
  }
  if(action==="plan")snapshot.agent.cards=[{id:"plan",kind:"pack",status:"pending",data:{reason:"拍摄门厅使用场景",slots:[{name:"门厅",candidateCount:1}]}}] as never;
  if(action==="approve"&&data.cardId==="plan"){
   planned=true;snapshot.agent.cards=[];snapshot.agent.session.confirmedPack=true;
   snapshot.pack.slots=[{id:"slot",name:"门厅",slotType:"scene",goal:"拍摄门厅使用场景",method:"ai_scene",candidateCount:1,finalAssetId:null,jobs:[]}] as never;
  }
  if(action==="generate"){
   expect(planned).toBe(true);expect(data.requestKey).toBeTruthy();
   Object.assign(snapshot.pack.slots[0],{jobs:[{id:"job",status:"success",assets:[{id:"result",width:512,height:512}],input:{},createdAt:"2026-11-19T08:00:00Z"}]});
  }
  return {ok:true};
 });
 await page.setViewportSize({width:390,height:844});
 await page.goto(origin+"/");
 await page.getByRole("button",{name:"套图生成",exact:true}).click();
 await expect(page).toHaveURL(/\/workspace\?tool=pack$/);
 await expect(page.getByRole("tab",{name:"画布",exact:true})).toHaveAttribute("aria-selected","true");
 const start=page.getByRole("button",{name:"开始做套图",exact:true});
 await expect(start).toBeDisabled();
 await page.getByRole("tab",{name:"对话",exact:true}).click();
 await page.getByLabel("工作台创作要求").fill("请做玄关套图");
 await page.getByRole("button",{name:"去画布",exact:true}).click();
 const chooser=page.waitForEvent("filechooser");
 await page.getByRole("button",{name:"添加产品实拍",exact:true}).click();
 await (await chooser).setFiles("public/design-preview/home-banana/refine-before.webp");
 await expect(start).toBeEnabled();
 expect(creations).toEqual([]);expect(actions).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await start.click();
 await expect(page.getByRole("alert")).toContainText("连接中断，请重试");
 await expect(page.getByRole("list",{name:"套图素材"})).toContainText("refine-before.webp");
 await start.click();
 await expect(page).toHaveURL(/\/workspace\?sku=review$/);
 await expect(page.locator(".p-workspace")).toHaveCount(1);
 await expect(page.getByRole("heading",{name:"套图生成",exact:true})).toHaveCount(0);
 const requestKeys=creations.map(body=>/name="requestKey"\r\n\r\n([^\r\n]+)/.exec(body)?.[1]);
 expect(creations).toHaveLength(2);
 expect(requestKeys[0]).toBeTruthy();
 expect(requestKeys[1]).toBe(requestKeys[0]);
 for(const payload of creations){
  expect(payload).toContain("refine-before.webp");
  expect(payload).toContain("请做玄关套图");
 }
 const step=page.locator(".ws-next-step");
 await step.getByRole("button",{name:"识别实拍与产品资料"}).click();
 await expect(step).toContainText("确认产品品类");
 await step.getByRole("button",{name:"查看并继续"}).click();
 await expect(page.locator("#workspace-card-category")).toBeFocused();
 await page.getByRole("button",{name:"是",exact:true}).click();
 await expect(step).toContainText("核对产品档案");
 await step.getByRole("button",{name:"查看并继续"}).click();
 await page.getByRole("button",{name:"确认并保存档案"}).click();
 await page.getByRole("button",{name:"请搭档想场景"}).click();
 await expect(page.getByRole("textbox",{name:"工作台创作要求"})).toHaveValue(/先给建议/);
 expect(actions).toEqual(["inspect","category","approve"]);
 await step.getByRole("button",{name:"规划图包"}).click();
 await expect(step).toContainText("确认套图方案");
 await page.getByRole("button",{name:"确认图包方案"}).click();
 await step.getByRole("button",{name:"生成候选",exact:true}).click();
 await expect(step).toContainText("图片已就绪");
 await step.getByRole("button",{name:"去画布选图"}).click();
 await expect(page.getByRole("tab",{name:"画布",exact:true})).toHaveAttribute("aria-selected","true");
 await page.getByRole("button",{name:"修改这张图",exact:true}).click();
 await expect(page.getByRole("dialog",{name:"修改这张图"}).getByAltText("本次修改原图")).toHaveAttribute("src","/api/assets/result");
 expect(actions).toEqual(["inspect","category","approve","plan","approve","generate"]);
});

test("独立扩图刷新后恢复原图和范围，上传与提交的丢失响应都沿用原请求编号",async({page})=>{
 const uploads:string[]=[],submits:{requestKey:string;selection:Record<string,unknown>}[]=[];
 await intercept(page,async(path,request)=>{
  if(path!=="/api/studio/direct")return;
  if(request.headers()["content-type"]?.startsWith("multipart")){
   const key=/name="requestKey"\r\n\r\n([^\r\n]+)/.exec(request.postData()??"")?.[1];
   expect(key).toMatch(/^[a-f0-9-]{36}$/);
   uploads.push(key!);
   return {productId:"fresh",results:[{assetId:"uploaded",filename:"new.webp"}]};
  }
  const body=request.postDataJSON();
  if(body.action==="quote")return {fingerprint:"frozen"};
  submits.push(body);
  return {status:503,json:{error:"暂未收到生成结果，请重试"}};
 });
 await page.route("**/api/studio/direct",async route=>{
  const request=route.request();
  if(uploads.length||!request.headers()["content-type"]?.startsWith("multipart"))return route.fallback();
  uploads.push(/name="requestKey"\r\n\r\n([^\r\n]+)/.exec(request.postData()??"")?.[1]??"");
  await route.abort("connectionreset");
 });
 await page.goto(origin+"/tools/expand");
 const input=page.getByLabel("上传新产品原图");
 await page.getByLabel("图片处理要求").fill("延续墙面和地板");
 await input.setInputFiles("public/design-preview/home-banana/refine-before.webp");
 await expect(page.getByRole("alert")).toBeVisible();
 await page.reload();
 await input.setInputFiles("public/design-preview/home-banana/refine-before.webp");
 await expect(page.getByAltText("新产品原图",{exact:true})).toBeVisible();
 expect(uploads).toEqual([uploads[0],uploads[0]]);
 await page.getByRole("button",{name:"设置扩图范围"}).click();
 const dialog=page.getByRole("dialog",{name:"扩展画面"});
 await dialog.getByRole("button",{name:"16:9",exact:true}).click();
 await dialog.getByRole("button",{name:"确认",exact:true}).click();
 const submit=page.getByRole("button",{name:"开始扩图"});
 await submit.click();
 await expect(page.getByRole("alert")).toContainText("暂未收到生成结果");
 await page.reload();
 await expect(page.getByAltText("新产品原图",{exact:true})).toBeVisible();
 await expect(page.getByLabel("图片处理要求")).toHaveValue("延续墙面和地板");
 await expect(page.getByRole("button",{name:"调整扩图范围"})).toBeVisible();
 await submit.click();
 await expect(page.getByRole("alert")).toBeVisible();
 expect(submits).toHaveLength(2);expect(submits[1]).toEqual(submits[0]);
 expect(submits[1].selection.productId).toBe("fresh");
 expect(submits[1].selection.edit).toMatchObject({tool:"expand",sourceAssetId:"uploaded",expansion:expect.any(Object)});
});
