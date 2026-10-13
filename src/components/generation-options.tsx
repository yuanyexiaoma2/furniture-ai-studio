"use client";
import { sceneAspectRatios, sceneResolutions, modelCost, type SceneAspectRatio, type SceneResolution } from "@/lib/models.config";
import type { ProductSnapshot } from "@/lib/product-data";
import type { GenerationAvailability } from "@/lib/scene-generation";

export function generationBlockReason(product: ProductSnapshot, availability: GenerationAvailability, readonly: boolean, credits: number) {
  return readonly ? "只读成员可以查看生成记录" : !availability.configured ? "请管理员配置 KIE 密钥" : !availability.workerReady ? "生图服务离线，请启动 worker" : product.photos.length < 2 ? "请先上传至少 2 张实拍图" : !product.identityTraits.trim() ? "请先保存产品身份特征" : availability.remaining < credits ? "本月剩余积分不足，请联系管理员" : "";
}
export function GenerationOptions({ prefix, resolution, aspectRatio, disabled, onResolution, onAspectRatio }: { prefix: string; resolution: SceneResolution; aspectRatio: SceneAspectRatio; disabled: boolean; onResolution: (resolution: SceneResolution) => void; onAspectRatio: (ratio: SceneAspectRatio) => void }) {
  return <>
    <fieldset className="resolution-options" disabled={disabled}><legend>输出分辨率</legend>{sceneResolutions.map((value) => <label key={value}><input type="radio" name={`${prefix}-resolution`} value={value} aria-label={`${value} ${modelCost("scene-main", value).credits} 积分`} checked={resolution === value} onChange={() => onResolution(value)} /><span><strong>{value}</strong><small>{modelCost("scene-main", value).credits} 积分</small></span></label>)}</fieldset>
    <fieldset className="aspect-options aspect-options-full" disabled={disabled}><legend>画面比例</legend>{sceneAspectRatios.map((ratio) => <label key={ratio}><input type="radio" name={`${prefix}-aspectRatio`} value={ratio} checked={aspectRatio === ratio} onChange={() => onAspectRatio(ratio)} /><span>{ratio === "auto" ? "自动" : ratio}</span></label>)}</fieldset>
  </>;
}
