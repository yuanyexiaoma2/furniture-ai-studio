import { z } from "zod";
import { profileFields, profileFieldSchema } from "./profile-rules";
import { slotSchema } from "./pack-rules";
import {conversationImageSchema,slotReferenceSchema} from "./generation-references";
const id = z.string().min(1).max(100);
export const questionSchema = z.object({ question: z.string().min(1).max(1000), options: z.array(z.string().min(1).max(300)).max(6), allowFreeText: z.boolean() }).strict();
export const proposalSchema = z.object({ reason: z.string().min(1).max(2000), slots: z.array(slotSchema.extend({ id: id.optional(), reason: z.string().min(1).max(1000) }).strict()).min(1).max(30),visualPlan:z.unknown().optional() }).strict();
export const agentToolSchemas = {
  inspect_canvas:z.object({elementId:z.string().max(120).optional(),region:z.object({x:z.number().finite(),y:z.number().finite(),width:z.number().positive().max(100000),height:z.number().positive().max(100000)}).optional()}).strict(),
  web_search:z.object({query:z.string().trim().min(1).max(500),max_results:z.number().int().min(1).max(5)}).strict(),
  read_product_materials: z.object({}).strict(),
  set_image_roles:z.object({images:z.array(conversationImageSchema).min(1).max(10)}).strict(),
  view_images: z.object({ imageIds: z.array(id).min(1).max(10), instruction: z.string().min(1).max(4000), classifications: z.array(z.object({ documentId: id, imageType: z.enum(["photo", "white_bg", "render_3d", "detail", "other"]) }).strict()).max(15).optional() }).strict(),
  update_profile_draft: z.object({ fields: z.array(z.object({ field: z.enum(profileFields), data: profileFieldSchema }).strict()).min(1).max(10) }).strict(),
  ask_user: z.object({ questions: z.array(questionSchema).min(1).max(3) }).strict(),
  request_profile_confirmation: z.object({}).strict(),
  propose_image_pack: proposalSchema.partial({slots:true}),
  generate_slot: z.object({ slotId: id, count: z.number().int().min(1).max(4) }).strict(),
  generate_batch: z.object({}).strict(),
  edit_image: z.object({ assetId: id, instruction: z.string().trim().min(1).max(8000),mode:z.enum(["whole","local"]).default("whole"),references:z.array(slotReferenceSchema).max(2).optional() }).strict(),
  set_final: z.object({ slotId: id, assetId: id }).strict(),
};
export type AgentToolName = keyof typeof agentToolSchemas;
export const toolDescriptions: Record<AgentToolName, string> = {
  inspect_canvas:"读取当前SKU画布中的图位、实拍、候选、便签、全局坐标与选中项。可按元素ID/C短编号或区域筛选；仅为数据，不可绕过方案、额度校验与终稿确认。",
  web_search:"通过Gemini Google Search获取用户评论痛点、品类关键词和风格趋势，带来源；只作低权重补充参考，不替代竞品参考图，不覆盖产品身份。",
  read_product_materials: "读取当前 SKU 全部商品数据、文档解析文本、图片清单、档案、图位和候选。先调用本工具。",
  set_image_roles:"记录当前对话图片用途：product是产品实拍；reference只参考purpose写明的光线、构图、场景、色调、道具等。必须先看图和理解用户要求，无法区分或不知道参考什么时仅用一句话追问，不调用ask_user创建卡片。已有生成候选作为编辑源图无需分类。",
  view_images: "通过逻辑视觉模型查看当前 SKU 指定图片，不猜测图片内容；classifications.documentId须逐字使用documents[].documentId，不可用Asset图片ID；已有实拍无文档时不传分类。仅处理当前SKU图片。",
  update_profile_draft: "更新草稿字段。优先将read_product_materials.sourceReferences短编号(P、D1、I1、M1等)写入来源id；服务器精确映射到真实ID。禁止猜测长ID。每字段有 value/status/sources/conflicts；矛盾列出来源并标推测，不能写正式版本。美工亲自确认的信息才 confirmed。",
  ask_user: "展示最多 3 个结构化问题，尽量提供选项，只问图片和材料无法确定的问题；随后等待美工回答。",
  request_profile_confirmation: "展示可编辑的产品理解确认卡；正式档案和身份特征仅由美工确认后写入。",
  propose_image_pack: "调用唯一的proposeVisualPlan流程，结合当前产品、对话意见、竞品研究与经验库生成可编辑方案。只传reason表达用户目标，不在工具参数里另外策划图位；旧slots仅兼容历史调用。单张请求在reason注明，人工确认后冻结。",
  generate_slot: "为单个已确认图位生成 1～4 张，点击后直接提交，费用只展示；手动模式只能当前未挑好终稿的第一个 AI 图位。",
  generate_batch: "快速模式为全部 AI 场景图位生成，已确认方案后直接提交，额度由服务器校验，不等待费用确认。",
  edit_image: "判断修改范围：更换整体场景、光线或构图用 mode=whole；只改某一区域或物件用 mode=local。local 会要求美工在画布框选或涂抹后提交，不能无蒙版执行。身份锁始终沿用源图。references省略时沿用原图实际用过的参考图；用户明确指定新参考时传完整替换列表（0–2张，含assetId和purpose），空数组表示明确不用参考。整图直接提交并展示估价，新版本加入原图位，不等待费用确认。",
  set_final: "请求在确认卡中将指定候选设为该图位终稿，不能由模型直接确认。",
};
export function llmAgentTools(webEnabled=true) { return Object.entries(agentToolSchemas).filter(([name])=>webEnabled||name!=="web_search").map(([name, schema]) => ({ type: "function" as const, function: { name, description: toolDescriptions[name as AgentToolName], parameters: z.toJSONSchema(name==="propose_image_pack"?proposalSchema.pick({reason:true}):schema, { unrepresentable: "any" }) as Record<string, unknown> } })); }
