import "server-only";
import {randomUUID} from "node:crypto";
import {db} from "./db";
import {downloadResultImage} from "./remote-image";
import {inspectPhoto,putObject} from "./storage";
import type {CompetitorInput} from "./visual-reference-rules";
export async function resolveCompetitorImages(productId:string,userId:string,inputs:CompetitorInput){
 const assets=await db.asset.findMany({where:{id:{in:inputs.assetIds},productId,deletedAt:null,type:"style_ref"}});
 const images=inputs.assetIds.flatMap(id=>assets.some(a=>a.id===id)?[{id,source:"用户上传截图"}]:[]);
 const sources=inputs.links.map(url=>({url,title:"用户提供的竞品链接",content:"仅为来源；视觉结论以实际读取的参考图为准"})),notes:string[]=[];
 for(const link of inputs.links){
  if(images.length>=10)break;
  try{
   let bytes=await downloadResultImage(link);
   if(!bytes.subarray(0,100).toString().includes("PNG"))try{await inspectPhoto(bytes);}catch{
    const html=bytes.toString("utf8"),tag=html.match(/<meta\b(?=[^>]*(?:property|name)=["']og:image["'])[^>]*>/i)?.[0],src=tag?.match(/content=["']([^"']+)["']/i)?.[1];
    if(!src)throw Error("无法读取页面参考图");bytes=await downloadResultImage(new URL(src.replaceAll("&amp;","&"),link).href);
   }
   const photo=await inspectPhoto(bytes),key="products/"+productId+"/competitors/"+randomUUID()+"."+photo.extension;
   await putObject(key,bytes,photo.mime);
   const asset=await db.asset.create({data:{productId,createdById:userId,type:"style_ref",storageKey:key,width:photo.width,height:photo.height}});
   images.push({id:asset.id,source:link});
  }catch{notes.push("竞品链接未能读取图片，请补上传截图："+link);}
 }
 return {images,sources,notes};
}
