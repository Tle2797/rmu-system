// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/session";

const PROTECTED_PREFIXES = ["/exec", "/dashboard", "/admin", "/register-department"];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // อนุญาต asset/api/login หน้า public อื่น ๆ ผ่านก่อน
  const needAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!needAuth) return NextResponse.next();

  const token = req.cookies.get("token")?.value || "";
  const user = token ? verifyToken(token) : null;

  // ถ้าไม่ล็อกอิน → ส่งไปหน้า /auth/login พร้อม ?next=<path+query>
  if (!user) {
    const url = new URL("/auth/login", req.url);
    url.searchParams.set("next", pathname + (search || ""));
    return NextResponse.redirect(url);
  }

  // /admin เฉพาะ admin
  if (pathname.startsWith("/admin") && user.role !== "admin") {
    return NextResponse.redirect(new URL("/exec", req.url));
  }

  // /register-department เฉพาะ admin
  if (pathname.startsWith("/register-department") && user.role !== "admin") {
    const dest =
      user.role === "exec"
        ? "/exec"
        : user.departmentCode
        ? `/dashboard/${user.departmentCode}`
        : "/dashboard";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  // ช่วยส่ง /admin → /admin/users ให้แอดมิน
  if (pathname === "/admin" || pathname === "/admin/") {
    const dest = user.role === "admin" ? "/admin/users" : "/exec";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|static|favicon.ico).*)"],
};
