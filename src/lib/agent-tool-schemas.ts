import { z } from "zod";
import { profileFields, profileFieldSchema } from "./profile-rules";
import { slotSchema } from "./pack-rules";
const id = z.string().min(1).max(100);
export const questionSchema = z.object({ question: z.string().min(1).max(1000), options: z.array(z.string().min(1).max(300)).max(6), allowFreeText: z.boolean() }).strict();
export const proposalSchema = z.object({ reason: z.string().min(1).max(2000), slots: z.array(slotSchema.extend({ id: id.optional(), reason: z.string().min(1).max(1000) }).strict()).min(1).max(30) }).strict();
export const agentToolSchemas = {
  read_product_materials: z.object({}).strict(),
  view_images: z.object({ imageIds: z.array(id).min(1).max(10), instruction: z.string().min(1).max(4000), classifications: z.array(z.object({ documentId: id, imageType: z.enum(["photo", "white_bg", "render_3d", "detail", "other"]) }).strict()).max(15).optional() }).strict(),
  update_profile_draft: z.object({ fields: z.array(z.object({ field: z.enum(profileFields), data: profileFieldSchema }).strict()).min(1).max(10) }).strict(),
  ask_user: z.object({ questions: z.array(questionSchema).min(1).max(3) }).strict(),
  request_profile_confirmation: z.object({}).strict(),
  propose_image_pack: proposalSchema,
  generate_slot: z.object({ slotId: id, count: z.number().int().min(1).max(4) }).strict(),
  generate_batch: z.object({}).strict(),
  edit_image: z.object({ assetId: id, instruction: z.string().trim().min(1).max(8000) }).strict(),
  set_final: z.object({ slotId: id, assetId: id }).strict(),
};
export type AgentToolName = keyof typeof agentToolSchemas;
export const toolDescriptions: Record<AgentToolName, string> = {
  read_product_materials: "读取当前 SKU 全部商品数据、文档解析文本、图片清单、档案、图位和候选。先调用本工具。",
  view_images: "通过逻辑视觉模型查看当前 SKU 指定图片，不猜测图片内容；根据视觉结果再提交 classifications 图片类型。",
  update_profile_draft: "更新草稿字段。每字段有 value/status/sources/conflicts；矛盾列出来源并标推测，不能写正式版本。美工亲自确认的信息才 confirmed。",
  ask_user: "展示最多 3 个结构化问题，尽量提供选项，只问图片和材料无法确定的问题；随后等待美工回答。",
  request_profile_confirmation: "展示可编辑的产品理解确认卡；正式档案和身份特征仅由美工确认后写入。",
  propose_image_pack: "提出可编辑图包方案，以默认 7 个图位为起点并解释增减原因。已有图位传 id，未列出的原图位保留；等待美工确认。",
  generate_slot: "为单个已确认图位生成 1～4 张，先展示费用卡；手动模式只能当前未挑好终稿的第一个 AI 图位。",
  generate_batch: "快速模式为全部 AI 场景图位生成，费用确认后才执行；第一批始终手动确认。",
  edit_image: "调整指定候选图，原图+最多3张实拍+当前身份特征；先费用确认，结果加入父图图位。",
  set_final: "请求在确认卡中将指定候选设为该图位终稿，不能由模型直接确认。",
};
export function llmAgentTools() { return Object.entries(agentToolSchemas).map(([name, schema]) => ({ type: "function" as const, function: { name, description: toolDescriptions[name as AgentToolName], parameters: z.toJSONSchema(schema, { unrepresentable: "any" }) as Record<string, unknown> } })); }
