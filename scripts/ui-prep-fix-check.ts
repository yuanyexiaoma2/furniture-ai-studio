/** 准备修正的真实DOM/键盘验证；文件夹解析仅拦截为本地响应，禁止调用付费模型。 */
import "dotenv/config";
import {chromium,expect} from "@playwright/test";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {auditStudioPage} from "./ui-studio-audit";
const option=(key:string,fallback:string)=>process.argv.find(a=>a.startsWith(key+"="))?.slice(key.length+1)??fallback;
const base="http://localhost:3000",output=option("--output","docs/ui-audit/phase3-prep-fix-interactions"),only=option("--only","");
await mkdir(output,{recursive:true});
const folder=path.resolve(".local/verification/ui-phase3-prep-fix/mock-folder");await mkdir(folder,{recursive:true});await writeFile(path.join(folder,"参数.txt"),"仅浏览器交互夹具，不发给模型。");
const browser=await chromium.launch({channel:"chrome",headless:true}),results:Record<string,unknown>[]=[],failures:string[]=[];
try{
 const login=await browser.newPage();await login.goto(base+"/login");await login.getByLabel("公司邮箱").fill(process.env.ADMIN_EMAIL??"");await login.getByLabel("密码",{exact:true}).fill(process.env.ADMIN_PASSWORD??"");await login.getByRole("button",{name:"进入工作台"}).click();await login.waitForURL(base+"/");const auth=await login.context().storageState();await login.context().close();
 for(const width of option("--widths","1440,2560,390").split(",").map(Number))for(const theme of ["light","dark"])for(const state of ["home","workspace","library","login"]){
  if(only&&only!==state&&!(only==="panels"&&["home","workspace"].includes(state)))continue;
  const context=await browser.newContext({...(state==="login"?{}:{storageState:auth}),viewport:{width,height:width===390?844:width===2560?1440:900},colorScheme:theme as "light"|"dark",reducedMotion:"reduce"}),page=await context.newPage(),name=`${state}-${theme}-${width}`;
  try{
   let credentials=0,imports=0;
   await context.addInitScript(theme=>{localStorage.clear();localStorage.setItem("furniture-preview-theme",theme);},theme);
   await context.route("**/api/**",async route=>{const u=new URL(route.request().url());if(u.pathname.startsWith("/api/auth/")){if(u.pathname.includes("callback/credentials"))credentials++;return route.continue();}if(u.pathname==="/api/studio/library/import"&&route.request().method()==="POST"){imports++;return route.fulfill({json:{ok:true}});}if(u.pathname==="/api/studio/library"&&route.request().method()==="GET")return route.fulfill({json:[{id:"ui-keyboard-pattern",name:"键盘检查夹具",categories:["家具"],type:"scene_pattern",source:"只读夹具",status:"ready",is_sample:false,content:{roomType:"客厅"}}]});if(route.request().method()!=="GET")throw Error("交互验证禁止业务写请求："+u.pathname);return route.continue();});
   await page.goto(base+(state==="home"?"/":state==="workspace"?"/workspace":state==="library"?"/library":"/login"));await page.waitForLoadState("networkidle");await page.evaluate(theme=>document.documentElement.classList.toggle("dark",theme==="dark"),theme);await page.waitForTimeout(400);
   const field=page.getByLabel(state==="home"?"首页创作要求":state==="workspace"?"工作台创作要求":state==="library"?"导入品类":"公司邮箱");
   if(state==="workspace"&&!(await field.isVisible()))await page.getByRole("tab",{name:"对话",exact:true}).click();
   await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();scrollTo(0,0);});await page.waitForTimeout(180);
   const beforeFocus=await field.evaluate(e=>{const c=e.closest(".p-home-input,.p-chat-input")??e,s=getComputedStyle(c),r=c.getBoundingClientRect();return {border:s.borderTopColor,borderWidth:s.borderTopWidth,background:s.backgroundColor,rect:{x:r.x,y:r.y,width:r.width,height:r.height}};});
   await page.keyboard.press("Shift+Tab");await field.focus();await page.waitForTimeout(220);await page.evaluate(()=>scrollTo(0,0));
   await page.evaluate("window.__name=(fn)=>fn");
   const metric=await field.evaluate((e,before)=>{
    const c=document.createElement("canvas");c.width=c.height=1;const ctx=c.getContext("2d")!;
    function rgb(v:string,bg?:string){ctx.clearRect(0,0,1,1);if(bg){ctx.fillStyle=bg;ctx.fillRect(0,0,1,1);}ctx.fillStyle=v;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);}
    function lum(a:number[]){return a.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);}
    function contrast(a:string,b:string){const x=lum(rgb(a)),y=lum(rgb(b));return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
    const panel=!!e.closest(".p-home-input,.p-chat-input"),container=e.closest(".p-home-input,.p-chat-input")??e,s=getComputedStyle(container),root=getComputedStyle(document.documentElement),background=root.getPropertyValue("--background").trim(),foreground=root.getPropertyValue("--foreground").trim(),ring=panel?s.borderTopColor:s.outlineColor;
    const muted=root.getPropertyValue("--muted-foreground").trim();
    const r=container.getBoundingClientRect(),outset=panel?3:Math.max(0,parseFloat(s.outlineOffset)+parseFloat(s.outlineWidth)),x=lum(rgb(before.border,before.background)),y=lum(rgb(s.borderTopColor,s.backgroundColor));
    return {panel,before,rect:{x:r.x,y:r.y,width:r.width,height:r.height},borderWidth:s.borderTopWidth,boxShadow:s.boxShadow,textareaOutline:getComputedStyle(e).outlineWidth,textareaShadow:getComputedStyle(e).boxShadow,borderChangeContrast:(Math.max(x,y)+.05)/(Math.min(x,y)+.05),focusBounds:{left:r.left-outset,right:r.right+outset,top:r.top-outset,bottom:r.bottom+outset,viewportWidth:innerWidth,viewportHeight:innerHeight},inputToken:root.getPropertyValue("--input").trim(),outlineWidth:s.outlineWidth,outlineOffset:s.outlineOffset,outlineStyle:s.outlineStyle,ring,ringVsPage:contrast(ring,background),ringVsInput:contrast(ring,s.backgroundColor==="rgba(0, 0, 0, 0)"?root.getPropertyValue("--card").trim():s.backgroundColor),foregroundVsPage:contrast(foreground,background),foregroundVsCard:contrast(foreground,root.getPropertyValue("--card").trim()),foregroundVsPopover:contrast(foreground,root.getPropertyValue("--popover").trim()),mutedVsPage:contrast(muted,background),mutedVsPopover:contrast(muted,root.getPropertyValue("--popover").trim()),placeholder:getComputedStyle(e,"::placeholder").color,fontSize:getComputedStyle(e).fontSize,minHeight:getComputedStyle(e).minHeight,padding:s.padding};
   },beforeFocus);
   if(metric.panel){expect(metric.outlineWidth).toBe("0px");expect(metric.borderWidth).toBe("1px");expect(metric.rect).toEqual(beforeFocus.rect);expect(metric.textareaOutline).toBe("0px");expect(metric.textareaShadow).toBe("none");expect(metric.borderChangeContrast).toBeGreaterThanOrEqual(3);}else{expect(parseFloat(metric.outlineWidth),name+"聚焦宽度").toBeGreaterThanOrEqual(2);expect(metric.outlineStyle).toBe("solid");}expect(metric.ringVsPage).toBeGreaterThanOrEqual(3);expect(metric.ringVsInput).toBeGreaterThanOrEqual(3);
   if(theme==="light")expect(metric.inputToken).toBe("#8b8b94");
   if(state==="workspace"){expect(metric.focusBounds.left).toBeGreaterThanOrEqual(0);expect(metric.focusBounds.right).toBeLessThanOrEqual(metric.focusBounds.viewportWidth);expect(metric.focusBounds.bottom).toBeLessThanOrEqual(metric.focusBounds.viewportHeight);}
   if(theme==="dark"){expect(metric.foregroundVsPage).toBeGreaterThanOrEqual(12);expect(metric.foregroundVsCard).toBeGreaterThanOrEqual(12);expect(metric.foregroundVsPopover).toBeGreaterThanOrEqual(12);}
   await page.screenshot({path:path.join(output,name+".focus.png"),animations:"disabled",caret:"hide"});
   if(only==="panels"){const audit=await auditStudioPage(page,true,".p-app *,.p-portal *");await writeFile(path.join(output,name+".audit.json"),JSON.stringify(audit,null,2));expect(audit.contrastFailures).toHaveLength(0);expect((audit.axe.violations as {impact:string}[]).filter(v=>["serious","critical"].includes(v.impact))).toHaveLength(0);}
   const extra:Record<string,unknown>={};
   if(state==="home"){
    expect(await page.locator(".p-tab-hint,.p-intent-row").count()).toBe(0);
    await field.press("Tab");await expect(field).not.toHaveValue("");extra.tabCompletion=true;
    const geometry=await page.evaluate(()=>{const input=document.querySelector(".p-home-input")!.getBoundingClientRect(),heading=document.querySelector(".r1-home-tasks>h2")!.getBoundingClientRect(),card=document.querySelector(".r1-task-card")!.getBoundingClientRect(),hero=document.querySelector(".p-home-heading")!.getBoundingClientRect();return {titleTop:hero.top,inputToTasks:heading.top-input.bottom,cardTop:card.top,cardHeight:card.height,visibleFraction:Math.max(0,Math.min(card.height,innerHeight-card.top))/card.height};});
    if(width===1440){expect(geometry.visibleFraction).toBeGreaterThanOrEqual(.5);expect(Math.abs(geometry.inputToTasks-64)).toBeLessThanOrEqual(3);}extra.geometry=geometry;
    if(theme==="dark"){await field.blur();const img=page.locator(".r1-task-art img").first();await page.mouse.move(1,1);await page.waitForTimeout(220);const rest=await img.evaluate(e=>getComputedStyle(e).filter);await page.locator(".r1-task-card").first().hover();await page.waitForTimeout(220);const hover=await img.evaluate(e=>getComputedStyle(e).filter);expect(rest).toBe("brightness(0.94)");expect(hover).toBe("brightness(1)");extra.imageFilters={rest,hover};}
   }
   if(state==="login"){
    const button=page.getByRole("button",{name:"进入工作台"});await expect(button).toBeEnabled();extra.emptyButton=await button.evaluate(e=>({opacity:getComputedStyle(e).opacity,background:getComputedStyle(e).backgroundColor}));await button.click();await expect(page.locator("#email-error")).toHaveText("请输入公司邮箱");await expect(page.locator("#password-error")).toHaveText("请输入密码");expect(credentials).toBe(0);await page.screenshot({path:path.join(output,name+".empty.png"),animations:"disabled",caret:"hide"});await field.fill("invalid");await page.getByLabel("密码",{exact:true}).fill("ui-only");await button.click();await expect(page.locator("#email-error")).toHaveText("请输入有效的邮箱地址");expect(credentials).toBe(0);extra.emptyAndInvalidWithoutAuthRequest=true;
   }
   if(state==="library"){
    const summary=page.locator(".p-pattern-card summary").first();await summary.focus();await summary.press("Enter");await expect(page.locator(".p-pattern-card details").first()).toHaveAttribute("open","");extra.chevronTransform=await summary.locator("svg").evaluate(e=>getComputedStyle(e).transform);await summary.press("Space");await expect(page.locator(".p-pattern-card details").first()).not.toHaveAttribute("open","");
    await field.fill("家具");await page.getByLabel("选择Listing文件夹").setInputFiles(folder);await expect(page.locator(".p-import-file-name")).toHaveText("参数.txt");await expect(page.getByRole("status")).toContainText("拆解完成");expect(imports).toBe(1);extra.folder={calls:imports,accept:await page.getByLabel("选择Listing文件夹").getAttribute("accept"),originalDirectoryInputPreserved:true,onlyMock:true};
   }
   results.push({name,...metric,...extra});console.log(name+" OK");
  }catch(e){failures.push(name+": "+String(e));console.error(failures.at(-1));}finally{await context.close();}
 }
 // 只读检查真实SKU封面：同一行基线对齐，悬停只缩放图片，不移动卡片。
 for(const width of [1440,2560,390])for(const theme of ["light","dark"]){
  if(only&&only!=="skus")continue;
  const context=await browser.newContext({storageState:auth,viewport:{width,height:900},colorScheme:theme as "light"|"dark",reducedMotion:"reduce"}),page=await context.newPage(),name=`skus-${theme}-${width}`;
  try{
   await context.addInitScript(theme=>localStorage.setItem("furniture-preview-theme",theme),theme);await context.route("**/api/**",route=>{if(route.request().method()!=="GET"&&!route.request().url().includes("/api/auth/"))throw Error("SKU验证禁止写入");return route.continue();});
   await page.goto(base+"/skus");await page.waitForLoadState("networkidle");await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});await page.waitForTimeout(220);
   const covers=await page.locator(".p-sku-cover").evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),t=e.parentElement!.querySelector("strong")!.getBoundingClientRect(),s=getComputedStyle(e),img=e.querySelector("img")!;return {x:r.x,y:r.y,width:r.width,height:r.height,titleY:t.y,radius:s.borderRadius,background:s.backgroundColor,backgroundImage:s.backgroundImage,fit:getComputedStyle(img).objectFit,white:e.classList.contains("is-white"),src:img.getAttribute("src")};}));
   for(const c of covers){expect(Math.abs(c.width/c.height-4/3)).toBeLessThan(.001);expect(c.radius).toBe("10px");expect(c.backgroundImage).toBe("none");expect(c.fit).toBe(c.white?"contain":"cover");}
   for(const top of new Set(covers.map(c=>Math.round(c.y)))){const row=covers.filter(c=>Math.round(c.y)===top);expect(Math.max(...row.map(c=>c.titleY))-Math.min(...row.map(c=>c.titleY))).toBeLessThan(.1);}
   const first=page.locator(".p-sku-card").first(),before=await first.boundingBox();await first.hover();await page.waitForTimeout(220);const after=await first.boundingBox(),scale=await first.locator("img").evaluate(e=>new DOMMatrixReadOnly(getComputedStyle(e).transform).a);expect(after).toEqual(before);expect(Math.abs(scale-1.02)).toBeLessThan(.001);results.push({name,covers,hoverScale:scale,cardUnchanged:true});console.log(name+" OK");
  }catch(e){failures.push(name+": "+String(e));console.error(failures.at(-1));}finally{await context.close();}
 }
}finally{await browser.close();}
await writeFile(path.join(output,"checks.json"),JSON.stringify({results,failures,network:"仅本地；文件夹POST为拦截响应，其他业务写请求禁止；未调用模型"},null,2));if(failures.length)process.exitCode=1;
