// 使用用户指定的四段结构，不预设机位或光位；场景意图中的明确要求优先。
export function buildScenePrompt(identityTraits: string, sceneIntent: string) {
  return `以下参考图为同一件产品的不同角度实拍。产品身份特征：${identityTraits.trim()}。请将这件产品自然地放入${sceneIntent.trim()}中，可根据构图需要自由选择角度、光线和软装。产品的结构、部件数量、比例、颜色、材质和五金细节必须与参考图保持一致。`;
}
