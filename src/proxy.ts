import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { loginDestination } from "@/lib/login-destination";
import { legacyStudioPath } from "@/lib/studio-paths";

export default auth((request) => {
  const path = request.nextUrl.pathname;
  const destination = legacyStudioPath(path);
  if (destination) {
    const target = request.nextUrl.clone();
    target.pathname = destination;
    return NextResponse.redirect(target, 301);
  }
  if (!request.auth && path !== "/login") {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "请先登录" }, { status: 401 });
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  if (request.auth && path === "/login") return NextResponse.redirect(new URL(loginDestination(request.nextUrl.searchParams.get("callbackUrl")), request.url));
  if (request.auth && request.auth.user.role !== "admin" &&
      (path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/admin/"))) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "仅管理员可以操作" }, { status: 403 });
    // 页面权限交给服务端布局抛出 403，避免重写后状态被覆盖及导航 hydration 差异。
    return NextResponse.next();
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth(?:/|$)|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
