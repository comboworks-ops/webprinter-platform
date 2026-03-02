const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || "webprinter.dk";
const LOGOUT_TARGET_KEY = "wp_logout_target";

function resolveHostname(input?: string): string {
  if (input) return input;
  if (typeof window !== "undefined") return window.location.hostname;
  return "";
}

function isPlatformHostname(hostname: string): boolean {
  return (
    hostname === ROOT_DOMAIN ||
    hostname === `www.${ROOT_DOMAIN}` ||
    hostname === "webprinter-platform.vercel.app"
  );
}

/**
 * Determine where users should land after logout:
 * - Master tenant context => platform landing (/platform)
 * - Tenant context => tenant home (/)
 * - Unknown tenant => infer from hostname
 */
export function getPostLogoutPath(tenantId?: string | null, hostname?: string): string {
  if (tenantId === MASTER_TENANT_ID) return "/platform";
  if (tenantId) return "/";

  return isPlatformHostname(resolveHostname(hostname)) ? "/platform" : "/";
}

export function setPostLogoutPath(path: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(LOGOUT_TARGET_KEY, path);
  } catch {
    // Ignore storage write errors (private mode, quota, etc.)
  }
}

export function consumePostLogoutPath(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = sessionStorage.getItem(LOGOUT_TARGET_KEY);
    if (value) {
      sessionStorage.removeItem(LOGOUT_TARGET_KEY);
    }
    return value;
  } catch {
    return null;
  }
}
