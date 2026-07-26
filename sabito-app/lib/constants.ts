export const SITE_NAME = "Sabito App";
export const WHATSAPP_SUPPORT = "233269056851";

export const TOKEN_KEY = "sabito_marketer_token";

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
