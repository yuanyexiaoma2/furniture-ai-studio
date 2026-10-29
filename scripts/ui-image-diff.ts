/** 严格逐像素比较用于阈值；位移对齐只作诊断，不放宽验收。 */
import {readFile,rm} from "node:fs/promises";
import sharp from "sharp";
export async function compareScreenshots(baseline:string,image:Buffer,diffPath:string,allowSizeChange:boolean){
 const before=await sharp(await readFile(baseline)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const after=await sharp(image).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const resized=before.info.width!==after.info.width||before.info.height!==after.info.height;
 if(resized&&!allowSizeChange)throw Error(`截图尺寸改变：${before.info.width}x${before.info.height} → ${after.info.width}x${after.info.height}`);
 const width=Math.max(before.info.width,after.info.width),height=Math.max(before.info.height,after.info.height),totalPixels=width*height;
 const diff=Buffer.alloc(totalPixels*4);
 function count(shift:number,paint=false){let changedPixels=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const a=y<before.info.height&&x<before.info.width?(y*before.info.width+x)*4:-1;
   const by=y+shift,b=by>=0&&by<after.info.height&&x<after.info.width?(by*after.info.width+x)*4:-1;
   const changed=a<0||b<0||before.data[a]!==after.data[b]||before.data[a+1]!==after.data[b+1]||before.data[a+2]!==after.data[b+2]||before.data[a+3]!==after.data[b+3];
   if(changed)changedPixels++;
   if(paint){const i=(y*width+x)*4;diff.set(changed?[238,55,75,255]:[after.data[b],after.data[b+1],after.data[b+2],40],i);}
  }return changedPixels;
 }
 const changedPixels=count(0,true);let alignedChangedPixels=changedPixels,verticalOffset=0;
 if(before.info.height!==after.info.height)for(let shift=-8;shift<=8;shift++){if(!shift)continue;const n=count(shift);if(n<alignedChangedPixels){alignedChangedPixels=n;verticalOffset=shift;}}
 if(changedPixels)await sharp(diff,{raw:{width,height,channels:4}}).png().toFile(diffPath);else await rm(diffPath,{force:true});
 return {width:after.info.width,height:after.info.height,changedPixels,totalPixels,differencePercent:changedPixels/totalPixels*100,alignedDifferencePercent:alignedChangedPixels/totalPixels*100,verticalOffset,alignmentRange:8,...(resized?{baselineSize:{width:before.info.width,height:before.info.height}}:{})};
}
