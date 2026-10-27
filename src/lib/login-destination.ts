import { legacyStudioPath } from "./studio-paths";
export const DEFAULT_STUDIO_PATH = "/";

// 登录回跳只接受站内路径；旧首页和登录页都回到新版工作台。
export function loginDestination(value: unknown): string {
 if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) return DEFAULT_STUDIO_PATH;
 const url = new URL(value, "https://studio.local");
 if (url.origin !== "https://studio.local" || url.pathname === "/login" || url.pathname.startsWith("/api/")) return DEFAULT_STUDIO_PATH;
 return (legacyStudioPath(url.pathname) ?? url.pathname) + url.search;
}
