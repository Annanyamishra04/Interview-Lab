import type { AuthError } from "@supabase/supabase-js";

/**
 * Supabase's raw error messages are accurate but not something to show a
 * user verbatim (wording changes between versions, and some phrasings
 * leak implementation detail). Every auth code path in the app should
 * go through this rather than reading `error.message` directly.
 */
export function mapAuthError(error: AuthError): string {
  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("invalid login credentials")) {
    return "That email and password combination didn't work.";
  }
  if (message.includes("email not confirmed")) {
    return "Confirm your email address before logging in.";
  }
  if (message.includes("already registered") || message.includes("already exists")) {
    return "An account with that email already exists. Try logging in instead.";
  }
  if (message.includes("password") && (message.includes("least") || message.includes("weak"))) {
    return "Choose a stronger password (at least 8 characters, including a number).";
  }
  if (message.includes("rate limit") || message.includes("too many")) {
    return "Too many attempts. Wait a moment and try again.";
  }
  if (message.includes("network") || message.includes("fetch failed")) {
    return "Couldn't reach the server. Check your connection and try again.";
  }

  return "Something went wrong. Try again in a moment.";
}

/**
 * Prevents an open-redirect: `redirectTo` comes from a query string the
 * user controls, so only an internal, single-segment-rooted path is ever
 * honored — never an absolute URL or a protocol-relative `//host` path.
 */
export function safeRedirectPath(path: string | null | undefined, fallback = "/dashboard"): string {
  if (!path) return fallback;
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
}
