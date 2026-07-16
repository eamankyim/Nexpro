import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Loader2, X, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import assistantService from '@/services/assistantService';
import { showError } from '@/utils/toast';
import { getAiProviderErrorMessage } from '@/utils/aiProviderErrors';
import { cn } from '@/lib/utils';
import { formatAssistantMessage } from '@/utils/assistantMessageFormatter';
import { useAuth } from '@/context/AuthContext';
import { getAssistantPromptSets } from '@/constants/assistantPrompts';
import {
  ASSISTANT_PERIOD_OPTIONS,
  resolveAssistantPeriod,
} from '@/utils/assistantPeriod';

const PERIOD_SELECTED = { backgroundColor: '#166534', color: '#fff', borderColor: '#166534' };

function PromptList({ title, prompts, onSelect, loading }) {
  if (!prompts?.length) return null;
  return (
    <>
      <p className="text-xs font-medium text-foreground pt-1">{title}</p>
      <ul className="space-y-2">
        {prompts.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              onClick={() => onSelect(prompt)}
              disabled={loading}
              className={cn(
                'text-left text-sm w-full px-3 py-2 rounded-lg border border-gray-200',
                'bg-muted hover:bg-muted/80 text-foreground',
                'disabled:opacity-50 disabled:pointer-events-none'
              )}
            >
              {prompt}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Floating ABS Assistant chat panel (web).
 */
export default function AssistantChatPanel({ open, onOpenChange, pageContext }) {
  const { activeTenant } = useAuth();
  const businessType = activeTenant?.businessType || 'printing_press';
  const shopType = activeTenant?.metadata?.shopType || null;

  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const lastSendAtRef = useRef(0);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const SEND_DEBOUNCE_MS = 800;

  const periodRange = useMemo(() => resolveAssistantPeriod(selectedPeriod), [selectedPeriod]);
  const promptSets = useMemo(
    () => getAssistantPromptSets({ businessType, shopType }),
    [businessType, shopType]
  );

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (open && messages.length > 0) {
      scrollToBottom();
    }
  }, [open, messages.length, scrollToBottom]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    if (open) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open, onOpenChange]);

  const contextOptions = useMemo(
    () => ({
      pageContext,
      period: periodRange.period,
      startDate: periodRange.startDate,
      endDate: periodRange.endDate,
      periodLabel: periodRange.periodLabel,
    }),
    [pageContext, periodRange]
  );

  const handleSend = useCallback(
    async (text) => {
      const trimmed = (text || inputValue).trim();
      if (!trimmed || loading) return;

      const now = Date.now();
      if (now - lastSendAtRef.current < SEND_DEBOUNCE_MS) return;
      lastSendAtRef.current = now;

      const userMessage = { role: 'user', content: trimmed };
      const conversation = [...messagesRef.current, userMessage];
      setMessages(conversation);
      setInputValue('');
      setLoading(true);

      try {
        const result = await assistantService.chat(conversation, contextOptions);
        const assistantContent = result?.message ?? result?.error ?? 'No response from the assistant.';
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: assistantContent,
            meta: result?.meta || null,
          },
        ]);
        scrollToBottom();
      } catch (err) {
        const aiMessage = getAiProviderErrorMessage(err);
        if (aiMessage) {
          setMessages((prev) => [...prev, { role: 'assistant', content: aiMessage }]);
          scrollToBottom();
        } else {
          showError(err, 'Failed to get a response. Please try again.');
          setMessages((prev) => prev.slice(0, -1));
        }
      } finally {
        setLoading(false);
      }
    },
    [inputValue, loading, contextOptions, scrollToBottom]
  );

  const refreshLastAnalysis = useCallback(
    async (range) => {
      const current = messagesRef.current;
      let lastAssistantIdx = -1;
      for (let i = current.length - 1; i >= 0; i -= 1) {
        if (
          current[i].role === 'assistant' &&
          (current[i].meta?.source === 'analysis_engine' || current[i].meta?.intent)
        ) {
          lastAssistantIdx = i;
          break;
        }
      }
      if (lastAssistantIdx < 0) return;

      let lastUserQuestion = '';
      for (let i = lastAssistantIdx - 1; i >= 0; i -= 1) {
        if (current[i].role === 'user') {
          lastUserQuestion = current[i].content;
          break;
        }
      }
      if (!lastUserQuestion) return;

      const intent = current[lastAssistantIdx].meta?.intent || undefined;
      setLoading(true);
      try {
        const res = await assistantService.askAnalysis(lastUserQuestion, {
          intent,
          period: range.period,
          startDate: range.startDate,
          endDate: range.endDate,
          periodLabel: range.periodLabel,
          pageContext,
        });
        const content = res?.message || res?.answerMarkdown || 'No response from assistant.';
        const prefix = `For **${range.periodLabel}**:\n\n`;
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: content.startsWith('For **') ? content : `${prefix}${content}`,
            meta: {
              ...(res?.meta || {}),
              source: 'analysis_engine',
              intent: res?.intent || intent || res?.meta?.intent,
              periodRefresh: true,
            },
          },
        ]);
        scrollToBottom();
      } catch (err) {
        const aiMessage = getAiProviderErrorMessage(err);
        if (aiMessage) {
          setMessages((prev) => [...prev, { role: 'assistant', content: aiMessage }]);
        } else {
          showError(err, 'Failed to refresh for the selected period');
        }
      } finally {
        setLoading(false);
      }
    },
    [pageContext, scrollToBottom]
  );

  const handlePeriodSelect = useCallback(
    (periodKey) => {
      if (loading || periodKey === selectedPeriod) return;
      const range = resolveAssistantPeriod(periodKey);
      setSelectedPeriod(periodKey);
      if (messagesRef.current.length === 0) return;
      refreshLastAnalysis(range);
    },
    [loading, selectedPeriod, refreshLastAnalysis]
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (prompt) => {
    handleSend(prompt);
  };

  const handleNewChat = useCallback(() => {
    if (loading) return;
    setMessages([]);
    setInputValue('');
  }, [loading]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close overlay"
        className="fixed inset-0 z-40 bg-black/40"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-label="ABS Assistant"
        className={cn(
          'fixed z-50 flex flex-col w-full max-w-md h-[70vh] max-h-[70vh]',
          'right-4 bottom-4 left-4 sm:left-auto',
          'rounded-lg border border-gray-200 bg-card overflow-hidden',
          'flex flex-col p-0 gap-0'
        )}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold truncate">ABS Assistant</h2>
          <div className="flex items-center gap-1 shrink-0">
            {messages.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="New chat"
                className="h-8 px-2 text-xs"
                onClick={handleNewChat}
                disabled={loading}
              >
                <MessageSquarePlus className="h-3.5 w-3.5 mr-1" />
                New chat
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close"
              className="h-8 w-8"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          className="px-4 py-2 border-b border-gray-200 shrink-0 overflow-x-auto"
          role="group"
          aria-label="Analysis period"
        >
          <div className="flex gap-2">
            {ASSISTANT_PERIOD_OPTIONS.map((opt) => {
              const selected = selectedPeriod === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  disabled={loading}
                  onClick={() => handlePeriodSelect(opt.key)}
                  className={cn(
                    'shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium',
                    'disabled:opacity-50',
                    !selected && 'border-gray-200 bg-background text-foreground'
                  )}
                  style={selected ? PERIOD_SELECTED : undefined}
                  aria-pressed={selected}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <ScrollArea ref={scrollRef} className="flex-1 min-h-0 px-4 py-3">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Business insights, ABS support, and customer message drafts — powered by your workspace data.
              </p>
              <PromptList
                title="Business insights"
                prompts={promptSets.business}
                onSelect={handleSuggestionClick}
                loading={loading}
              />
              <PromptList
                title="ABS support"
                prompts={promptSets.support}
                onSelect={handleSuggestionClick}
                loading={loading}
              />
              <PromptList
                title="Draft messages"
                prompts={promptSets.draft}
                onSelect={handleSuggestionClick}
                loading={loading}
              />
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                      msg.role === 'user'
                        ? 'bg-brand text-white'
                        : 'bg-muted text-foreground border border-border'
                    )}
                  >
                    {msg.role === 'assistant' ? (
                      <div
                        className="leading-relaxed [&_strong]:font-semibold [&_br]:block [&_br]:h-1"
                        dangerouslySetInnerHTML={{ __html: formatAssistantMessage(msg.content) }}
                      />
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-lg px-3 py-2 bg-muted border border-border flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking...
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="px-4 py-3 border-t border-gray-200 space-y-2 shrink-0">
          <p className="text-xs text-gray-400">
            Business numbers come from your workspace data. Drafts are guidance.
          </p>
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask ABS Assistant..."
              disabled={loading}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={() => handleSend()}
              disabled={!inputValue.trim()}
              loading={loading}
              size="icon"
              className="bg-brand hover:bg-brand-dark"
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
