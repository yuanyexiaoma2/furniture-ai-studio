import sharp from "sharp";
import { validateExpansion, type Expansion } from "./expansion-rules";

export async function expansionGuide(original: Buffer, expansion: Expansion) {
  const source=sharp(original),{width,height}=(await source.metadata()).autoOrient;
  const extent = validateExpansion(expansion, { width,height });
  return source.rotate().toColourspace("srgb").ensureAlpha().extend({
    left: extent.offsetX, top: extent.offsetY,
    right: extent.width - extent.offsetX - width, bottom: extent.height - extent.offsetY - height,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  }).png().toBuffer();
}

export async function compositeExpandedEdit(original: Buffer, generated: Buffer, expansion: Expansion) {
  const image=sharp(original),{width,height}=(await image.metadata()).autoOrient;
  const extent = validateExpansion(expansion, { width,height });
  const source = await image.rotate().toColourspace("srgb").ensureAlpha().raw().toBuffer();
  const background = await sharp(generated).resize(extent.width, extent.height, { fit: "fill" }).toColourspace("srgb").ensureAlpha().raw().toBuffer();
  // 直接拷贝RGBA像素，透明原图也不会被生成背景覆盖。
  for (let y = 0; y < height; y++) {
    source.copy(background, ((y + extent.offsetY) * extent.width + extent.offsetX) * 4, y * width * 4, (y + 1) * width * 4);
  }
  return sharp(background, { raw: { width: extent.width, height: extent.height, channels: 4 } }).png().toBuffer();
}
