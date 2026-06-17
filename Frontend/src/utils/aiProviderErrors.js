/** Error codes returned when AI provider calls fail. */
export const AI_PROVIDER_ERROR_CODES = [
  'OPENAI_NOT_CONFIGURED',
  'OPENAI_INVALID_KEY',
  'AI_PROVIDER_BILLING_REQUIRED',
  'AI_PROVIDER_UNAVAILABLE',
];

/** Settings path for workspace AI key setup (Operations tab). */
export const AI_SETTINGS_PATH = '/settings?tab=operations';

/** Short user-facing copy keyed by backend error code. */
export const AI_PROVIDER_USER_MESSAGES = {
  AI_PROVIDER_BILLING_REQUIRED:
    'Platform AI credit is finished. Set up AI credit or add your AI API key in Settings.',
  OPENAI_NOT_CONFIGURED:
    'AI is not set up yet. Add your AI API key in Settings → Operations.',
  OPENAI_INVALID_KEY:
    'Your AI API key is invalid. Update it in Settings → Operations.',
  AI_PROVIDER_UNAVAILABLE:
    'AI is temporarily unavailable. Try again in a moment.',
};

/**
 * Extract AI provider error code from an API/axios error.
 * @param {unknown} error
 * @returns {string | null}
 */
export const extractAiErrorCode = (error) => {
  if (!error || typeof error !== 'object') return null;
  const data = error.response?.data;
  return data?.errorCode || data?.code || error.errorCode || error.code || null;
};

/**
 * Map AI provider failures to concise user-facing copy.
 * @param {unknown} error
 * @param {string | null} [fallback=null]
 * @returns {string | null}
 */
export const getAiProviderErrorMessage = (error, fallback = null) => {
  const code = extractAiErrorCode(error);
  if (code && AI_PROVIDER_USER_MESSAGES[code]) {
    return AI_PROVIDER_USER_MESSAGES[code];
  }
  return fallback;
};

/**
 * @param {unknown} error
 * @returns {boolean}
 */
export const isAiProviderError = (error) => Boolean(getAiProviderErrorMessage(error));
