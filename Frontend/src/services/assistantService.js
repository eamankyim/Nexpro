import api from './api';

/**
 * Send chat messages to ABS Assistant and receive a reply.
 * @param {Array<{ role: 'user' | 'assistant', content: string }>} messages - Conversation history
 * @param {{ pageContext?: string, startDate?: string, endDate?: string, periodLabel?: string }} [options] - Optional screen/date context
 * @returns {Promise<{ success: boolean, message: string }>} API response with assistant message
 */
const chat = async (messages, options = {}) => {
  const body = { messages };
  if (options.pageContext) {
    body.pageContext = options.pageContext;
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

const assistantService = {
  chat
};

export default assistantService;
