import { api } from './api';
import { logger } from '@/utils/logger';

type Message = { role: 'user' | 'assistant'; content: string };

type ChatOptions = {
  pageContext?: string;
  /** Epoch ms when the user tapped send (for queue/network timing). */
  clientSubmittedAt?: number;
};

export const assistantService = {
  chat: async (messages: Message[], options: ChatOptions = {}) => {
    const clientSubmittedAt = options.clientSubmittedAt ?? Date.now();
    const requestStartedAt = Date.now();
    const prepMs = requestStartedAt - clientSubmittedAt;

    logger.info('Assistant', 'perf:request_start', {
      clientSubmittedAt,
      requestStartedAt,
      prepMs,
      messageCount: messages.length,
    });

    const body: { messages: Message[]; pageContext?: string } = { messages };
    if (options.pageContext) {
      body.pageContext = options.pageContext;
    }

    try {
      const res = await api.post('/assistant/chat', body, {
        headers: {
          'X-Client-Submitted-At': String(clientSubmittedAt),
        },
      });

      const requestFinishedAt = Date.now();
      logger.info('Assistant', 'perf:request_finish', {
        clientSubmittedAt,
        requestStartedAt,
        requestFinishedAt,
        prepMs,
        networkMs: requestFinishedAt - requestStartedAt,
        status: res.status,
      });

      return res.data;
    } catch (error) {
      const requestFinishedAt = Date.now();
      logger.warn('Assistant', 'perf:request_failed', {
        clientSubmittedAt,
        requestStartedAt,
        requestFinishedAt,
        prepMs,
        networkMs: requestFinishedAt - requestStartedAt,
      });
      throw error;
    }
  },
};
