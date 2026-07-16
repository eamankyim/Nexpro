import { api } from './api';
import { logger } from '@/utils/logger';

type Message = { role: 'user' | 'assistant'; content: string };

type ChatOptions = {
  pageContext?: string;
  period?: string;
  startDate?: string;
  endDate?: string;
  periodLabel?: string;
  /** Epoch ms when the user tapped send (for queue/network timing). */
  clientSubmittedAt?: number;
};

type AnalysisOptions = {
  intent?: string;
  pageContext?: string;
  period?: string;
  startDate?: string;
  endDate?: string;
  periodLabel?: string;
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

    const body: {
      messages: Message[];
      pageContext?: string;
      period?: string;
      startDate?: string;
      endDate?: string;
      periodLabel?: string;
    } = { messages };
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

  /** Owned analysis engine (DB numbers only — no Anthropic). */
  askAnalysis: async (message: string, options: AnalysisOptions = {}) => {
    const body: Record<string, string> = { message };
    if (options.intent) body.intent = options.intent;
    if (options.pageContext) body.pageContext = options.pageContext;
    if (options.period) body.period = options.period;
    if (options.startDate && options.endDate) {
      body.startDate = options.startDate;
      body.endDate = options.endDate;
    }
    if (options.periodLabel) body.periodLabel = options.periodLabel;
    const res = await api.post('/analysis/ask', body);
    return res.data;
  },
};
