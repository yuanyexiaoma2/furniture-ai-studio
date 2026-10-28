/** UI 截图基线：仅拦截浏览器测试数据，不写数据库，也不允许业务 POST 发往服务器。 */
import "dotenv/config";
import {mkdir,readFile,writeFile,rm} from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {chromium,expect,type Page} from "@playwright/test";
import sharp from "sharp";
import {emptyProfile,profileFields,understanding} from "../src/lib/profile-rules";

const args=process.argv.slice(2),option=(key:string,fallback:string)=>args.find(a=>a.startsWith(key+"="))?.slice(key.length+1)??fallback;
if(args.includes("--suite=studio")&&!args.includes("--help")){await import("./ui-snapshots-studio");process.exit(0);}
if(args.includes("--help")){console.log("node --import tsx scripts/ui-snapshots.ts --mode=baseline|compare|capture [--baseline=<目录>] [--output=<目录>] [--allow-size-change] [--small-text]\n默认44个creative状态；--suite=studio补拍旧页36张（基线99f3187）。capture只拍摄不比较，--small-text补拍12种小字状态。所有业务写请求在浏览器拦截。");process.exit(0);}
const mode=option("--mode","compare"),baseURL=option("--base-url","http://localhost:3000"),root=path.resolve(option("--baseline","docs/ui-audit/baseline")),output=path.resolve(option("--output","docs/ui-audit/phase1")),only=option("--only","");
if(!["baseline","compare","capture"].includes(mode))throw Error("mode仅允许baseline、compare或capture");
if(mode==="compare"&&root===output)throw Error("对比输出目录不能覆盖基线目录");
if(!["localhost","127.0.0.1"].includes(new URL(baseURL).hostname))throw Error("仅允许本地服务");
const commit=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
if(mode==="baseline"&&!commit.startsWith("a1e3f51"))throw Error("原始基线必须在a1e3f51上建立");
const destination=mode==="baseline"?root:output;
await mkdir(destination,{recursive:true});
if(mode==="baseline"&&!args.includes("--force")){try{await readFile(path.join(root,"manifest.json"));throw Error("基线已存在；确认覆盖时显式传--force");}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}}
const fixed="2026-10-28T06:00:00.000Z",productId="ui-snapshot-product",photoId="ui-photo",images=["ui-scene-a","ui-scene-b","ui-scene-c"];
const profile=emptyProfile();for(const [i,k]of profileFields.entries())profile[k]={value:["客厅家具","结构与实拍一致","按实拍比例","织物与木质","浅米色","无外露标识","保留外观与部件","舒适坐感、空间搭配","家庭用户","自然简约客厅"][i]??"按实拍确认",status:"confirmed",sources:[],conflicts:[]};
const assets=images.map(id=>({id,width:2048,height:1536}));
const snapshot={product:{id:productId,sku:"UI-SNAPSHOT-01",name:"客厅家具 · 视觉检查",category:"客厅家具",dimensions:"按实拍比例",materials:"织物与木质",colors:"浅米色",sellingPoints:["舒适坐感","空间搭配"],identityTraits:"保留产品完整结构、部件与颜色",assets:[{id:photoId,width:2048,height:1536}],createdAt:fixed,updatedAt:fixed},agent:{session:{id:"ui-session",mode:"quick",autoConfirm:false,stopQuestions:false,confirmedProfileId:"ui-profile",confirmedPack:true,draftRevision:1,running:false},profile,understanding:understanding(profile),messages:[{id:"ui-message-1",role:"user",content:{text:"保留产品外观，规划自然简约的客厅场景。"}},{id:"ui-message-2",role:"assistant",content:{text:"已确认产品特征。请在画布中挑选候选图，再进行局部调整。"}}],cards:[],documents:[],tools:[],costs:{llmUsd:0,imagesUsd:0,searchUsd:0,estimated:false}},settings:{agentId:"agent-zenmux-flash",imageId:"image-banana",imageIds:["image-banana"],auto:false,qualities:{},shootingMode:"quick",categoryConfirmed:true},categories:[],searches:[],pack:{productId,sku:"UI-SNAPSHOT-01",name:"客厅家具 · 视觉检查",photoCount:1,identityVersionId:"ui-identity",packId:"ui-pack",batches:[],slots:[{id:"ui-slot",name:"客厅场景",order:1,slotType:"scene",goal:"自然光线与中性色调",method:"ai_scene",candidateCount:3,aspectRatio:"4:3",finalAssetId:images[0],jobs:[{id:"ui-job",batchId:null,retriedById:null,status:"success",provider:"simulation",model:"截图固定数据",fallback:false,error:null,input:{},costUsd:0,reservedUsd:0,costEstimated:false,credits:0,createdAt:fixed,durationMs:1000,assets}]}]}};
const library=[{id:"ui-pattern",type:"scene_pattern",name:"自然简约客厅",categories:["客厅家具"],source:"截图测试夹具",is_sample:false,status:"ready",content:{roomType:"客厅",light:"柔和自然光",palette:"中性环境"}}];
if(args.includes("--small-text")){
 Object.assign(snapshot.agent,{tools:[{id:"ui-tool",callId:"ui-tool",name:"view_images",status:"success",error:null,result:{analysis:"已核对产品实拍"}}],cards:[{id:"ui-question",kind:"questions",status:"pending",data:{questions:[{question:"请选择这个图位的方向",options:["保留当前方案"]}]}}]});
}
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL==="chromium"?undefined:"chrome",headless:true});
const failures:string[]=[],results:{name:string;width:number;height:number;changedPixels:number;totalPixels:number;differencePercent:number;sha256:string;baselineSize?:{width:number;height:number}}[]=[];
try{
 const login=await browser.newContext(),loginPage=await login.newPage();
 await loginPage.goto(baseURL+"/login");await loginPage.getByLabel("公司邮箱").fill(process.env.ADMIN_EMAIL??"");await loginPage.getByLabel("密码",{exact:true}).fill(process.env.ADMIN_PASSWORD??"");await loginPage.getByRole("button",{name:"进入工作台"}).click();await loginPage.waitForURL(baseURL+"/");
 const auth=await login.storageState();
 const catalog=mode==="baseline"?await(await login.request.get(baseURL+"/api/studio/models")).json():JSON.parse(await readFile(path.join(root,"catalog.json"),"utf8"));
 await writeFile(path.join(destination,"catalog.json"),JSON.stringify(catalog,null,2));
 const adminCatalog=mode==="baseline"?await(await login.request.get(baseURL+"/api/studio/models?admin=1")).json():JSON.parse(await readFile(path.join(root,"admin-catalog.json"),"utf8"));
 await writeFile(path.join(destination,"admin-catalog.json"),JSON.stringify(adminCatalog,null,2));
 await login.close();
 const states=args.includes("--small-text")?["workspace-progress","workspace-history","workspace-save-status"]:["home","skus","workspace-empty","workspace-images","workspace-single","workspace-multi","workspace-mask","workspace-expand","workspace-product","library","admin"];
 for(const width of [1440,390])for(const theme of ["light","dark"])for(const state of states){
  if(only&&!state.includes(only))continue;
  const name=`${state}-${theme}-${width}`,context=await browser.newContext({storageState:auth,viewport:{width,height:width===390?844:1000},deviceScaleFactor:1,locale:"zh-CN",timezoneId:"Asia/Shanghai",colorScheme:theme==="dark"?"dark":"light",reducedMotion:"reduce"}),page=await context.newPage();
  try{
   const pageErrors:string[]=[];page.on("pageerror",e=>pageErrors.push(e.message));
   await page.clock.setFixedTime(new Date(fixed));
   await context.addInitScript(({theme})=>{
    localStorage.clear();localStorage.setItem("furniture-preview-theme",theme);
    // 仅冻结首页80ms打字机在第15次自然更新；其他计时器保持工作。
    const original=window.setInterval.bind(window);window.setInterval=((handler:TimerHandler,delay?:number,...rest:unknown[])=>{if(delay!==80||typeof handler!=="function")return original(handler,delay,...rest);let ticks=0;return original(()=>{if(ticks++<15)handler(...rest);},delay);}) as typeof window.setInterval;
   },{theme});
   let layout={version:1,nodes:[],notes:[],hiddenIds:[],viewport:null} as unknown;
   await context.route("**/api/**",async route=>{
    const req=route.request(),url=new URL(req.url()),p=url.pathname;
    if(p.startsWith("/api/auth/"))return route.continue();
    if(p===`/api/studio/${productId}/canvas`){if(req.method()==="PUT"){if(state==="workspace-save-status")return route.fulfill({status:409,json:{error:"其他窗口已保存布局，请载入最新版本"}});layout=req.postDataJSON().layout;}return route.fulfill({json:{revision:1,layout,canWrite:true}});}
    if(req.method()!=="GET")throw Error("截图禁止业务写请求："+p);
    if(p==="/api/studio/models")return route.fulfill({json:url.searchParams.get("admin")==="1"?adminCatalog:catalog});
    if(p==="/api/studio/library")return route.fulfill({json:library});
    if(p==="/api/studio")return route.fulfill({json:[snapshot.product,{...snapshot.product,id:"ui-product-2",name:"空间搭配 · 对照产品",sku:"UI-SNAPSHOT-02"}]});
    if(p===`/api/studio/${productId}`)return route.fulfill({json:snapshot});
    if(p.startsWith("/api/assets/ui-")){const file=p.endsWith(photoId)?"sofa.webp":p.endsWith("b")?"r3-10.webp":"r3-05.webp";return route.fulfill({body:await readFile(path.resolve("public/design-preview",file)),contentType:"image/webp"});}
    return route.continue();
   });
   const url=state==="home"?"/":state==="skus"?"/skus":state==="library"?"/library":state==="admin"?"/admin/models":state==="workspace-empty"?"/workspace":"/workspace?sku="+productId;
   await page.goto(baseURL+url);await page.waitForLoadState("networkidle");await expect(page.locator(".p-app")).toBeVisible();
   if(state.startsWith("workspace-")){
    if(state!=="workspace-empty")await expect(page.locator(`[data-picture="${images[0]}"]`)).toBeAttached();
    if(width===390)await page.getByRole("tab",{name:"画布",exact:true}).click();
    if(state!=="workspace-empty"){
     await page.getByRole("button",{name:"适应屏幕",exact:true}).click();await page.waitForTimeout(350);
     if(["workspace-single","workspace-multi","workspace-mask","workspace-expand","workspace-progress"].includes(state)){
      await page.locator(`[data-picture="${images[0]}"]`).click();await expect(page.locator(".p-live-image-toolbar")).toBeVisible();
     }
     if(state==="workspace-multi"){await page.locator(`[data-picture="${images[1]}"]`).click({modifiers:["Shift"]});await expect(page.getByRole("button",{name:"批量下载",exact:true})).toBeVisible();}
     if(state==="workspace-mask"){
      await page.getByRole("button",{name:"局部重绘",exact:true}).click();await expect(page.locator(".p-mask-tools")).toBeVisible();
      await page.waitForTimeout(400); // 等待既有180ms编辑缩放完成，避免在运动中计算笔迹坐标。
      const box=await page.locator(".p-mask-editor").boundingBox();if(!box)throw Error("未找到蒙版画布");
      await page.mouse.move(box.x+box.width*.3,box.y+box.height*.4);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.55,{steps:6});await page.mouse.up();await page.getByLabel("局部修改要求").fill("仅调整选区内的环境配饰，保留产品外观");
     }
     if(state==="workspace-expand"){await page.getByRole("button",{name:"扩图",exact:true}).click();await expect(page.getByRole("dialog",{name:"扩展画面"})).toBeVisible();await expect(page.locator(".p-expand-stage canvas")).toBeVisible();}
     if(state==="workspace-product"){await page.getByRole("button",{name:/^产品卡/}).click();await expect(page.locator(".p-product-sheet")).toBeVisible();}
     if(state==="workspace-progress"&&width===390)await page.getByRole("tab",{name:"对话",exact:true}).click();
     if(state==="workspace-history"){await page.getByRole("button",{name:"历史",exact:true}).click();await expect(page.locator(".t11-canvas-history")).toBeVisible();}
     if(state==="workspace-save-status"){await expect(page.locator(".t11-save-status")).toBeVisible();}
    }
   }
   await settle(page,state);
   if(pageErrors.length)throw Error("页面运行错误："+pageErrors.join("；"));
   if(state==="admin")await expect(page.locator(".p-admin-table tbody tr")).toHaveCount(adminCatalog.models.length);
   const image=await page.screenshot({path:path.join(destination,name+".png"),fullPage:!state.startsWith("workspace"),animations:"disabled",caret:"hide"});
   if(args.includes("--small-text")){
    const metrics=await page.evaluate(()=>[...document.querySelectorAll<HTMLElement>(".t11-references,.t11-references>span,.t11-progress-heading small,.t11-progress-step small,.t11-generation-progress small,.t11-awaiting,.t11-save-status,.t11-save-status button,.t11-canvas-history small")].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,classes:e.className,text:e.innerText,fontSize:getComputedStyle(e).fontSize,clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,left:r.left,right:r.right,viewport:innerWidth,horizontalOverflow:e.scrollWidth>e.clientWidth+1,outsideViewport:r.left<0||r.right>innerWidth+1};}));
    await writeFile(path.join(destination,name+".text-metrics.json"),JSON.stringify(metrics,null,2));
   }
   const meta=await sharp(image).metadata();let changedPixels=0,totalPixels=(meta.width??0)*(meta.height??0);let baselineSize:{width:number;height:number}|undefined;
   if(mode==="compare"){
    const before=await sharp(await readFile(path.join(root,name+".png"))).ensureAlpha().raw().toBuffer({resolveWithObject:true}),after=await sharp(image).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const resized=before.info.width!==after.info.width||before.info.height!==after.info.height;
    if(resized&&!args.includes("--allow-size-change"))throw Error(`截图尺寸改变：${before.info.width}x${before.info.height} → ${after.info.width}x${after.info.height}`);
    if(resized)baselineSize={width:before.info.width,height:before.info.height};
    const width=Math.max(before.info.width,after.info.width),height=Math.max(before.info.height,after.info.height);totalPixels=width*height;
    const diff=Buffer.alloc(totalPixels*4);for(let i=0;i<totalPixels;i++){const offset=i*4,x=i%width,y=Math.floor(i/width),a=y<before.info.height&&x<before.info.width?(y*before.info.width+x)*4:-1,b=y<after.info.height&&x<after.info.width?(y*after.info.width+x)*4:-1,changed=a<0||b<0||[0,1,2,3].some(c=>before.data[a+c]!==after.data[b+c]);if(changed){changedPixels++;diff.set([238,55,75,255],offset);}else diff.set([after.data[b],after.data[b+1],after.data[b+2],40],offset);}
    if(changedPixels)await sharp(diff,{raw:{width,height,channels:4}}).png().toFile(path.join(destination,name+".diff.png"));
    else await rm(path.join(destination,name+".diff.png"),{force:true});
   }
   results.push({name,width:meta.width!,height:meta.height!,changedPixels,totalPixels,differencePercent:changedPixels/totalPixels*100,sha256:createHash("sha256").update(image).digest("hex"),...(baselineSize?{baselineSize}:{})});console.log(name+" "+(changedPixels/totalPixels*100).toFixed(5)+"%");
   if(args.includes("--diagnose")){
    const originalLayout=execFileSync("git",["show","a1e3f51:src/app/(creative)/layout.tsx"],{encoding:"utf8"}),originalFiles=[...originalLayout.matchAll(/import "\.\/([^";]+\.css)";/g)].map(m=>"src/app/(creative)/"+m[1]);
    const oldCss=await readFile("node_modules/@xyflow/react/dist/style.css","utf8")+"\n"+originalFiles.map(file=>execFileSync("git",["show","a1e3f51:"+file],{encoding:"utf8"})).join("\n");
    const differences=await page.evaluate(css=>{
     const elements=[...document.querySelectorAll("*")],properties=["font-size","font-weight","font-family","line-height","color","background-color","object-fit","width","height","padding","margin","border","border-radius","outline","outline-offset","box-shadow","translate","transform","display","justify-content","gap"];
     const before=elements.map(e=>{const s=getComputedStyle(e);return Object.fromEntries(properties.map(p=>[p,s.getPropertyValue(p)]));});
     for(const sheet of [...document.styleSheets]){try{if([...sheet.cssRules].some(r=>r.cssText.includes(".p-app")))sheet.disabled=true;}catch{}}
     const style=document.createElement("style");style.textContent=css;document.head.append(style);
     return elements.flatMap((e,i)=>{const s=getComputedStyle(e),changed=properties.filter(p=>before[i][p]!==s.getPropertyValue(p));return changed.length?[{tag:e.tagName,classes:e.getAttribute("class"),text:e.textContent?.slice(0,45),changes:changed.map(p=>({property:p,current:before[i][p],original:s.getPropertyValue(p)}))}]:[];});
    },oldCss);await writeFile(path.join(destination,name+".styles.json"),JSON.stringify(differences,null,2));
   }
  }catch(e){failures.push(name+": "+String(e));console.error(failures.at(-1));}finally{await context.close();}
 }
}finally{await browser.close();}
const referenceCommit=mode==="compare"?execFileSync("git",["log","-1","--format=%H","--",path.relative(process.cwd(),path.join(root,"manifest.json"))],{encoding:"utf8"}).trim():null;
await writeFile(path.join(destination,"manifest.json"),JSON.stringify({mode,commit,referenceCommit,referenceDirectory:mode==="compare"?path.relative(process.cwd(),root):null,capturedAt:new Date().toISOString(),fixedTime:fixed,normalization:"独立上下文、固定数据/模型目录/日期/语言/时区/像素比、关闭截图动画与光标、冻结打字机；不掩盖UI元素",results,failures},null,2));
console.log(JSON.stringify({captured:results.length,failures,overThreshold:results.filter(r=>r.differencePercent>.1).map(r=>({name:r.name,percent:r.differencePercent}))},null,2));if(failures.length)process.exitCode=1;
async function settle(page:Page,state:string){
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(async img=>{if(img.loading==="lazy")img.loading="eager";try{await img.decode();}catch{if(!img.complete||!img.naturalWidth)throw Error("图片加载失败："+img.getAttribute("src"));}}));});
 await page.waitForTimeout(state==="home"?1800:400);await page.mouse.move(1,1);await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();});
 await page.waitForTimeout(350); // 等待既有200ms的motion悬停回落结束；不修改组件动效。
}
