import { api } from './api';

type Message = { role: 'user' | 'assistant'; content: string };

type ChatOptions = {
  pageContext?: string;
};

export const assistantService = {
  chat: async (messages: Message[], options: ChatOptions = {}) => {
    const body: { messages: Message[]; pageContext?: string } = { messages };
    if (options.pageContext) {
      body.pageContext = options.pageContext;
    }
    const res = await api.post('/assistant/chat', body);
    return res.data;
  },
};
