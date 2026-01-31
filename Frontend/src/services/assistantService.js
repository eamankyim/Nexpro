import api from './api';

/**
 * Send chat messages to the AI assistant and receive a reply.
 * @param {Array<{ role: 'user' | 'assistant', content: string }>} messages - Conversation history
 * @returns {Promise<{ success: boolean, message: string }>} API response with assistant message
 */
const chat = async (messages) => {
  const { data } = await api.post('/assistant/chat', { messages });
  return data;
};

const assistantService = {
  chat
};

export default assistantService;
