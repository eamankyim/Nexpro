/** Error codes returned when AI provider calls fail. */
export const AI_PROVIDER_ERROR_CODES = [
  'OPENAI_NOT_CONFIGURED',
  'OPENAI_INVALID_KEY',
  'AI_PROVIDER_BILLING_REQUIRED',
  'AI_PROVIDER_UNAVAILABLE',
] as const;

export type AiProviderErrorCode = (typeof AI_PROVIDER_ERROR_CODES)[number];

/** Short user-facing copy keyed by backend error code. */
export const AI_PROVIDER_USER_MESSAGES: Record<AiProviderErrorCode, string> = {
  AI_PROVIDER_BILLING_REQUIRED:
    'Platform AI credit is finished. Set up AI credit or add your AI API key in Settings.',
  OPENAI_NOT_CONFIGURED:
    'AI is not set up yet. Add your AI API key in Settings → Operations on the web app.',
  OPENAI_INVALID_KEY:
    'Your AI API key is invalid. Update it in Settings → Operations on the web app.',
  AI_PROVIDER_UNAVAILABLE:
    'AI is temporarily unavailable. Try again in a moment.',
};

type ApiLikeError = {
  message?: string;
  code?: string;
  errorCode?: string;
  response?: { data?: { message?: string; error?: string; code?: string; errorCode?: string } };
};

/**
 * Extract AI provider error code from an API/axios error.
 */
export function extractAiErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const err = error as ApiLikeError;
  const data = err.response?.data;
  return data?.errorCode || data?.code || err.errorCode || err.code || null;
}

/**
 * Map AI provider failures to concise user-facing copy.
 */
export function getAiProviderErrorMessage(error: unknown, fallback: string | null = null): string | null {
  const code = extractAiErrorCode(error);
  if (code && code in AI_PROVIDER_USER_MESSAGES) {
    return AI_PROVIDER_USER_MESSAGES[code as AiProviderErrorCode];
  }
  return fallback;
}

export function isAiProviderError(error: unknown): boolean {
  return Boolean(getAiProviderErrorMessage(error));
}
