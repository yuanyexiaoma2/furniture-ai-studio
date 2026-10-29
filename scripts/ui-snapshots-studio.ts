/** 旧页面只读截图；通过 ui-snapshots.ts --suite=studio 调用。 */
import "dotenv/config";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import path from "node:path";
import {createHash} from "node:crypto";
import {emptyProfile,profileFields} from "../src/lib/profile-rules";
import {auditStudioPage} from "./ui-studio-audit";
import {compareScreenshots} from "./ui-image-diff";
import {collectRenderEnvironment,checkRenderBaseline} from "./ui-render-environment";
import {chromium,expect} from "@playwright/test";
const args=process.argv.slice(2),option=(k:string,d:string)=>args.find(a=>a.startsWith(k+"="))?.slice(k.length+1)??d;
const mode=option("--mode","baseline"),baseURL=option("--base-url","http://localhost:3000"),output=path.resolve(option("--output","docs/ui-audit/baseline-studio"));
if(!["baseline","compare","capture"].includes(mode))throw Error("mode仅支持baseline、compare或capture");
const baseline=path.resolve(option("--baseline","docs/ui-audit/baseline-studio"));
if(mode==="compare"&&baseline===output)throw Error("对比输出不能覆盖基线");
if(!["localhost","127.0.0.1"].includes(new URL(baseURL).hostname))throw Error("仅允许本地截图");
const commit=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
if(mode==="baseline"&&!commit.startsWith("99f3187"))throw Error("studio基线必须在已审阅的99f3187上生成");
await mkdir(output,{recursive:true});
if(mode==="baseline"&&!args.includes("--force")){try{await readFile(path.join(output,"manifest.json"));throw Error("基线已存在，覆盖需--force");}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}}
const browser=await chromium.launch({channel:"chrome",headless:true}),results:Record<string,unknown>[]=[],failures:string[]=[];
let renderEnvironment:Awaited<ReturnType<typeof collectRenderEnvironment>>;
try{renderEnvironment=await collectRenderEnvironment(browser.version());}catch(error){await browser.close();throw error;}
// 历史studio基线没有字体记录，不伪造历史信息；可显式指定本轮原版基线作环境锚点。
const environmentBaseline=option("--environment-baseline",baseline);
if(mode==="compare"){try{
 const historical=JSON.parse(await readFile(path.join(baseline,"manifest.json"),"utf8"));
 if(historical.renderEnvironment)await checkRenderBaseline(baseline,renderEnvironment);
 else if(environmentBaseline===baseline||historical.browserVersion!==renderEnvironment.chromeVersion)throw Error("旧studio基线缺少字体指纹，或Chrome版本不同；须重拍原版，不能计算差异率。历史基线同版本时可显式指定本轮原版--environment-baseline作为环境锚点，历史字体状态仍标为未知。");
 await checkRenderBaseline(environmentBaseline,renderEnvironment);
}catch(error){await browser.close();throw error;}}
try{
 const login=await browser.newContext(),page=await login.newPage();await page.goto(baseURL+"/login");await page.getByLabel("公司邮箱").fill(process.env.ADMIN_EMAIL??"");await page.getByLabel("密码",{exact:true}).fill(process.env.ADMIN_PASSWORD??"");await page.getByRole("button",{name:"进入工作台"}).click();await page.waitForURL(baseURL+"/");
 const auth=await login.storageState(),products=await(await login.request.get(baseURL+"/api/studio")).json() as {id:string;sku:string}[];
 const product=products.find(p=>p.sku==="NEW-MVQFFV1P")??products[0];if(!product)throw Error("没有可只读访问的产品；不自动新建SKU");await login.close();
 const states=[{name:"login",url:"/login",public:true},{name:"product",url:`/products/${product.id}`},{name:"agent",url:`/products/${product.id}/pack`},{name:"admin",url:"/admin"},{name:"users",url:"/admin/users"},{name:"gateways",url:"/admin/gateways"},{name:"models",url:"/admin/models"},{name:"templates",url:"/templates"},{name:"forbidden",url:"/forbidden"}];
 for(const width of [1440,390])for(const theme of ["light","dark"])for(const state of states){
  if(args.includes("--probe-cards")&&state.name!=="agent")continue;
  if(option("--only","")&&!option("--only","").split(",").includes(state.name))continue;
  if(option("--theme","")&&option("--theme","")!==theme)continue;
  const context=await browser.newContext({...(state.public?{}:{storageState:auth}),viewport:{width,height:width===390?844:1000},deviceScaleFactor:1,colorScheme:theme==="dark"?"dark":"light",locale:"zh-CN",timezoneId:"Asia/Shanghai",reducedMotion:"reduce"}),page=await context.newPage(),name=`${state.name}-${theme}-${width}`;
  try{
   await page.clock.setFixedTime(new Date("2026-10-28T06:00:00Z"));
   await page.addInitScript(theme=>{localStorage.clear();localStorage.setItem("furniture-preview-theme",theme);document.addEventListener("DOMContentLoaded",()=>{document.documentElement.classList.remove("dark","light");document.documentElement.classList.add(theme);});},theme);
   await context.route("**/api/**",route=>{if(route.request().method()!=="GET"&&!new URL(route.request().url()).pathname.startsWith("/api/auth/"))throw Error("旧页面截图禁止业务写请求");return route.continue();});
   if(args.includes("--probe-cards")){
    const endpoint=baseURL+"/api/products/"+product.id+"/agent",fixture=await(await context.request.get(endpoint)).json();
    const profile=emptyProfile();for(const key of profileFields)profile[key]={value:"用于排版验证的长产品资料，核对结构、材质及身份一致性。".repeat(3),status:"confirmed",sources:[{kind:"message",id:"ui-layout",quote:"仅浏览器排版夹具，不写入产品资料。".repeat(3)}],conflicts:[]};
    fixture.cards=[{id:"ui-questions",kind:"questions",status:"pending",data:{questions:[{question:"长问题用于检查窄屏换行，保留所有字号，不缩小文本。".repeat(3),options:["按照实拍与资料确认产品结构，长选项允许自然换行。".repeat(3)],allowFreeText:true}]}},{id:"ui-profile",kind:"profile",status:"pending",data:{profile}}];
    await context.route(endpoint,route=>{if(route.request().method()!=="GET")throw Error("卡片夹具禁止提交");return route.fulfill({json:fixture});});
   }
   const response=await page.goto(baseURL+state.url);if(!response||response.status()>=400)throw Error("HTTP "+response?.status());await page.waitForLoadState("networkidle");
   await page.evaluate(theme=>{document.documentElement.classList.remove("dark","light");document.documentElement.classList.add(theme);},theme);
   await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(async img=>{img.loading="eager";try{await img.decode();}catch{}}));});await page.waitForTimeout(400);
   await expect(page.locator(state.public?".login-shell":".studio-shell")).toBeVisible();
   if(args.includes("--probe-cards")){
    await expect(page.getByTestId("agent-card-profile")).toBeAttached({timeout:12000});
    for(const kind of ["questions","profile"])await page.getByTestId("agent-card-"+kind).screenshot({path:path.join(output,name+"-"+kind+".png"),animations:"disabled",caret:"hide"});
   }
   if(args.includes("--audit")){
    const audit=await auditStudioPage(page,["login","users"].includes(state.name));
    await writeFile(path.join(output,name+".text-metrics.json"),JSON.stringify(audit,null,2));
    if(audit.controlContrastFailures.length||audit.contrastFailures.length||audit.smallFonts.length||audit.overflows.length||audit.pageOverflow||theme==="dark"&&audit.whiteSurfaces.length||(audit.axe.violations as {impact:string}[]).some(v=>["serious","critical"].includes(v.impact)))throw Error("文本边界/颜色/axe检查未通过，见text-metrics.json");
   }
   const image=await page.screenshot({path:path.join(output,name+".png"),fullPage:true,animations:"disabled",caret:"hide"});
   const comparison=mode==="compare"?await compareScreenshots(path.join(baseline,name+".png"),image,path.join(output,name+".diff.png"),args.includes("--allow-size-change")):{};
   const icons=await page.locator("svg[data-concept-icon]").evaluateAll(es=>es.map(e=>({icon:e.getAttribute("data-concept-icon"),parent:e.parentElement?.className,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,size:e.getAttribute("width")})));
   results.push({name,...comparison,icons,url:state.url,status:response.status(),sha256:createHash("sha256").update(image).digest("hex"),theme,width,variables:await page.evaluate(()=>{const s=getComputedStyle(document.documentElement);return Object.fromEntries(["--background","--primary","--foreground"].map(k=>[k,s.getPropertyValue(k).trim()]));})});console.log(name+" OK");
  }catch(e){failures.push(name+": "+String(e));console.error(failures.at(-1));}finally{await context.close();}
 }
 await writeFile(path.join(output,"manifest.json"),JSON.stringify({mode,commit,baseline:mode==="compare"?path.relative(process.cwd(),baseline):null,referenceCommit:mode==="compare"?execFileSync("git",["log","-1","--format=%H","--",path.relative(process.cwd(),baseline)],{encoding:"utf8"}).trim():null,browserVersion:browser.version(),renderEnvironment,environmentReference:mode==="compare"?path.relative(process.cwd(),environmentBaseline):null,capturedAt:new Date().toISOString(),productId:product.id,sku:product.sku,results,failures,overThreshold:results.filter(r=>Number(r.differencePercent)>.1).map(r=>({name:r.name,differencePercent:r.differencePercent})),excluded:[{url:"/design-preview/icons",reason:"SHOW_UNCONNECTED_FEATURES=false，404；不修改开关"},{url:"/design、旧design-preview业务路径",reason:"删除或301到正式路由；creative基线已覆盖"},{url:"/reviews/*",reason:"独立HTML评审route，非(studio)页面，不参与旧CSS迁移"}]},null,2));
}finally{await browser.close();}
console.log(JSON.stringify({captured:results.length,failures}));if(failures.length)process.exitCode=1;
