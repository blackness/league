export const ADMIN_SESSION_COOKIE_NAME = "sports_portal_admin_session";

export type AdminRole = "viewer" | "scorekeeper" | "admin" | "owner";

const roleRank: Record<AdminRole, number> = {
  viewer: 1,
  scorekeeper: 2,
  admin: 3,
  owner: 4,
};

function normalizeSecret(value: string | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function readRoleSecrets(): Record<AdminRole, string | null> {
  const owner = normalizeSecret(process.env.ADMIN_OWNER_KEY);
  const admin = normalizeSecret(process.env.ADMIN_ADMIN_KEY);
  const scorekeeper = normalizeSecret(process.env.ADMIN_SCOREKEEPER_KEY);
  const viewer = normalizeSecret(process.env.ADMIN_VIEWER_KEY);
  const legacy = normalizeSecret(process.env.ADMIN_ACCESS_KEY);

  // Backwards compatibility: existing ADMIN_ACCESS_KEY remains valid as owner-level key.
  return {
    owner: owner ?? legacy,
    admin,
    scorekeeper,
    viewer,
  };
}

export function isAdminAuthConfigured(): boolean {
  const secrets = readRoleSecrets();
  return Boolean(secrets.owner || secrets.admin || secrets.scorekeeper || secrets.viewer);
}

export function resolveRoleForPasscode(passcode: unknown): AdminRole | null {
  if (typeof passcode !== "string" || !passcode.trim()) {
    return null;
  }
  const normalized = passcode.trim();
  const secrets = readRoleSecrets();

  if (secrets.owner && normalized === secrets.owner) {
    return "owner";
  }
  if (secrets.admin && normalized === secrets.admin) {
    return "admin";
  }
  if (secrets.scorekeeper && normalized === secrets.scorekeeper) {
    return "scorekeeper";
  }
  if (secrets.viewer && normalized === secrets.viewer) {
    return "viewer";
  }

  return null;
}

export function isAdminPasscodeValid(passcode: unknown): boolean {
  return resolveRoleForPasscode(passcode) !== null;
}

export function isValidAdminSessionCookie(value: string | undefined): boolean {
  return resolveRoleForPasscode(value) !== null;
}

export function roleMeetsRequirement(role: AdminRole, requiredRole: AdminRole): boolean {
  return roleRank[role] >= roleRank[requiredRole];
}

export function getAdminRoleFromSessionValue(value: string | undefined): AdminRole | null {
  return resolveRoleForPasscode(value);
}
