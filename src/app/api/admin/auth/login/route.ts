import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE_NAME,
  isAdminAuthConfigured,
  resolveRoleForPasscode,
} from "@/lib/admin-auth";

interface LoginPayload {
  passcode?: string;
}

export async function POST(request: Request) {
  if (!isAdminAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Admin auth is not configured. Set ADMIN_OWNER_KEY (or ADMIN_ACCESS_KEY) in .env.local and Vercel environment variables.",
      },
      { status: 500 },
    );
  }

  const payload = (await request.json().catch(() => ({}))) as LoginPayload;
  const role = resolveRoleForPasscode(payload.passcode);
  if (!role) {
    return NextResponse.json({ error: "Invalid admin passcode." }, { status: 401 });
  }

  const token = payload.passcode?.trim() ?? "";
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  response.headers.set("x-admin-role", role);
  return response;
}
