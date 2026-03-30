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

export async function updateRule(id, body) {
  return api.patch(`/automations/rules/${id}`, body);
}

export async function toggleRule(id) {
  return api.post(`/automations/rules/${id}/toggle`);
}

export async function getRuns(params = {}) {
  return api.get('/automations/runs', { params });
}

export async function testRule(id, triggerContext = {}) {
  return api.post(`/automations/rules/${id}/test`, { triggerContext });
}

export default {
  getTemplates,
  getRules,
  createRule,
  updateRule,
  toggleRule,
  getRuns,
  testRule
};
