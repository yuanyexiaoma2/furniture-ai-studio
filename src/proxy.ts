import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((request) => {
  const path = request.nextUrl.pathname;
  if (!request.auth && path !== "/login") {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "请先登录" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (request.auth && path === "/login") return NextResponse.redirect(new URL("/", request.url));
  if (request.auth && request.auth.user.role !== "admin" &&
      (path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/admin/"))) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "仅管理员可以操作" }, { status: 403 });
    return NextResponse.rewrite(new URL("/forbidden", request.url), { status: 403 });
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth(?:/|$)|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
