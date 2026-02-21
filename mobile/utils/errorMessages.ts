/**
 * Extract clear, user-friendly error messages from API/network errors
 */

export function getErrorMessage(
  error: unknown,
  defaultMessage = 'Something went wrong. Please try again.'
): string {
  if (typeof error === 'string') return error;

  const err = error as {
    response?: { data?: { error?: string; message?: string; errors?: string[] | Record<string, unknown> } };
    message?: string;
    code?: string;
  };

  if (err?.response?.data) {
    const data = err.response.data;
    if (data.message) return data.message;
    if (data.error) return data.error;
    if (data.errors && Array.isArray(data.errors)) return data.errors.join(', ');
    if (data.errors && typeof data.errors === 'object') {
      const msgs = Object.values(data.errors)
        .map((e) => (typeof e === 'string' ? e : (e as { message?: string })?.message))
        .filter(Boolean);
      if (msgs.length) return msgs.join(', ');
    }
  }

  if (err?.message) {
    const technical = ['Network Error', 'Request failed', 'timeout', 'ECONNABORTED'];
    if (technical.some((t) => err.message?.includes(t))) {
      return 'Cannot connect to server. Check your internet and that the backend is running.';
    }
    return err.message;
  }

  if (err?.code === 'NETWORK_ERROR' || err?.code === 'ECONNREFUSED') {
    return 'Cannot connect to server. Is the backend running? Use your LAN IP for physical devices.';
  }

  return defaultMessage;
}
