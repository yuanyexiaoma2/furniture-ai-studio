import {z} from "zod";

// 换色是明确的用户意图，不能从普通场景意见中猜测或改变产品档案。
export const appearanceChangeSchema=z.object({
 referenceAssetId:z.string().min(1).max(100).optional(),
 description:z.string().trim().max(2000).default(""),
 environment:z.enum(["keep","adapt"]).default("keep"),
}).strict().refine(v=>!!v.referenceAssetId||!!v.description,{message:"请选择颜色材质参考，或写明目标颜色材质"});
export type AppearanceChange=z.infer<typeof appearanceChangeSchema>;
export function appearanceInstruction(change:AppearanceChange){
 return `本次为同款颜色/材质变体。只将产品的颜色和材质调整为${change.referenceAssetId?"指定颜色材质参考图中的产品外观":"以下明确描述"}。${change.description} 保持编辑原图的造型、部件数量、尺寸比例、五金位置、机位和构图不变；不能搬入参考图的造型或背景。${change.environment==="keep"?"环境、道具、摆放与光线保持原图。":"环境及道具配色可随目标产品协调调整，保留原有场景、摆放、机位与构图。"}`;
}
