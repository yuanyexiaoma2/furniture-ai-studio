import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
import sharp from 'sharp';
const {GIFEncoder,quantize,applyPalette}=(await import('gifenc')).default;
const base=process.env.DESIGN_PREVIEW_URL??'http://localhost:3000';
const browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({storageState:'.local/preview-storage.json',viewport:{width:1280,height:800}});const page=await context.newPage();
await page.goto(base+'/design-preview/workspace');await page.waitForLoadState('networkidle');
await page.addStyleTag({content:'nextjs-portal{display:none!important}'});
await page.evaluate(()=>{const cursor=document.createElement('div');Object.assign(cursor.style,{position:'fixed',zIndex:'99999',width:'14px',height:'14px',border:'2px solid var(--foreground)',borderRadius:'50%',background:'var(--p-highlight)',pointerEvents:'none'});document.body.appendChild(cursor);document.addEventListener('mousemove',e=>{cursor.style.left=(e.clientX-7)+'px';cursor.style.top=(e.clientY-7)+'px';});});
const frames=[];let running=true,busy=false;const started=Date.now();
const timer=setInterval(async()=>{if(!running||busy)return;busy=true;try{frames.push({time:Date.now()-started,png:await page.screenshot()});}finally{busy=false;}},300);
try{
 await page.getByRole('button',{name:'适应屏幕',exact:true}).click();await page.waitForTimeout(700);
 const area=await page.locator('.p-canvas-wrap').boundingBox();await page.keyboard.down('Space');await page.mouse.move(area.x+300,area.y+65);await page.mouse.down();await page.mouse.move(area.x+370,area.y+105,{steps:18});await page.mouse.up();await page.keyboard.up('Space');await page.waitForTimeout(500);
 await page.getByRole('button',{name:'定位客厅场景候选 02',exact:true}).click();await page.waitForTimeout(650);
 const image=page.locator('[data-picture="image-1-1"]');const b=await image.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+30,b.y+b.height/2+20,{steps:12});await page.mouse.up();await page.waitForTimeout(450);
 await page.getByRole('button',{name:'局部重绘',exact:true}).click();await page.locator('.p-mask-editor canvas').waitFor();await page.waitForTimeout(450);
 const paint=await page.locator('.p-mask-editor canvas').boundingBox();await page.mouse.move(paint.x+paint.width*.3,paint.y+paint.height*.45);await page.mouse.down();await page.mouse.move(paint.x+paint.width*.75,paint.y+paint.height*.56,{steps:24});await page.mouse.up();await page.waitForTimeout(700);
 await page.getByRole('button',{name:'橡皮',exact:true}).click();await page.mouse.move(paint.x+paint.width*.5,paint.y+paint.height*.43);await page.mouse.down();await page.mouse.move(paint.x+paint.width*.5,paint.y+paint.height*.58,{steps:12});await page.mouse.up();await page.waitForTimeout(500);
 await page.getByRole('button',{name:'确认 · 约 $0.03',exact:true}).click();await page.getByRole('dialog').waitFor();await page.waitForTimeout(1100);await page.getByRole('button',{name:'关闭',exact:true}).click();await page.locator('.p-loading').waitFor({state:'hidden'});await page.waitForTimeout(350);
 await image.click();await page.getByRole('button',{name:'扩图',exact:true}).click();await page.locator('.p-expand-stage canvas').waitFor();await page.getByRole('button',{name:'16:9',exact:true}).click();await page.waitForTimeout(500);const expanded=await page.locator('.p-expand-stage canvas').boundingBox();await page.mouse.move(expanded.x+100,expanded.y+35);await page.mouse.down();await page.mouse.move(expanded.x+65,expanded.y+12,{steps:16});await page.mouse.up();await page.waitForTimeout(700);await page.getByRole('button',{name:'取消扩图',exact:true}).click();
 await page.getByRole('button',{name:'定位客厅场景候选 02',exact:true}).click();await page.waitForTimeout(350);await page.locator('[data-picture="image-1-2"]').click({modifiers:['Control']});await page.getByRole('button',{name:'对比',exact:true}).click();await page.waitForTimeout(1000);await page.getByRole('button',{name:'关闭',exact:true}).click();await page.waitForTimeout(700);
}finally{running=false;clearInterval(timer);while(busy)await new Promise(r=>setTimeout(r,30));}
const recorded=Date.now()-started;if(recorded>30000)throw new Error(`录屏超出 30 秒：${recorded}`);
const gif=GIFEncoder();for(let i=0;i<frames.length;i++){const {data,info}=await sharp(frames[i].png).ensureAlpha().raw().toBuffer({resolveWithObject:true});const pixels=new Uint8Array(data);const palette=quantize(pixels,256,{format:'rgb565'});const indices=applyPalette(pixels,palette,'rgb565');const delay=i+1<frames.length?frames[i+1].time-frames[i].time:300;gif.writeFrame(indices,info.width,info.height,{palette,delay,repeat:0});}
gif.finish();await fs.writeFile('docs/design-preview/canvas-demo.gif',gif.bytes());await fs.writeFile('docs/design-preview/recording.json',JSON.stringify({durationMs:recorded,width:1280,height:800,frames:frames.length,operations:['适应屏幕','空格平移','对话定位图片','单图拖动','局部涂抹','橡皮','PNG 蒙版导出预览','1.5 秒假生成','16:9 扩图及拖框','多选对比']},null,2)+'\n');console.log('画布录屏已保存',recorded,'ms',frames.length,'帧');await browser.close();
