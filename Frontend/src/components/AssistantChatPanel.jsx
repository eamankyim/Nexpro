import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import assistantService from '@/services/assistantService';
import { showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { formatAssistantMessage } from '@/utils/assistantMessageFormatter';

const SUGGESTED_PROMPTS = [
  'How many customers do I have this month?',
  'Predict next month sales',
  'Summarize this month\'s performance',
];

const HOW_TO_PROMPTS = [
  'How do I create an expense?',
  'How do I create a quote?',
  'How do I record a payment on an invoice?',
];

const MARKETING_PROMPTS = [
  'Draft a promotional email for my customers (subject + plain text for Marketing)',
  'How do I send a promotion to all customers in ABS?',
];

/**
 * AssistantChatPanel - Floating chat panel for the AI business assistant.
 * 70% viewport height, positioned bottom-right; not a full-height side drawer.
 */
export default function AssistantChatPanel({ open, onOpenChange }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

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

  const handleSend = useCallback(async (text) => {
    const trimmed = (text || inputValue).trim();
    if (!trimmed || loading) return;

    const userMessage = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      const conversation = [...messages, userMessage];
      const result = await assistantService.chat(conversation);
      const assistantContent = result?.message ?? result?.error ?? 'No response from the assistant.';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: assistantContent },
      ]);
      scrollToBottom();
    } catch (err) {
      showError(err, 'Failed to get a response. Please try again.');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }, [inputValue, loading, messages]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (prompt) => {
    handleSend(prompt);
  };

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
        aria-label="AI Assistant"
        className={cn(
          'fixed z-50 flex flex-col w-full max-w-md h-[70vh] max-h-[70vh]',
          'right-4 bottom-4 left-4 sm:left-auto',
          'rounded-lg border border-gray-200 bg-card overflow-hidden',
          'flex flex-col p-0 gap-0'
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold">AI Assistant</h2>
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

        <ScrollArea
          ref={scrollRef}
          className="flex-1 min-h-0 px-4 py-3"
        >
          {messages.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Ask about your business data (customers, revenue, sales) or how to use the app.
              </p>
              <p className="text-xs font-medium text-foreground">How do I…?</p>
              <ul className="space-y-2">
                {HOW_TO_PROMPTS.map((prompt) => (
                  <li key={prompt}>
                    <button
                      type="button"
                      onClick={() => handleSuggestionClick(prompt)}
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
              <p className="text-xs font-medium text-foreground pt-1">Marketing &amp; customers</p>
              <ul className="space-y-2">
                {MARKETING_PROMPTS.map((prompt) => (
                  <li key={prompt}>
                    <button
                      type="button"
                      onClick={() => handleSuggestionClick(prompt)}
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
              <p className="text-xs font-medium text-foreground pt-1">Data &amp; predictions</p>
              <ul className="space-y-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <li key={prompt}>
                    <button
                      type="button"
                      onClick={() => handleSuggestionClick(prompt)}
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
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
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
          <p className="text-xs text-gray-400">AI predictions are estimates only.</p>
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your business..."
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
