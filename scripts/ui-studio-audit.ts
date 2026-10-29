/** 旧页的只读排版、颜色和可访问性证据；不触发生成或保存。 */
import {createRequire} from "node:module";
import {readFile} from "node:fs/promises";
import sharp from "sharp";
import type {Page} from "@playwright/test";
const require=createRequire(import.meta.url);
export async function auditStudioPage(page:Page,fullAxe:boolean,selector=".studio-shell *,.login-shell *"){
 // tsx保留函数名时的纯浏览器辅助；只存在于回归上下文。
 await page.evaluate("window.__name=(fn)=>fn");
 const metrics=await page.evaluate(selector=>{
  const canvas=document.createElement("canvas");canvas.width=canvas.height=1;const ctx=canvas.getContext("2d",{willReadFrequently:true})!;
  function rgba(color:string){ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return Array.from(ctx.getImageData(0,0,1,1).data).map((v,i)=>i===3?v/255:v);}
  function blend(a:number[],b:number[]){return a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3])).concat(1);}
  function background(e:Element){const chain:Element[]=[];for(let n:Element|null=e;n;n=n.parentElement)chain.unshift(n);return chain.reduce((bg,n)=>blend(rgba(getComputedStyle(n).backgroundColor),bg),[255,255,255,1]);}
  function lum(c:number[]){return c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);}
  function contrast(a:number[],b:number[]){const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
  const visible=(e:HTMLElement)=>{if(!e.getClientRects().length||e.closest(".sr-only"))return false;for(let n:Element|null=e;n;n=n.parentElement){const s=getComputedStyle(n);if(s.visibility==="hidden"||Number(s.opacity)===0)return false;}return true;};
  const all=[...document.querySelectorAll<HTMLElement>(selector)].filter(visible);
  const texts=all.filter(e=>[...e.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent?.trim())&&!e.closest("[aria-hidden=true],button:disabled,input:disabled,select:disabled"));
  const textMetrics=texts.map((e,index)=>{
   const s=getComputedStyle(e),bg=background(e),fg=blend(rgba(s.color),bg),rect=e.getBoundingClientRect();
   let raster=false,opacity=1,stack=0;
   const overlays:{top:number;height:number;from:number[];to:number[]}[]=[];
   for(let n:Element|null=e;n;n=n.parentElement){
    const ns=getComputedStyle(n);opacity*=Number(ns.opacity);stack=Math.max(stack,Number.parseInt(ns.zIndex)||0);
    if(ns.backgroundImage!=="none"||["::before","::after"].some(p=>getComputedStyle(n!,p).backgroundImage!=="none"))raster=true;
    for(const pseudo of ["::before","::after"]){const ps=getComputedStyle(n,pseudo),colors=ps.backgroundImage.match(/rgba?\([^)]+\)/g);if(Number(ps.zIndex)>stack&&colors?.length===2&&ps.backgroundImage.replace(/rgba?\([^)]+\)/g,"")==="linear-gradient(, )")overlays.push({top:n.getBoundingClientRect().top+scrollY+parseFloat(ps.top),height:parseFloat(ps.height),from:rgba(colors[0]),to:rgba(colors[1])});}
   }
   if(selector.includes(".p-app"))for(const img of document.images){const r=img.getBoundingClientRect();if(r.left<rect.right&&r.right>rect.left&&r.top<rect.bottom&&r.bottom>rect.top)raster=true;}
   const ranges=[...e.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE&&n.textContent?.trim()).flatMap(n=>{const range=document.createRange();range.selectNode(n);return [...range.getClientRects()].map(r=>({x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height}));});
   if(raster)e.setAttribute("data-ui-audit-text",String(index));
   return {selector:e.tagName.toLowerCase()+(typeof e.className==="string"&&e.className?"."+e.className.trim().replaceAll(/\s+/g,"."):""),text:e.innerText?.slice(0,100),fontSize:s.fontSize,color:s.color,background:bg.slice(0,3),contrast:contrast(fg,bg),clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,overflow:e.clientWidth>0&&e.scrollWidth>e.clientWidth+1&&!["auto","scroll"].includes(s.overflowX),wrap:s.overflowWrap,raster,index,opacity,foreground:rgba(s.color),overlays,ranges};
  });
  const controls=all.filter(e=>e.matches("input:not([type=checkbox]):not([type=radio]):not([type=hidden]),textarea,select")).map(e=>{
   const s=getComputedStyle(e),field=e as HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement,bg=background(e),placeholder="placeholder" in field?field.placeholder:"",ps=getComputedStyle(e,"::placeholder");
   let frame:HTMLElement|null=e;
   while(frame&&frame!==document.body){const f=getComputedStyle(frame);if(parseFloat(f.borderTopWidth)>0&&rgba(f.borderTopColor)[3]>0)break;frame=frame.parentElement;}
   if(frame===document.body)frame=null;
   const f=frame?getComputedStyle(frame):null,fb=frame?background(frame):bg;
   // 用户确认：暗色创作输入区以表面、placeholder及发送按钮识别，静止细线为装饰。
   // 仅豁免这两个复合输入区的静止边界；文字和实际聚焦描边仍分别检查。
   const decorative=document.documentElement.classList.contains("dark")&&!!frame?.matches(".p-home-input,.p-chat-input");
   return {tag:e.tagName,label:e.getAttribute("aria-label")??e.id,background:s.backgroundColor,border:s.borderColor,borderWidth:s.borderWidth,contrast:contrast(blend(rgba(s.borderTopColor),bg),bg),boundary:frame&&f?{selector:frame.tagName+"."+frame.className,color:f.borderTopColor,contrast:contrast(blend(rgba(f.borderTopColor),fb),fb),width:f.borderTopWidth,decorative}:null,exempt:e.matches(":disabled"),textContrast:field.value?contrast(blend(rgba(s.color),bg),bg):null,placeholderContrast:!field.value&&placeholder?contrast(blend(rgba(ps.color),bg),bg):null};
  });
  const whiteSurfaces=all.filter(e=>{const c=rgba(getComputedStyle(e).backgroundColor);return c[3]>.9&&c.slice(0,3).every(v=>v>240)&&!e.matches("button,[data-slot=button],.pack-entry,.brand-symbol,.bg-primary,.p-brand-icon,[data-slot=switch-thumb]")&&!e.closest("button,[data-slot=button],.pack-entry");}).map(e=>({tag:e.tagName,classes:e.className}));
  const root=getComputedStyle(document.documentElement),variables=Object.fromEntries(["--background","--foreground","--card","--card-foreground","--popover","--popover-foreground","--primary","--primary-foreground","--secondary","--secondary-foreground","--muted","--muted-foreground","--accent","--accent-foreground","--destructive","--border","--input","--ring","--p-subtle","--p-text","--p-panel","--studio-muted-ink","--studio-control-line","--studio-input-surface","--radius","--font-body"].map(k=>[k,root.getPropertyValue(k).trim()]));
  return {variables,controlContrastFailures:controls.filter(c=>!c.exempt&&((c.textContrast!==null&&c.textContrast<4.5)||(c.placeholderContrast!==null&&c.placeholderContrast<4.5))),textMetrics,contrastFailures:textMetrics.filter(m=>m.contrast<4.5),smallFonts:textMetrics.filter(m=>parseFloat(m.fontSize)<12),overflows:textMetrics.filter(m=>m.overflow),controls,whiteSurfaces,pageOverflow:document.documentElement.scrollWidth>innerWidth+1};
 },selector);
 // 图片、渐变和半透明背景不能只看background-color。隐藏文字但保留图片/叠层，
 // 在原文字笔画像素位置采样真实背景；不修改生产组件，也不把axe未决项算作通过。
 if(selector.includes(".p-app")&&metrics.textMetrics.some(m=>m.raster)){
  const original=await sharp(await page.screenshot({fullPage:true,animations:"disabled",caret:"hide"})).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const style=await page.addStyleTag({content:"[data-ui-audit-text],[data-ui-audit-text] *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}"});
  let underlay:typeof original;
  try{underlay=await sharp(await page.screenshot({fullPage:true,animations:"disabled",caret:"hide"})).ensureAlpha().raw().toBuffer({resolveWithObject:true});}finally{await style.evaluate(e=>e.parentNode?.removeChild(e));}
  const luminance=(c:number[])=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  for(const m of metrics.textMetrics.filter(m=>m.raster)){
   let minimum=Infinity,samples=0;
   for(const r of m.ranges)for(let y=Math.max(0,Math.floor(r.y));y<Math.min(original.info.height,Math.ceil(r.y+r.height));y++)for(let x=Math.max(0,Math.floor(r.x));x<Math.min(original.info.width,Math.ceil(r.x+r.width));x++){
    const i=(y*original.info.width+x)*4;
    if(Math.max(...[0,1,2].map(k=>Math.abs(original.data[i+k]-underlay.data[i+k])))<24)continue;
    const bg=[0,1,2].map(k=>underlay.data[i+k]),alpha=m.foreground[3]*m.opacity;
    let fg=bg.map((v,k)=>m.foreground[k]*alpha+v*(1-alpha));
    for(const o of m.overlays){if(y<o.top||y>=o.top+o.height)continue;const t=(y-o.top)/o.height,c=o.from.map((v,k)=>v+(o.to[k]-v)*t);fg=fg.map((v,k)=>c[k]*c[3]+v*(1-c[3]));}
    const a=luminance(fg),b=luminance(bg);
    minimum=Math.min(minimum,(Math.max(a,b)+.05)/(Math.min(a,b)+.05));samples++;
   }
   Object.assign(m,{domContrast:m.contrast,rasterSamples:samples});
   if(samples)m.contrast=minimum;
   else Object.assign(m,{rasterUnresolved:true});
  }
  metrics.contrastFailures=metrics.textMetrics.filter(m=>m.contrast<4.5);
  await page.locator("[data-ui-audit-text]").evaluateAll(es=>es.forEach(e=>e.removeAttribute("data-ui-audit-text")));
 }
 await page.addScriptTag({content:await readFile(require.resolve("axe-core/axe.min.js"),"utf8")});
 const axe=await page.evaluate(async(full)=>{
  const engine=(window as unknown as {axe:{run:(context:Document,options:unknown)=>Promise<{violations:unknown[];incomplete:unknown[];passes:{id:string}[]}>}}).axe;
  const result=await engine.run(document,full?{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa"]}}:{runOnly:{type:"rule",values:["color-contrast"]}});
  return {violations:result.violations,incomplete:result.incomplete,passes:result.passes.map(p=>p.id)};
 },fullAxe);
 return {...metrics,axe};
}
