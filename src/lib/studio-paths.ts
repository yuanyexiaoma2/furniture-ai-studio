// 只转换页面路径，public/design-preview 下的图片等静态资源继续保留原地址。
const legacyPages: Record<string, string> = {
  "/design-preview": "/",
  "/design-preview/skus": "/skus",
  "/design-preview/workspace": "/workspace",
  "/design-preview/library": "/library",
  "/design-preview/admin": "/admin/models",
  "/design-preview/product": "/workspace",
};

export function legacyStudioPath(pathname: string): string | undefined {
  return legacyPages[pathname.replace(/\/$/, "")];
}
