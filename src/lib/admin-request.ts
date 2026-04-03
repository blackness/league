import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE_NAME,
  type AdminRole,
  getAdminRoleFromSessionValue,
  isAdminAuthConfigured,
  roleMeetsRequirement,
} from "@/lib/admin-auth";

interface AdminAccessResult {
  ok: boolean;
  role: AdminRole | null;
  response: NextResponse | null;
}

function readCookie(request: Request, cookieName: string): string | undefined {
  const cookieHeader = request.headers.get("cookie") ?? "";
  if (!cookieHeader) {
    return undefined;
  }

  const pairs = cookieHeader.split(";").map((item) => item.trim());
  for (const pair of pairs) {
    if (!pair.startsWith(`${cookieName}=`)) {
      continue;
    }
    return decodeURIComponent(pair.slice(cookieName.length + 1));
  }
  return undefined;
}

export function requireAdminRole(request: Request, requiredRole: AdminRole): AdminAccessResult {
  if (!isAdminAuthConfigured()) {
    return {
      ok: false,
      role: null,
      response: NextResponse.json(
        {
          error:
            "Admin auth is not configured. Set ADMIN_OWNER_KEY (or ADMIN_ACCESS_KEY) and optional role keys in environment variables.",
        },
        { status: 500 },
      ),
    };
  }

  const sessionValue = readCookie(request, ADMIN_SESSION_COOKIE_NAME);
  const role = getAdminRoleFromSessionValue(sessionValue);
  if (!role) {
    return {
      ok: false,
      role: null,
      response: NextResponse.json({ error: "Unauthorized admin request." }, { status: 401 }),
    };
  }

  if (!roleMeetsRequirement(role, requiredRole)) {
    return {
      ok: false,
      role,
      response: NextResponse.json(
        { error: `Insufficient role. Requires "${requiredRole}" access.` },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    role,
    response: null,
  };
}

export function toAdminActor(role: AdminRole | null): string {
  return role ? `role:${role}` : "role:unknown";
}

