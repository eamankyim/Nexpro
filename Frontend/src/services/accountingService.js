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

const deleteAccount = async (id) => api.delete(`/accounting/accounts/${id}`);

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

const postJournalEntry = async (id) => api.patch(`/accounting/journal/${id}/post`);

const deleteJournalEntry = async (id) => api.delete(`/accounting/journal/${id}`);

const getTrialBalance = async (params = {}) => {
  const query = new URLSearchParams(params);
  const queryString = query.toString();
  return api.get(queryString ? `/accounting/trial-balance?${queryString}` : '/accounting/trial-balance');
};

const getAccountSummary = async () => api.get('/accounting/accounts/summary');

const getRecurringJournals = async () => api.get('/accounting/recurring-journals');
const createRecurringJournal = async (payload) => api.post('/accounting/recurring-journals', payload);
const updateRecurringJournal = async (id, payload) => api.put(`/accounting/recurring-journals/${id}`, payload);
const deleteRecurringJournal = async (id) => api.delete(`/accounting/recurring-journals/${id}`);
const runRecurringJournalNow = async (id) => api.post(`/accounting/recurring-journals/${id}/run-now`);
const runDueRecurringJournals = async (payload = {}) => api.post('/accounting/recurring-journals/run-due', payload);
const getRecurringJournalRuns = async (params = {}) => {
  const query = new URLSearchParams(params);
  const queryString = query.toString();
  return api.get(queryString ? `/accounting/recurring-journals-runs?${queryString}` : '/accounting/recurring-journals-runs');
};

export default {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  getJournalEntries,
  getJournalEntry,
  createJournalEntry,
  postJournalEntry,
  deleteJournalEntry,
  getTrialBalance,
  getAccountSummary,
  getRecurringJournals,
  createRecurringJournal,
  updateRecurringJournal,
  deleteRecurringJournal,
  runRecurringJournalNow,
  runDueRecurringJournals,
  getRecurringJournalRuns
};





