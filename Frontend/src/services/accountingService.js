import api from './api';

const getAccounts = async (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      query.append(key, value);
    }
  });
  const queryString = query.toString();
  return api.get(queryString ? `/accounting/accounts?${queryString}` : '/accounting/accounts');
};

const createAccount = async (payload) => api.post('/accounting/accounts', payload);

const updateAccount = async (id, payload) => api.put(`/accounting/accounts/${id}`, payload);

const getJournalEntries = async (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      query.append(key, value);
    }
  });
  const queryString = query.toString();
  return api.get(queryString ? `/accounting/journal?${queryString}` : '/accounting/journal');
};

const getJournalEntry = async (id) => api.get(`/accounting/journal/${id}`);

const createJournalEntry = async (payload) => api.post('/accounting/journal', payload);

const getTrialBalance = async (params = {}) => {
  const query = new URLSearchParams(params);
  const queryString = query.toString();
  return api.get(queryString ? `/accounting/trial-balance?${queryString}` : '/accounting/trial-balance');
};

const getAccountSummary = async () => api.get('/accounting/accounts/summary');

export default {
  getAccounts,
  createAccount,
  updateAccount,
  getJournalEntries,
  getJournalEntry,
  createJournalEntry,
  getTrialBalance,
  getAccountSummary
};





