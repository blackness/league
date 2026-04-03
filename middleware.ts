import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE_NAME,
  isAdminAuthConfigured,
  isValidAdminSessionCookie,
} from "@/lib/admin-auth";

function isAdminPagePath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isAdminApiPath(pathname: string): boolean {
  return pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}

function isAuthExemptPath(pathname: string): boolean {
  return pathname === "/api/admin/auth/login" || pathname === "/api/admin/auth/logout";
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const adminPage = isAdminPagePath(pathname);
  const adminApi = isAdminApiPath(pathname);

  if (!adminPage && !adminApi) {
    return NextResponse.next();
  }

  if (isAuthExemptPath(pathname)) {
    return NextResponse.next();
  }

  if (!isAdminAuthConfigured()) {
    if (adminApi) {
      return NextResponse.json(
        {
          error:
            "Admin auth is not configured. Set ADMIN_OWNER_KEY (or ADMIN_ACCESS_KEY) in .env.local and Vercel environment variables.",
        },
        { status: 500 },
      );
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login-admin";
    loginUrl.searchParams.set("error", "config_missing");
    return NextResponse.redirect(loginUrl);
  }

  const sessionValue = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (isValidAdminSessionCookie(sessionValue)) {
    return NextResponse.next();
  }

  if (adminApi) {
    return NextResponse.json({ error: "Unauthorized admin request." }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login-admin";
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
