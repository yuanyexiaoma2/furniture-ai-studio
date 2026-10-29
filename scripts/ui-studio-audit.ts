/** 旧页的只读排版、颜色和可访问性证据；不触发生成或保存。 */
import {createRequire} from "node:module";
import {readFile} from "node:fs/promises";
import type {Page} from "@playwright/test";
const require=createRequire(import.meta.url);
export async function auditStudioPage(page:Page,fullAxe:boolean){
 // tsx保留函数名时的纯浏览器辅助；只存在于回归上下文。
 await page.evaluate("window.__name=(fn)=>fn");
 const metrics=await page.evaluate(()=>{
  const canvas=document.createElement("canvas");canvas.width=canvas.height=1;const ctx=canvas.getContext("2d",{willReadFrequently:true})!;
  function rgba(color:string){ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return Array.from(ctx.getImageData(0,0,1,1).data).map((v,i)=>i===3?v/255:v);}
  function blend(a:number[],b:number[]){return a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3])).concat(1);}
  function background(e:Element){const chain:Element[]=[];for(let n:Element|null=e;n;n=n.parentElement)chain.unshift(n);return chain.reduce((bg,n)=>blend(rgba(getComputedStyle(n).backgroundColor),bg),[255,255,255,1]);}
  function lum(c:number[]){return c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);}
  function contrast(a:number[],b:number[]){const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
  const visible=(e:HTMLElement)=>!!e.getClientRects().length&&!e.closest(".sr-only")&&getComputedStyle(e).visibility!=="hidden"&&Number(getComputedStyle(e).opacity)>0;
  const all=[...document.querySelectorAll<HTMLElement>(".studio-shell *,.login-shell *")].filter(visible);
  const texts=all.filter(e=>[...e.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent?.trim())&&!e.closest("[aria-hidden=true],button:disabled,input:disabled,select:disabled"));
  const textMetrics=texts.map(e=>{const s=getComputedStyle(e),bg=background(e),fg=blend(rgba(s.color),bg);return {selector:e.tagName.toLowerCase()+(typeof e.className==="string"&&e.className?"."+e.className.trim().replaceAll(/\s+/g,"."):""),text:e.innerText?.slice(0,100),fontSize:s.fontSize,color:s.color,background:bg.slice(0,3),contrast:contrast(fg,bg),clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,overflow:e.clientWidth>0&&e.scrollWidth>e.clientWidth+1&&!["auto","scroll"].includes(s.overflowX),wrap:s.overflowWrap};});
  const controls=all.filter(e=>e.matches("input:not([type=checkbox]):not([type=radio]):not([type=hidden]),textarea,select")).map(e=>{
   const s=getComputedStyle(e),field=e as HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement,bg=background(e),placeholder="placeholder" in field?field.placeholder:"",ps=getComputedStyle(e,"::placeholder");
   return {tag:e.tagName,label:e.getAttribute("aria-label")??e.id,background:s.backgroundColor,border:s.borderColor,borderWidth:s.borderWidth,contrast:contrast(blend(rgba(s.borderTopColor),bg),bg),exempt:e.matches(":disabled"),textContrast:field.value?contrast(blend(rgba(s.color),bg),bg):null,placeholderContrast:!field.value&&placeholder?contrast(blend(rgba(ps.color),bg),bg):null};
  });
  const whiteSurfaces=all.filter(e=>{const c=rgba(getComputedStyle(e).backgroundColor);return c[3]>.9&&c.slice(0,3).every(v=>v>240)&&!e.matches("button,[data-slot=button],.pack-entry,.brand-symbol,.bg-primary,.p-brand-icon,[data-slot=switch-thumb]")&&!e.closest("button,[data-slot=button],.pack-entry");}).map(e=>({tag:e.tagName,classes:e.className}));
  const root=getComputedStyle(document.documentElement),variables=Object.fromEntries(["--background","--foreground","--card","--card-foreground","--popover","--popover-foreground","--primary","--primary-foreground","--secondary","--secondary-foreground","--muted","--muted-foreground","--accent","--accent-foreground","--destructive","--border","--input","--ring","--radius","--font-body"].map(k=>[k,root.getPropertyValue(k).trim()]));
  return {variables,controlContrastFailures:controls.filter(c=>!c.exempt&&((c.textContrast!==null&&c.textContrast<4.5)||(c.placeholderContrast!==null&&c.placeholderContrast<4.5))),textMetrics,contrastFailures:textMetrics.filter(m=>m.contrast<4.5),smallFonts:textMetrics.filter(m=>parseFloat(m.fontSize)<12),overflows:textMetrics.filter(m=>m.overflow),controls,whiteSurfaces,pageOverflow:document.documentElement.scrollWidth>innerWidth+1};
 });
 await page.addScriptTag({content:await readFile(require.resolve("axe-core/axe.min.js"),"utf8")});
 const axe=await page.evaluate(async(full)=>{
  const engine=(window as unknown as {axe:{run:(context:Document,options:unknown)=>Promise<{violations:unknown[];incomplete:unknown[];passes:{id:string}[]}>}}).axe;
  const result=await engine.run(document,full?{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa"]}}:{runOnly:{type:"rule",values:["color-contrast"]}});
  return {violations:result.violations,incomplete:result.incomplete,passes:result.passes.map(p=>p.id)};
 },fullAxe);
 return {...metrics,axe};
}
