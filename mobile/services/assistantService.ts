import { api } from './api';

type Message = { role: 'user' | 'assistant'; content: string };

export const assistantService = {
  chat: async (messages: Message[]) => {
    const res = await api.post('/assistant/chat', { messages });
    // Backend returns: { success: true, message: '...' }
    return res.data;
  },
};
