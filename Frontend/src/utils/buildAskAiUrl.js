/**
 * Build Ask AI route with optional page and date filter context.
 * @param {{ from?: string, prompt?: string, startDate?: string, endDate?: string, periodLabel?: string }} options
 * @returns {string}
 */
export function buildAskAiUrl({
  from,
  prompt,
  startDate,
  endDate,
  periodLabel,
} = {}) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (prompt) params.set('prompt', prompt);
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  if (periodLabel) params.set('periodLabel', periodLabel);
  const query = params.toString();
  return query ? `/ask-ai?${query}` : '/ask-ai';
}
