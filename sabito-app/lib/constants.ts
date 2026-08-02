export const SITE_NAME = "Sabito";
export const WHATSAPP_SUPPORT = "233269056851";
export const SUPPORT_EMAIL = "support@sabito.app";

export const TOKEN_KEY = "sabito_marketer_token";

/**
 * ABS marketing site for business signup / learn more.
 * Businesses do not sign up on Sabito — they use African Business Suite.
 */
export const ABS_SITE_URL = (
  process.env.NEXT_PUBLIC_ABS_SITE_URL || "https://absghana.com"
).replace(/\/$/, "");

/** ABS app onboarding (business account creation). Falls back to marketing site. */
export const ABS_BUSINESS_SIGNUP_URL = (
  process.env.NEXT_PUBLIC_ABS_BUSINESS_SIGNUP_URL || `${ABS_SITE_URL}`
).replace(/\/$/, "");

/**
 * ABS API base including `/api` suffix.
 * Prefer same-origin `/api` in the browser (Next rewrite) to avoid CORS.
 * Override with NEXT_PUBLIC_ABS_API_URL when needed (e.g. http://127.0.0.1:5002/api).
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_ABS_API_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return "/api";
  return "http://127.0.0.1:5002/api";
}

/** @deprecated use getApiBaseUrl() — kept for older imports */
export const API_BASE_URL = getApiBaseUrl();
