import { z } from "zod";

export const roleSchema = z.enum(["admin", "template_editor", "designer", "viewer"]);
export const emailSchema = z.string().trim().toLowerCase().email("请输入有效邮箱").max(254);
export const passwordSchema = z.string().min(12, "密码至少 12 个字符")
  .refine((value) => new TextEncoder().encode(value).length <= 72, "密码 UTF-8 编码后不能超过 72 字节");
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).refine((value) => new TextEncoder().encode(value).length <= 72),
});
export const createUserSchema = z.object({
  name: z.string().trim().min(1, "请输入姓名").max(80, "姓名最多 80 个字符"),
  email: emailSchema,
  password: passwordSchema,
  role: roleSchema,
  department: z.string().trim().max(80).optional().default(""),
  monthlyQuota: z.number().int().min(0).max(1000000),
});
export const updateUserSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("role"), role: roleSchema }),
  z.object({ action: z.literal("password"), password: passwordSchema }),
]);
