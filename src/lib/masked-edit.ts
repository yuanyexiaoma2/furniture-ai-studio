import sharp from "sharp";

// KIE 的多图编辑采用蒙版参考；落盘前以同一蒙版合成，确保未选区域像素不变。
export async function compositeMaskedEdit(original:Buffer,generated:Buffer,mask:Buffer){
 const meta=await sharp(original).metadata(),width=meta.width!,height=meta.height!;
 const maskMeta=await sharp(mask).metadata();
 if(maskMeta.width!==width||maskMeta.height!==height)throw new Error("蒙版尺寸必须与原图完全一致");
 const source=await sharp(original).removeAlpha().raw().toBuffer();
 const changed=await sharp(generated).resize(width,height,{fit:"fill"}).removeAlpha().raw().toBuffer();
 const weights=await sharp(mask).flatten({background:"black"}).greyscale().raw().toBuffer();
 const output=Buffer.alloc(source.length);
 for(let p=0;p<weights.length;p++)for(let c=0;c<3;c++){const i=p*3+c,w=weights[p]/255;output[i]=Math.round(source[i]*(1-w)+changed[i]*w);}
 return sharp(output,{raw:{width,height,channels:3}}).png().toBuffer();
}
