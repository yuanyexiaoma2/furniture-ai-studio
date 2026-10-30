// 使用用户指定的四段结构，不预设机位或光位；场景意图中的明确要求优先。
export function buildScenePrompt(identityTraits: string, sceneIntent: string) {
  return `输入图片按逐张用途说明区分产品实拍和风格参考。产品身份特征：${identityTraits.trim()}。请将这件产品自然地放入${sceneIntent.trim()}中，可根据构图需要自由选择角度、光线和软装。产品的结构、部件数量、比例、颜色、材质和五金细节必须与产品实拍保持一致；风格参考仅用于指定方面，不提供产品身份。`;
}
