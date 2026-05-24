import api from './api';

export async function getTemplates() {
  return api.get('/automations/templates');
}

export async function getRules(params = {}) {
  return api.get('/automations/rules', { params });
}

export async function createRule(body) {
  return api.post('/automations/rules', body);
}

export async function draftRule(instruction) {
  return api.post('/automations/draft', { instruction });
}

export async function getSuggestions() {
  return api.get('/automations/suggestions');
}

export async function getOverview() {
  return api.get('/automations/overview');
}

export async function updateRule(id, body) {
  return api.patch(`/automations/rules/${id}`, body);
}

export async function deleteRule(id) {
  return api.delete(`/automations/rules/${id}`);
}

export async function toggleRule(id) {
  return api.post(`/automations/rules/${id}/toggle`);
}

/**
 * Unwrap runs list responses (legacy array or paginated envelope).
 * @param {{ data?: unknown }} response
 * @returns {{ runs: Array, total: number, totalPages: number, currentPage: number, limit: number }}
 */
export function unwrapAutomationRuns(response) {
  const data = response?.data;
  if (Array.isArray(data)) {
    return {
      runs: data,
      total: data.length,
      totalPages: 1,
      currentPage: 1,
      limit: data.length
    };
  }
  if (data?.runs) {
    return {
      runs: data.runs,
      total: data.total ?? data.runs.length,
      totalPages: data.totalPages ?? 1,
      currentPage: data.currentPage ?? 1,
      limit: data.limit ?? data.runs.length
    };
  }
  return { runs: [], total: 0, totalPages: 0, currentPage: 1, limit: 0 };
}

export async function getRuns(params = {}) {
  return api.get('/automations/runs', { params });
}

export async function getLogs(params = {}) {
  return api.get('/automations/logs', { params });
}

export async function getWhatsAppEvents(params = {}) {
  return api.get('/automations/whatsapp-events', { params });
}

export async function testRule(id, triggerContext = {}, options = {}) {
  return api.post(`/automations/rules/${id}/test`, { triggerContext, ...options });
}

export default {
  getTemplates,
  getRules,
  createRule,
  draftRule,
  getSuggestions,
  getOverview,
  updateRule,
  deleteRule,
  toggleRule,
  getRuns,
  getLogs,
  getWhatsAppEvents,
  testRule,
  unwrapAutomationRuns
};
