import fs from "node:fs/promises";
import assert from "node:assert/strict";
import {chromium} from "@playwright/test";
const base=process.env.DESIGN_PREVIEW_URL??"http://localhost:3001",out="docs/task-9";
const browser=await chromium.launch({channel:"chrome",headless:true}),context=await browser.newContext({storageState:".local/task8a-storage.json",viewport:{width:1600,height:1000}}),page=await context.newPage(),errors=[],business=[];
page.on("pageerror",e=>errors.push(e.message));
await page.route("**/api/**",r=>{if(new URL(r.request().url()).pathname.startsWith("/api/auth/"))return r.continue();business.push(r.request().url());return r.abort();});
await page.goto(base+"/design-preview/workspace");await page.waitForLoadState("networkidle");await page.evaluate(()=>{for(const key of ["furniture-preview-library-8a","furniture-preview-models-v3","furniture-preview-workflows-9"])localStorage.removeItem(key);});await page.reload();await page.waitForLoadState("networkidle");await page.getByRole("button",{name:"亮色主题",exact:true}).click();
await page.evaluate(()=>{const cursor=document.createElement("div");Object.assign(cursor.style,{position:"fixed",zIndex:99999,width:"16px",height:"16px",border:"2px solid var(--foreground)",borderRadius:"50%",background:"var(--p-highlight)",pointerEvents:"none",left:"30px",top:"30px"});document.body.appendChild(cursor);document.addEventListener("mousemove",e=>{cursor.style.left=e.clientX-8+"px";cursor.style.top=e.clientY-8+"px";});});
const frames=[];let busy=false,running=true;const started=Date.now();
const timer=setInterval(async()=>{if(busy||!running)return;busy=true;try{frames.push({time:Date.now()-started,png:await page.screenshot()});}finally{busy=false;}},250);
try{
 await page.waitForTimeout(1300);
 await page.getByRole("button",{name:"批量换色·换变体 沿用终稿，一次扩展多个颜色",exact:false}).click();await page.waitForTimeout(1400);
 await page.locator(".w-pack-options>button").filter({hasText:"云屿"}).click();await page.waitForTimeout(1400);
 await page.locator(".w-variant-list").scrollIntoViewIfNeeded();await page.waitForTimeout(1500);
 await page.getByLabel("变体名称1",{exact:true}).focus();await page.waitForTimeout(500);
 await page.getByLabel("变体名称2",{exact:true}).focus();await page.waitForTimeout(500);
 await page.getByLabel("变体名称3",{exact:true}).focus();await page.waitForTimeout(800);
 await page.getByRole("button",{name:"生成颜色变体",exact:true}).scrollIntoViewIfNeeded();await page.waitForTimeout(1700);
 await page.getByRole("button",{name:"生成颜色变体",exact:true}).click();await page.waitForTimeout(1400);
 await page.getByRole("button",{name:"确认费用并生成",exact:true}).click();
 await page.getByText("3 个颜色 Frame 已准备好",{exact:true}).waitFor();await page.waitForTimeout(2600);
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem("furniture-preview-workflows-9")).state);assert.equal(state.outputs.length,3);assert.equal(state.outputs.flatMap(f=>f.jobs).length,9);
 await page.getByRole("button",{name:"暗色主题",exact:true}).click();await page.waitForTimeout(2200);
}finally{running=false;clearInterval(timer);while(busy)await new Promise(r=>setTimeout(r,30));}
const duration=Date.now()-started;assert.deepEqual(errors,[]);assert.deepEqual(business,[]);console.log("实际操作采集",duration,"ms",frames.length,"帧");
const encoder=await context.newPage();await encoder.setContent('<canvas width="1600" height="1000"></canvas>');
const video=await encoder.evaluate(async frames=>{
 const canvas=document.querySelector("canvas"),ctx=canvas.getContext("2d"),stream=canvas.captureStream(0),track=stream.getVideoTracks()[0],chunks=[],mime=MediaRecorder.isTypeSupported("video/webm;codecs=vp9")?"video/webm;codecs=vp9":"video/webm;codecs=vp8";
 const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3000000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const stopped=new Promise(resolve=>recorder.onstop=resolve);recorder.start();
 for(let i=0;i<frames.length;i++){const img=new Image();img.src=frames[i].url;await img.decode();ctx.drawImage(img,0,0);track.requestFrame();await new Promise(resolve=>setTimeout(resolve,i+1<frames.length?frames[i+1].time-frames[i].time:250));}
 recorder.stop();await stopped;track.stop();return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(",")[1]);reader.readAsDataURL(new Blob(chunks,{type:mime}));});
},frames.map(f=>({time:f.time,url:"data:image/png;base64,"+f.png.toString("base64")})));
await fs.writeFile(out+"/task9-batch-demo.webm",Buffer.from(video,"base64"));
await fs.mkdir(".local/task9-video-frames",{recursive:true});for(const n of [0,Math.floor(frames.length*.3),Math.floor(frames.length*.6),frames.length-1])await fs.writeFile(".local/task9-video-frames/"+n+".png",frames[n].png);
await fs.writeFile(out+"/recording.json",JSON.stringify({sourceDurationMs:duration,width:1600,height:1000,sourceFrames:frames.length,format:"WebM VP9 / 实际浏览器操作帧",operations:["空对话任务入口","选择已定稿图包","三个变体与色卡参考","选择图位与费用确认","模拟生成三组颜色Frame","切换暗色"],pageErrors:errors,businessApiRequests:business},null,2)+"\n");
await browser.close();console.log("任务9录屏已保存");
