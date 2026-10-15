import "dotenv/config";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {chromium} from "@playwright/test";
const base=process.env.DESIGN_PREVIEW_URL??"http://localhost:3001";
const out="docs/design-preview/round3";
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});
const context=await browser.newContext({storageState:".local/preview-storage.json",viewport:{width:1600,height:1000}});
const page=await context.newPage(),errors=[],diagnostics=[],business=[],external=[];
page.on("pageerror",e=>{errors.push(e.message);console.log("页面错误",e.message);});
page.on("console",m=>{if(["warning","error"].includes(m.type()))diagnostics.push(m.text());});
await page.route("**/api/**",route=>{if(new URL(route.request().url()).pathname.startsWith("/api/auth/"))return route.continue();business.push(route.request().url());return route.abort();});
page.on("request",r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(base))external.push(r.url());});
const audits=[];
async function ready(){await page.waitForLoadState("networkidle");await page.waitForTimeout(220);await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;}).map(i=>i.decode().catch(()=>{})));});}
async function go(path=""){await page.goto(base+"/design-preview"+path);await ready();}
async function theme(value){await page.getByRole("button",{name:"主题切换",exact:true}).click();await page.getByRole("menuitemradio",{name:value==="dark"?"暗色":"亮色",exact:true}).click();await page.waitForTimeout(200);}
async function reset(){await go();await page.evaluate(()=>localStorage.removeItem("furniture-preview-models-v3"));await page.reload();await ready();}
async function audit(name){
 const result=await page.evaluate(()=>{
  const wrap=document.querySelector(".p-composer-toolbar");let toolbar=null;
  if(wrap){const b=wrap.getBoundingClientRect();const children=[...wrap.children].filter(e=>e.getBoundingClientRect().width>0).map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,center:r.top+r.height/2};});toolbar={nowrap:getComputedStyle(wrap).flexWrap==="nowrap",inside:children.every(r=>r.left>=b.left-1&&r.right<=b.right+1),aligned:Math.max(...children.map(r=>r.center))-Math.min(...children.map(r=>r.center))<2};}
  const small=[];const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){const t=walker.currentNode,e=t.parentElement;if(!e||!t.textContent.trim()||!e.closest(".p-app,.p-portal")||e.closest(".sr-only,[aria-hidden=true]"))continue;const box=e.getBoundingClientRect();if(box.width<2||box.height<2||box.bottom<0||box.top>innerHeight)continue;if(getComputedStyle(e).visibility==="hidden"||getComputedStyle(e).display==="none")continue;let scale=1;for(let n=e;n;n=n.parentElement){const transform=getComputedStyle(n).transform;if(transform!=="none"){const m=new DOMMatrixReadOnly(transform);scale*=Math.hypot(m.a,m.b);}}const size=parseFloat(getComputedStyle(e).fontSize)*scale;if(size<11.9)small.push({text:t.textContent.slice(0,30),size});}
  return {horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,toolbar,smallText:small,brokenImages:[...document.images].filter(i=>i.getBoundingClientRect().width>0&&i.complete&&!i.naturalWidth).map(i=>i.src),previewSwitcher:!!document.querySelector('[aria-label="预览页面"]')};
 });
 assert.equal(result.horizontalOverflow,false,name+" 横向溢出");
 if(result.toolbar){assert(result.toolbar.nowrap&&result.toolbar.inside&&result.toolbar.aligned,name+" 工具行单行且不溢出 "+JSON.stringify(result.toolbar));}
 assert.deepEqual(result.smallText,[],name+" 不能出现小于12px的实际显示文字");
 assert.deepEqual(result.brokenImages,[],name+" 图片加载");
 assert.equal(result.previewSwitcher,false);
 audits.push({name,...result});
}
async function shot(name,fullPage=false){await ready();await audit(name);await page.screenshot({path:out+"/"+name+".png",fullPage});console.log("截图",name);}
for(const t of ["light","dark"]){
 await reset();await theme(t);
 for(const [path,name] of [["","01-home"],["/skus","02-skus"],["/workspace","03-workspace"],["/product","04-product"],["/admin","05-admin"]]){
  await go(path);await shot(name+"-"+t,path===""||path==="/skus");
 }
 await go();await page.getByRole("button",{name:"智能体模型",exact:true}).click();await shot("06-agent-panel-"+t);await page.keyboard.press("Escape");
 await page.getByRole("button",{name:"生图模型",exact:true}).click();
 const locked=page.getByRole("checkbox",{name:"Nano Banana 2.1",exact:true});assert.equal(await locked.getAttribute("aria-checked"),"true");assert.equal(await locked.getAttribute("aria-disabled"),"true");
 await page.getByRole("checkbox",{name:"GPT Image 2",exact:true}).click();await shot("07-image-auto-"+t);
 await page.getByRole("switch",{name:"自动挑选生图模型",exact:true}).click();await page.getByRole("radio",{name:"GPT Image 2",exact:true}).click();await page.getByRole("group",{name:"GPT Image 2质量档",exact:true}).getByRole("button",{name:"精细",exact:true}).click();await shot("08-image-manual-"+t);await page.keyboard.press("Escape");
 await go("/workspace");await page.getByRole("button",{name:"定位客厅场景候选 02",exact:true}).click();await page.waitForTimeout(300);assert(await page.getByRole("button",{name:"局部重绘",exact:true}).isVisible());await shot("09-canvas-toolbar-"+t);
 await page.getByRole("button",{name:"局部重绘",exact:true}).click();await page.locator(".p-mask-editor canvas").waitFor();await page.waitForTimeout(250);const box=await page.locator(".p-mask-editor canvas").boundingBox();assert(box.width>=380,"局部重绘必须放大到可实际编辑的尺寸");await page.mouse.move(box.x+box.width*.25,box.y+box.height*.4);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.6,{steps:18});await page.mouse.up();assert(await page.getByRole("button",{name:"确认 · 约 $0.03",exact:true}).isEnabled());await shot("10-paint-state-"+t);await page.getByRole("button",{name:"取消",exact:true}).click();
}
console.log("开始模型联动、持久化与费用回归");
await reset();await theme("light");
const initialCost=await page.locator(".p-cost-estimate").innerText();await page.getByRole("button",{name:"智能体模型",exact:true}).click();await page.getByRole("radio",{name:"Gemini 3.8 Flash",exact:true}).click();assert.notEqual(await page.locator(".p-cost-estimate").innerText(),initialCost);
await page.getByRole("button",{name:"生图模型",exact:true}).click();await page.getByRole("switch",{name:"自动挑选生图模型",exact:true}).click();await page.getByRole("radio",{name:"GPT Image 2",exact:true}).click();await page.getByRole("group",{name:"GPT Image 2质量档",exact:true}).getByRole("button",{name:"精细",exact:true}).click();await page.keyboard.press("Escape");
assert((await page.locator(".p-cost-estimate").innerText()).includes("0.482"));
await page.reload();await ready();assert((await page.getByRole("button",{name:"智能体模型",exact:true}).innerText()).includes("Gemini 3.8 Flash"));assert((await page.getByRole("button",{name:"生图模型",exact:true}).innerText()).includes("GPT Image 2"));
await page.getByRole("textbox",{name:"首页创作要求",exact:true}).fill("为这款家具规划一套自然温暖的商品图");await page.getByRole("button",{name:"发送并进入工作台",exact:true}).click();await page.waitForURL("**/design-preview/workspace");await ready();
assert((await page.getByRole("button",{name:"智能体模型",exact:true}).innerText()).includes("Gemini 3.8 Flash"));
await page.getByRole("button",{name:"智能体模型",exact:true}).click();await page.getByRole("radio",{name:"GPT-6.1 Sol",exact:true}).click();await page.getByText("已切换智能体为 GPT-6.1 Sol",{exact:true}).waitFor();
await go();assert((await page.getByRole("button",{name:"智能体模型",exact:true}).innerText()).includes("Gemini 3.8 Flash"));
await go("/admin");await page.getByRole("switch",{name:"Gemini 3.8 Flash对美工可见",exact:true}).click();await go();await page.getByRole("button",{name:"智能体模型",exact:true}).click();assert.equal(await page.getByRole("radio",{name:"Gemini 3.8 Flash",exact:true}).count(),0);await page.keyboard.press("Escape");
await go("/admin");await page.getByRole("switch",{name:"Gemini 3.8 Flash对美工可见",exact:true}).click();await page.getByRole("switch",{name:"启用GPT Image 2",exact:true}).click();await go();await page.getByRole("button",{name:"生图模型",exact:true}).click();assert.equal(await page.getByRole("radio",{name:"GPT Image 2",exact:true}).count(),0);await page.keyboard.press("Escape");
await go("/admin");await page.getByRole("switch",{name:"启用GPT Image 2",exact:true}).click();await page.getByRole("row").filter({hasText:"Flux.2 Pro"}).getByRole("button",{name:"设为默认",exact:true}).click();await go();await page.getByRole("button",{name:"生图模型",exact:true}).click();await page.getByRole("switch",{name:"自动挑选生图模型",exact:true}).click();assert.equal(await page.getByRole("checkbox",{name:"Flux.2 Pro",exact:true}).getAttribute("aria-disabled"),"true");await page.keyboard.press("Escape");
await go("/admin");await page.getByRole("row").filter({hasText:"Nano Banana 2.1"}).getByRole("button",{name:"设为默认",exact:true}).click();
await go("/workspace");await page.getByRole("button",{name:"定位客厅场景候选 02",exact:true}).click();await page.waitForTimeout(250);await page.getByRole("button",{name:"局部重绘",exact:true}).click();await page.locator(".p-mask-editor canvas").waitFor();await page.waitForTimeout(300);
const maskBox=await page.locator(".p-mask-editor canvas").boundingBox();await page.mouse.move(maskBox.x+maskBox.width*.3,maskBox.y+maskBox.height*.4);await page.mouse.down();await page.mouse.move(maskBox.x+maskBox.width*.7,maskBox.y+maskBox.height*.6,{steps:12});await page.mouse.up();await page.getByRole("button",{name:"确认 · 约 $0.03",exact:true}).click();await page.getByRole("img",{name:"已导出的 PNG 蒙版",exact:true}).waitFor();await page.getByRole("button",{name:"关闭",exact:true}).click();await page.locator(".p-loading").waitFor({state:"hidden"});
await page.locator('[data-picture="image-1-1"]').click();await page.getByRole("button",{name:"扩图",exact:true}).click();await page.locator(".p-expand-stage canvas").waitFor();await page.getByRole("button",{name:"16:9",exact:true}).click();const expandBox=await page.locator(".p-expand-stage canvas").boundingBox();await page.mouse.move(expandBox.x+100,expandBox.y+35);await page.mouse.down();await page.mouse.move(expandBox.x+65,expandBox.y+15,{steps:12});await page.mouse.up();assert((await page.getByRole("button",{name:"自定义",exact:true}).getAttribute("class")).includes("bg-secondary"));await page.getByRole("button",{name:"取消扩图",exact:true}).click();
await page.getByRole("button",{name:"定位客厅场景候选 02",exact:true}).click();await page.waitForTimeout(250);await page.locator('[data-picture="image-1-2"]').click({modifiers:["Control"]});await page.getByRole("button",{name:"对比",exact:true}).click();await page.getByRole("dialog").waitFor();assert.equal(await page.locator(".p-compare-grid img").count(),2);await page.getByRole("button",{name:"关闭",exact:true}).click();console.log("蒙版PNG、扩图角点及多选对比保留回归通过");
await reset();await go("/workspace");const sources=await page.locator("[data-picture] > img").evaluateAll(imgs=>imgs.map(i=>i.getAttribute("src")));assert.equal(sources.length,30);assert.equal(new Set(sources).size,30);
for(const width of [1600,1100,768,390]){await page.setViewportSize({width,height:1000});await go();await audit("home-width-"+width);await go("/workspace");await audit("workspace-width-"+width);}
await page.setViewportSize({width:1600,height:1000});
const hashes=await Promise.all(Array.from({length:30},async(_,i)=>crypto.createHash("sha256").update(await fs.readFile("public/design-preview/r3-"+String(i+1).padStart(2,"0")+".webp")).digest("hex")));assert.equal(new Set(hashes).size,30);
assert.deepEqual(errors,[]);assert.deepEqual(business,[]);assert.deepEqual(external,[]);assert.deepEqual([...new Set(diagnostics)],[]);
const screenshots=(await fs.readdir(out)).filter(n=>n.endsWith(".png"));assert.equal(screenshots.length,20);
await fs.writeFile(out+"/verification.json",JSON.stringify({passed:true,screenshots:screenshots.length,uniqueFurnitureImages:30,pageErrors:errors,businessApiRequests:business,externalRequests:external,diagnostics:[...new Set(diagnostics)],checks:["模型名仅来自统一配置","Auto多选与默认锁定","手动单选与质量档费用","localStorage刷新保持","首页到工作台继承","会话单独修改与系统消息","后台可见及启用联动","后台切换默认模型","四种宽度工具行单行","字体实际显示不小于12px","30张独立样图URL和文件哈希","双主题20张截图","真实工具条与Konva涂抹","保留蒙版PNG导出、扩图角点和多选对比"],audits},null,2)+"\n");
await context.storageState({path:".local/round3-storage.json"});await browser.close();console.log("第三轮全部检查通过，20张截图已保存");
