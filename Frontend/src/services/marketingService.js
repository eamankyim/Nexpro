import api from './api';

/**
 * api interceptor already returns response body `{ success, data }` — return it as-is
 * so callers can use `response.data` (same pattern as settingsService).
 *
 * @returns {Promise<{ success: boolean, data: { email: { available: boolean }, sms: { available: boolean }, whatsapp: { available: boolean } } }>}
 */
export async function getCapabilities() {
  return api.get('/marketing/capabilities');
}

/**
 * @param {{ activeOnly?: boolean }} params
 */
export async function getPreview(params = {}) {
  return api.get('/marketing/preview', { params });
}

/**
 * @param {Object} body - broadcast payload (channels, dryRun, email/sms/whatsapp fields)
 */
export async function postBroadcast(body) {
  return api.post('/marketing/broadcast', body);
}

export default {
  getCapabilities,
  getPreview,
  postBroadcast,
};
