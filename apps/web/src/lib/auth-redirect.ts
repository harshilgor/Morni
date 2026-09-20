/**
 * Safe internal redirect targets for auth flows.
 * Rejects open redirects and auth-page destinations that cause login loops.
 */
export function safeInternalPath(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return fallback;
  if (trimmed.includes("\\")) return fallback;
  // Never bounce users back onto an auth screen after a successful login.
  if (
    trimmed === "/auth" ||
    trimmed.startsWith("/auth?") ||
    trimmed.startsWith("/auth/") ||
    trimmed === "/founder/auth" ||
    trimmed.startsWith("/founder/auth?") ||
    trimmed.startsWith("/founder/auth/") ||
    trimmed === "/driver/sign-in" ||
    trimmed.startsWith("/driver/sign-in?") ||
    trimmed.startsWith("/driver/sign-in/")
  ) {
    return fallback;
  }
  return trimmed;
}

export function founderAuthNext(value: string | null | undefined) {
  return safeInternalPath(value, "/founder");
}

export function isFounderDestination(path: string) {
  return path === "/founder" || path.startsWith("/founder/");
}
