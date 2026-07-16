import api from './api';

/**
 * Send chat messages to ABS Assistant and receive a reply.
 * Analysis intents are answered by the owned analysis engine (no Anthropic).
 * @param {Array<{ role: 'user' | 'assistant', content: string }>} messages - Conversation history
 * @param {{ pageContext?: string, period?: string, startDate?: string, endDate?: string, periodLabel?: string }} [options] - Optional screen/date context
 * @returns {Promise<{ success: boolean, message: string, meta?: object, insight?: object }>}
 */
const chat = async (messages, options = {}) => {
  const body = { messages };
  if (options.pageContext) {
    body.pageContext = options.pageContext;
  }
  if (options.period) {
    body.period = options.period;
  }
  if (options.startDate && options.endDate) {
    body.startDate = options.startDate;
    body.endDate = options.endDate;
  }
  if (options.periodLabel) {
    body.periodLabel = options.periodLabel;
  }
  const response = await api.post('/assistant/chat', body);
  return response;
};

/**
 * Ask the owned analysis engine directly (DB numbers only).
 * @param {string} message
 * @param {{ intent?: string, period?: string, startDate?: string, endDate?: string, periodLabel?: string, pageContext?: string }} [options]
 */
const askAnalysis = async (message, options = {}) => {
  const body = { message };
  if (options.intent) body.intent = options.intent;
  if (options.period) body.period = options.period;
  if (options.startDate && options.endDate) {
    body.startDate = options.startDate;
    body.endDate = options.endDate;
  }
  if (options.periodLabel) body.periodLabel = options.periodLabel;
  if (options.pageContext) body.pageContext = options.pageContext;
  return api.post('/analysis/ask', body);
};

const assistantService = {
  chat,
  askAnalysis,
};

export default assistantService;
