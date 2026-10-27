import "dotenv/config";
import { db } from "../src/lib/db";

// 任务11-A的一次性数据整理；只处理明确指定的SKU，不调用模型。
const rules = [
  "不得以画面暗示未经实拍或尺寸验证的大型家电嵌入适配、内部净空或承重；不确定时将家电置于产品旁，保持留空结构。",
  "只调暖环境灯光时，不要用全图暖色滤镜重新染色产品木纹；保留实拍的基材色和细小五金形状，五金不得缩短或改变末端轮廓。",
  "未确认净空和适配尺寸时，不以场景暗示洗衣机等大型家电能嵌入产品留空，应置于产品旁并明确待实测。",
];

try {
  const result = await db.$transaction(async tx => {
    const product = await tx.product.findUniqueOrThrow({ where: { sku: "NL27TS01" } });
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${product.id}, 0))`;
    const current = await tx.product.findUniqueOrThrow({ where: { id: product.id } });
    const old = await tx.productIdentityVersion.findMany({ where: { productId: product.id }, select: { id: true, text: true } });
    if (rules.every(rule => current.identityTraits?.includes(rule))) return { sku: product.sku, changed: false };
    const text = [current.identityTraits?.trim(), "任务11-A产品专属约束（从全局提示词迁入，保留原文）", ...rules].filter(Boolean).join("\n\n");
    // 由整理脚本保存，savedById留空，不伪装成某个成员的手动确认。
    const version = await tx.productIdentityVersion.create({ data: { productId: product.id, text } });
    await tx.product.update({ where: { id: product.id }, data: { identityTraits: text } });
    const preserved = await tx.productIdentityVersion.findMany({ where: { id: { in: old.map(v => v.id) } }, select: { id: true, text: true } });
    if (preserved.length !== old.length || old.some(v => preserved.find(p => p.id === v.id)?.text !== v.text)) throw Error("历史版本校验失败");
    return { sku: product.sku, productId: product.id, changed: true, versionId: version.id, oldVersionsPreserved: old.length };
  });
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
