/** 旧页面只读截图；通过 ui-snapshots.ts --suite=studio 调用。 */
import "dotenv/config";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import path from "node:path";
import {createHash} from "node:crypto";
import {chromium,expect} from "@playwright/test";
const args=process.argv.slice(2),option=(k:string,d:string)=>args.find(a=>a.startsWith(k+"="))?.slice(k.length+1)??d;
const mode=option("--mode","baseline"),baseURL=option("--base-url","http://localhost:3000"),output=path.resolve(option("--output","docs/ui-audit/baseline-studio"));
if(!["localhost","127.0.0.1"].includes(new URL(baseURL).hostname))throw Error("仅允许本地截图");
const commit=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
if(mode==="baseline"&&!commit.startsWith("99f3187"))throw Error("studio基线必须在已审阅的99f3187上生成");
await mkdir(output,{recursive:true});
if(mode==="baseline"&&!args.includes("--force")){try{await readFile(path.join(output,"manifest.json"));throw Error("基线已存在，覆盖需--force");}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}}
const browser=await chromium.launch({channel:"chrome",headless:true}),results:unknown[]=[],failures:string[]=[];
try{
 const login=await browser.newContext(),page=await login.newPage();await page.goto(baseURL+"/login");await page.getByLabel("公司邮箱").fill(process.env.ADMIN_EMAIL??"");await page.getByLabel("密码",{exact:true}).fill(process.env.ADMIN_PASSWORD??"");await page.getByRole("button",{name:"进入工作台"}).click();await page.waitForURL(baseURL+"/");
 const auth=await login.storageState(),products=await(await login.request.get(baseURL+"/api/studio")).json() as {id:string;sku:string}[];
 const product=products.find(p=>p.sku==="NEW-MVQFFV1P")??products[0];if(!product)throw Error("没有可只读访问的产品；不自动新建SKU");await login.close();
 const states=[{name:"login",url:"/login",public:true},{name:"product",url:`/products/${product.id}`},{name:"agent",url:`/products/${product.id}/pack`},{name:"admin",url:"/admin"},{name:"users",url:"/admin/users"},{name:"gateways",url:"/admin/gateways"},{name:"models",url:"/admin/models"},{name:"templates",url:"/templates"},{name:"forbidden",url:"/forbidden"}];
 for(const width of [1440,390])for(const theme of ["light","dark"])for(const state of states){
  const context=await browser.newContext({...(state.public?{}:{storageState:auth}),viewport:{width,height:width===390?844:1000},deviceScaleFactor:1,colorScheme:theme==="dark"?"dark":"light",locale:"zh-CN",timezoneId:"Asia/Shanghai",reducedMotion:"reduce"}),page=await context.newPage(),name=`${state.name}-${theme}-${width}`;
  try{
   await page.clock.setFixedTime(new Date("2026-10-28T06:00:00Z"));
   await page.addInitScript(theme=>{localStorage.clear();localStorage.setItem("furniture-preview-theme",theme);document.addEventListener("DOMContentLoaded",()=>{document.documentElement.classList.remove("dark","light");document.documentElement.classList.add(theme);});},theme);
   await context.route("**/api/**",route=>{if(route.request().method()!=="GET"&&!new URL(route.request().url()).pathname.startsWith("/api/auth/"))throw Error("旧页面截图禁止业务写请求");return route.continue();});
   const response=await page.goto(baseURL+state.url);if(!response||response.status()>=400)throw Error("HTTP "+response?.status());await page.waitForLoadState("networkidle");
   await page.evaluate(theme=>{document.documentElement.classList.remove("dark","light");document.documentElement.classList.add(theme);},theme);
   await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(async img=>{img.loading="eager";try{await img.decode();}catch{}}));});await page.waitForTimeout(400);
   await expect(page.locator(state.public?".login-shell":".studio-shell")).toBeVisible();
   const image=await page.screenshot({path:path.join(output,name+".png"),fullPage:true,animations:"disabled",caret:"hide"});
   results.push({name,url:state.url,status:response.status(),sha256:createHash("sha256").update(image).digest("hex"),theme,width,variables:await page.evaluate(()=>{const s=getComputedStyle(document.documentElement);return Object.fromEntries(["--background","--primary","--foreground"].map(k=>[k,s.getPropertyValue(k).trim()]));})});console.log(name+" OK");
  }catch(e){failures.push(name+": "+String(e));console.error(failures.at(-1));}finally{await context.close();}
 }
 await writeFile(path.join(output,"manifest.json"),JSON.stringify({mode,commit,capturedAt:new Date().toISOString(),productId:product.id,sku:product.sku,results,failures,excluded:[{url:"/design-preview/icons",reason:"SHOW_UNCONNECTED_FEATURES=false，404；不修改开关"},{url:"/design、旧design-preview业务路径",reason:"删除或301到正式路由；creative基线已覆盖"},{url:"/reviews/*",reason:"独立HTML评审route，非(studio)页面，不参与旧CSS迁移"}]},null,2));
}finally{await browser.close();}
console.log(JSON.stringify({captured:results.length,failures}));if(failures.length)process.exitCode=1;
