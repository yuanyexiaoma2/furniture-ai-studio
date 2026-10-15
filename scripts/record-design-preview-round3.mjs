import fs from "node:fs/promises";
import assert from "node:assert/strict";
import {chromium} from "@playwright/test";
const base=process.env.DESIGN_PREVIEW_URL??"http://localhost:3001",out="docs/design-preview/round3";
const browser=await chromium.launch({channel:"chrome",headless:true});
const context=await browser.newContext({storageState:".local/round3-storage.json",viewport:{width:1440,height:900}});
const page=await context.newPage(),errors=[],business=[];page.on("pageerror",e=>errors.push(e.message));
await page.route("**/api/**",r=>{if(new URL(r.request().url()).pathname.startsWith("/api/auth/"))return r.continue();business.push(r.request().url());return r.abort();});
await page.goto(base+"/design-preview");await page.waitForLoadState("networkidle");await page.evaluate(()=>localStorage.removeItem("furniture-preview-models-v3"));await page.reload();await page.waitForLoadState("networkidle");await page.getByRole("button",{name:"主题切换",exact:true}).click();await page.getByRole("menuitemradio",{name:"亮色",exact:true}).click();
await page.evaluate(()=>{const cursor=document.createElement("div");cursor.id="recording-pointer";Object.assign(cursor.style,{position:"fixed",zIndex:99999,width:"15px",height:"15px",border:"2px solid var(--foreground)",borderRadius:"50%",background:"var(--p-highlight)",pointerEvents:"none",left:"20px",top:"20px"});document.body.appendChild(cursor);document.addEventListener("mousemove",e=>{cursor.style.left=e.clientX-7+"px";cursor.style.top=e.clientY-7+"px";});});
const frames=[];let busy=false,running=true;const started=Date.now();
const timer=setInterval(async()=>{if(busy||!running)return;busy=true;try{frames.push({time:Date.now()-started,png:await page.screenshot()});}finally{busy=false;}},250);
try{
 await page.waitForTimeout(500);await page.getByRole("button",{name:"智能体模型",exact:true}).click();await page.waitForTimeout(1000);await page.getByRole("radio",{name:"Gemini 3.8 Flash",exact:true}).click();await page.waitForTimeout(650);
 await page.getByRole("button",{name:"生图模型",exact:true}).click();await page.waitForTimeout(900);await page.getByRole("switch",{name:"自动挑选生图模型",exact:true}).click();await page.getByRole("radio",{name:"GPT Image 2",exact:true}).click();await page.waitForTimeout(900);await page.keyboard.press("Escape");
 await page.getByRole("textbox",{name:"首页创作要求",exact:true}).pressSequentially("帮我为这款家具做一套自然温暖的商品图",{delay:45});await page.waitForTimeout(650);await page.getByRole("button",{name:"发送并进入工作台",exact:true}).click();await page.waitForURL("**/design-preview/workspace");await page.waitForLoadState("networkidle");await page.waitForTimeout(700);
 await page.getByRole("button",{name:"定位客厅场景候选 02",exact:true}).click();await page.waitForTimeout(350);await page.locator('[data-picture="image-1-1"]').click();await page.getByRole("button",{name:"局部重绘",exact:true}).waitFor();await page.waitForTimeout(1200);
 await page.getByRole("button",{name:"局部重绘",exact:true}).click();await page.locator(".p-mask-editor canvas").waitFor();await page.waitForTimeout(400);const paint=await page.locator(".p-mask-editor canvas").boundingBox();assert(paint.width>=380,"编辑放大必须生效");
 await page.mouse.move(paint.x+paint.width*.25,paint.y+paint.height*.4);await page.mouse.down();await page.mouse.move(paint.x+paint.width*.75,paint.y+paint.height*.55,{steps:30});await page.mouse.up();await page.waitForTimeout(1000);
 await page.getByRole("button",{name:"主题切换",exact:true}).click();await page.waitForTimeout(500);await page.getByRole("menuitemradio",{name:"暗色",exact:true}).click();await page.waitForTimeout(1600);
}finally{running=false;clearInterval(timer);while(busy)await new Promise(r=>setTimeout(r,30));}
const duration=Date.now()-started;assert(duration<=45000,"录屏不超过45秒");assert.deepEqual(errors,[]);assert.deepEqual(business,[]);
console.log("真实操作采集完成",duration,"ms",frames.length,"帧，编码 WebM");
const encoder=await context.newPage();await encoder.setContent('<canvas width="1440" height="900"></canvas>');
const video=await encoder.evaluate(async frames=>{
 const canvas=document.querySelector("canvas"),ctx=canvas.getContext("2d"),stream=canvas.captureStream(0),track=stream.getVideoTracks()[0],chunks=[];
 const mime=MediaRecorder.isTypeSupported("video/webm;codecs=vp9")?"video/webm;codecs=vp9":"video/webm;codecs=vp8";
 const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:2200000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 const stopped=new Promise(resolve=>recorder.onstop=resolve);recorder.start();
 for(let i=0;i<frames.length;i++){const img=new Image();img.src=frames[i].url;await img.decode();ctx.drawImage(img,0,0);track.requestFrame();await new Promise(resolve=>setTimeout(resolve,i+1<frames.length?frames[i+1].time-frames[i].time:250));}
 recorder.stop();await stopped;track.stop();const blob=new Blob(chunks,{type:mime});return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(",")[1]);reader.readAsDataURL(blob);});
},frames.map(f=>({time:f.time,url:"data:image/png;base64,"+f.png.toString("base64")})));
await fs.writeFile(out+"/round3-demo.webm",Buffer.from(video,"base64"));
await fs.mkdir(".local/round3-recording-frames",{recursive:true});for(const n of [0,Math.floor(frames.length*.2),Math.floor(frames.length*.5),Math.floor(frames.length*.75),frames.length-1])await fs.writeFile(".local/round3-recording-frames/frame-"+n+".png",frames[n].png);
await fs.writeFile(out+"/recording.json",JSON.stringify({durationMs:duration,width:1440,height:900,sourceFrames:frames.length,format:"WebM / VP9（浏览器实际操作帧）",operations:["首页选择智能体模型","首页指定生图模型","发送要求","进入工作台并沿用选择","选中图片并显示完整浮动工具条","局部重绘放大与真实涂抹","编辑中切换暗色"],pageErrors:errors,businessApiRequests:business},null,2)+"\n");
await browser.close();console.log("第三轮录屏已保存",out+"/round3-demo.webm");
