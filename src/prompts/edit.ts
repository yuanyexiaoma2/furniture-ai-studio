// 第一张参考是待编辑生成图，后续实拍只用于约束产品身份。
export function buildEditPrompt(identityTraits: string, editIntent: string,hasMask=false) {
  const references=hasMask?"第二张参考图是黑白蒙版，白色表示允许修改的区域、黑色表示保留；第三张及后续参考图是同一产品的实拍，用于核对真实产品细节。":"后续参考图是同一产品的实拍，用于核对真实产品细节。";
  return `第一张参考图是需要修改的原图；${references}产品身份特征：${identityTraits.trim()}。请在第一张图的基础上修改：${editIntent.trim()}。保留未要求修改的构图、环境和视觉内容，不重新设计产品。产品结构、部件数量、尺寸比例、颜色、材质纹理、五金样式与位置、Logo 必须与产品身份特征和实拍保持一致。输出一张编辑后的完整图片。`;
}
