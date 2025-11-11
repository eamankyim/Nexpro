#!/usr/bin/env node
/**
 * Smoke test for notification triggers around lead workflows.
 *
 * Usage:
 *   node scripts/smokeNotifications.js [baseUrl] [token]
 *
 * - baseUrl defaults to http://localhost:5000
 * - token is optional; if omitted a login request will be made using ADMIN_EMAIL/ADMIN_PASSWORD env vars
 *
 * The script performs:
 *   1. Authenticates and captures the acting user.
 *   2. Records notification summary before actions.
 *   3. Creates a lead assigned to the logged-in user (should trigger "New Lead Assigned").
 *   4. Updates lead status to "qualified" (should trigger "Lead Status Updated").
 *   5. Logs an activity on the lead (should trigger "New Lead Activity").
 *   6. Fetches notifications and summaries afterwards, outputting the delta.
 */
const axios = require('axios');
const qs = require('qs');
const { v4: uuid } = require('uuid');

const BASE_URL = process.argv[2] || process.env.API_BASE_URL || 'http://localhost:5000';
const PROVIDED_TOKEN = process.argv[3] || process.env.API_TOKEN || null;

const credentials = {
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
};

const log = (type, message, data = {}) => {
  console.log(JSON.stringify({
    stamp: new Date().toISOString(),
    type,
    message,
    ...data
  }));
};

const authenticate = async () => {
  if (PROVIDED_TOKEN) {
    log('info', 'Using provided token');
    return { token: PROVIDED_TOKEN };
  }

  if (!credentials.email || !credentials.password) {
    throw new Error('No token supplied and ADMIN_EMAIL/ADMIN_PASSWORD env vars not set.');
  }

  log('info', 'Requesting token via /api/auth/login');
  const response = await axios.post(`${BASE_URL}/api/auth/login`, credentials);
  const { token, user } = response.data?.data || {};

  if (!token) {
    throw new Error('Login response did not include token');
  }

  return { token, user };
};

const fetchCurrentUser = async (client) => {
  const response = await client.get('/api/auth/me');
  return response.data?.data;
};

const fetchSummary = async (client) => {
  const response = await client.get('/api/notifications/summary');
  return response.data?.data;
};

const fetchLatestNotifications = async (client, limit = 10) => {
  const response = await client.get('/api/notifications', {
    params: { page: 1, limit }
  });
  return response.data?.data || [];
};

const createLead = async (client, payload) => {
  const response = await client.post('/api/leads', payload);
  return response.data?.data;
};

const updateLeadStatus = async (client, leadId, status) => {
  const response = await client.put(`/api/leads/${leadId}`, { status });
  return response.data?.data;
};

const logLeadActivity = async (client, leadId) => {
  const response = await client.post(`/api/leads/${leadId}/activities`, {
    type: 'call',
    subject: 'Automated smoke test activity',
    notes: 'This activity was created by the smoke test script.',
    nextStep: 'Follow up tomorrow',
    metadata: { source: 'smoke-test' }
  });
  return response.data?.data;
};

const run = async () => {
  try {
    log('info', 'Starting notifications smoke test', { baseUrl: BASE_URL });

    const { token: rawToken, user: initialUser } = await authenticate();
    const client = axios.create({
      baseURL: BASE_URL,
      headers: {
        Authorization: `Bearer ${rawToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000,
      paramsSerializer: (params) => qs.stringify(params, { encode: true })
    });

    const user = initialUser || await fetchCurrentUser(client);
    if (!user?.id) {
      throw new Error('Unable to determine acting user ID');
    }
    log('info', 'Authenticated user', { userId: user.id, email: user.email });

    const beforeSummary = await fetchSummary(client);
    log('info', 'Summary before actions', beforeSummary);

    const leadPayload = {
      name: `Smoke Test Lead ${uuid().slice(0, 8)}`,
      email: `smoke.${Date.now()}@example.com`,
      phone: '+233555000111',
      source: 'outreach',
      status: 'new',
      priority: 'high',
      assignedTo: user.id,
      notes: 'Created by notifications smoke test'
    };

    const lead = await createLead(client, leadPayload);
    log('success', 'Lead created', { leadId: lead.id });

    await updateLeadStatus(client, lead.id, 'qualified');
    log('success', 'Lead status updated', { leadId: lead.id, status: 'qualified' });

    await logLeadActivity(client, lead.id);
    log('success', 'Lead activity logged', { leadId: lead.id });

    const afterSummary = await fetchSummary(client);
    log('info', 'Summary after actions', afterSummary);

    const latest = await fetchLatestNotifications(client, 5);
    log('info', 'Latest notifications snapshot', {
      count: latest.length,
      items: latest.map((n) => ({
        id: n.id,
        title: n.title,
        type: n.type,
        isRead: n.isRead,
        createdAt: n.createdAt
      }))
    });

    const deltaTotal = (afterSummary?.total || 0) - (beforeSummary?.total || 0);
    const deltaUnread = (afterSummary?.unread || 0) - (beforeSummary?.unread || 0);

    if (deltaTotal >= 3) {
      log('success', 'Notifications created as expected', { deltaTotal, deltaUnread });
    } else {
      log('warn', 'Unexpected notification count delta', { deltaTotal, deltaUnread });
      process.exitCode = 1;
    }

    log('info', 'Notifications smoke test completed');
  } catch (error) {
    log('fatal', 'Smoke test aborted', {
      message: error.response?.data?.message || error.message,
      stack: error.stack
    });
    process.exitCode = 1;
  }
};

run();


