import fs from "node:fs/promises";
import assert from "node:assert/strict";
import {chromium} from "@playwright/test";
const base=process.env.DESIGN_PREVIEW_URL??"http://localhost:3001",out="docs/task-8a";
const browser=await chromium.launch({channel:"chrome",headless:true}),context=await browser.newContext({storageState:".local/round3-storage.json",viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[],business=[];
page.on("pageerror",e=>errors.push(e.message));await page.route("**/api/**",r=>{if(new URL(r.request().url()).pathname.startsWith("/api/auth/"))return r.continue();business.push(r.request().url());return r.abort();});
await page.goto(base+"/design-preview");await page.waitForLoadState("networkidle");await page.evaluate(()=>{localStorage.removeItem("furniture-preview-library-8a");localStorage.removeItem("furniture-preview-models-v3");});await page.reload();await page.waitForLoadState("networkidle");await page.getByRole("button",{name:"主题切换",exact:true}).click();await page.getByRole("menuitemradio",{name:"亮色",exact:true}).click();
await page.evaluate(()=>{const cursor=document.createElement("div");Object.assign(cursor.style,{position:"fixed",zIndex:99999,width:"16px",height:"16px",border:"2px solid var(--foreground)",borderRadius:"50%",background:"var(--p-highlight)",pointerEvents:"none",left:"30px",top:"30px"});document.body.appendChild(cursor);document.addEventListener("mousemove",e=>{cursor.style.left=e.clientX-8+"px";cursor.style.top=e.clientY-8+"px";});});
const originals=await Promise.all([25,28].map(async(n,i)=>({name:i?"45度.webp":"正面.webp",base64:(await fs.readFile("public/design-preview/r3-"+n+".webp")).toString("base64")})));
const frames=[];let busy=false,running=true;const started=Date.now();
const timer=setInterval(async()=>{if(busy||!running)return;busy=true;try{frames.push({time:Date.now()-started,png:await page.screenshot()});}finally{busy=false;}},300);
try{
 await page.waitForTimeout(600);
 const transfer=await page.evaluateHandle(files=>{const dt=new DataTransfer();for(const f of files){const bytes=Uint8Array.from(atob(f.base64),c=>c.charCodeAt(0));dt.items.add(new File([bytes],f.name,{type:"image/webp"}));}return dt;},originals);
 await page.locator(".p-home-input").dispatchEvent("dragenter",{dataTransfer:transfer});await page.waitForTimeout(600);await page.locator(".p-home-input").dispatchEvent("drop",{dataTransfer:transfer});await page.getByText("2 张实拍",{exact:true}).waitFor();await page.waitForTimeout(800);
 await page.getByLabel("首页创作要求",{exact:true}).pressSequentially("给这款边桌做一组自然的卧室场景",{delay:30});await page.getByRole("button",{name:"发送并进入工作台",exact:true}).click();await page.waitForURL("**/design-preview/workspace");await page.waitForTimeout(800);
 await page.getByRole("button",{name:/^(规划图包|再规划一组)$/}).click();await page.waitForTimeout(1200);await page.getByRole("button",{name:"生成候选",exact:true}).click();await page.locator(".l-chat-candidate").waitFor();await page.locator(".l-chat-candidate").click();await page.waitForTimeout(1100);
 await page.getByRole("button",{name:"设为终稿",exact:true}).click();await page.getByLabel("收藏名称",{exact:true}).fill("卧室·边桌·我的晨光");await page.waitForTimeout(1300);await page.getByRole("button",{name:"存",exact:true}).click();await page.waitForTimeout(800);
 await page.getByRole("link",{name:"去库里看看",exact:true}).click();await page.waitForTimeout(650);await page.getByLabel("组合搜索模板库",{exact:true}).pressSequentially("边桌 卧室 我的晨光",{delay:80});await page.waitForTimeout(1500);assert.equal(await page.locator(".l-entry-card").count(),1);
 await page.getByRole("link",{name:"首页",exact:true}).click();await page.getByRole("button",{name:/^产品卡/}).click();await page.waitForURL("**/design-preview/product");await page.getByRole("button",{name:"升级为严格",exact:true}).click();await page.waitForTimeout(1100);await page.getByRole("button",{name:"关闭",exact:true}).click();await page.locator(".l-shooting-card").waitFor();await page.locator(".l-shooting-card").scrollIntoViewIfNeeded();await page.waitForTimeout(1400);await page.getByRole("button",{name:"先跳过",exact:true}).click();await page.waitForTimeout(700);await page.getByRole("button",{name:/^(规划图包|再规划一组)$/}).click();await page.waitForTimeout(1000);
 await page.getByRole("button",{name:"主题切换",exact:true}).click();await page.getByRole("menuitemradio",{name:"暗色",exact:true}).click();await page.waitForTimeout(1300);const toolbar=await page.locator(".p-toolbar").boundingBox();assert(toolbar.x>=439&&toolbar.x+toolbar.width<=1441,"画布工具条不能被对话栏或屏幕边缘遮挡");
}finally{running=false;clearInterval(timer);while(busy)await new Promise(r=>setTimeout(r,30));}
const duration=Date.now()-started;assert.deepEqual(errors,[]);assert.deepEqual(business,[]);console.log("真实拖拽与操作采集完成",duration,"ms",frames.length,"帧");
const encoder=await context.newPage();await encoder.setContent('<canvas width="1440" height="900"></canvas>');
const video=await encoder.evaluate(async frames=>{
 const canvas=document.querySelector("canvas"),ctx=canvas.getContext("2d"),stream=canvas.captureStream(0),track=stream.getVideoTracks()[0],chunks=[],mime=MediaRecorder.isTypeSupported("video/webm;codecs=vp9")?"video/webm;codecs=vp9":"video/webm;codecs=vp8";
 const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:2400000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const stopped=new Promise(resolve=>recorder.onstop=resolve);recorder.start();
 for(let i=0;i<frames.length;i++){const img=new Image();img.src=frames[i].url;await img.decode();ctx.drawImage(img,0,0);track.requestFrame();await new Promise(resolve=>setTimeout(resolve,i+1<frames.length?frames[i+1].time-frames[i].time:300));}
 recorder.stop();await stopped;track.stop();return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(",")[1]);reader.readAsDataURL(new Blob(chunks,{type:mime}));});
},frames.map(f=>({time:f.time,url:"data:image/png;base64,"+f.png.toString("base64")})));
await fs.writeFile(out+"/task8a-demo.webm",Buffer.from(video,"base64"));
await fs.mkdir(".local/task8a-video-frames",{recursive:true});for(const n of [0,Math.floor(frames.length*.25),Math.floor(frames.length*.5),Math.floor(frames.length*.75),frames.length-1])await fs.writeFile(".local/task8a-video-frames/"+n+".png",frames[n].png);
await fs.writeFile(out+"/recording.json",JSON.stringify({sourceDurationMs:duration,width:1440,height:900,sourceFrames:frames.length,format:"WebM VP9 / 实际浏览器操作帧",operations:["快速档真实拖入2张实拍","直接规划并生成本地候选","选中图片显示工具条","设为终稿触发沉淀建议","保存个人场景模板","模板库交集搜索命中","当前任务升级严格档后的缺失提醒","先跳过后继续规划","切换暗色"],pageErrors:errors,businessApiRequests:business},null,2)+"\n");
await browser.close();console.log("8A 录屏已保存");
