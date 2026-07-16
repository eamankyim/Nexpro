import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, FileDown, Loader2, MessageSquarePlus, Send, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import assistantService from '@/services/assistantService';
import { generatePDF } from '@/utils/pdfUtils';
import { showError, showSuccess } from '@/utils/toast';
import { getAiProviderErrorMessage } from '@/utils/aiProviderErrors';
import { cn } from '@/lib/utils';
import { formatAssistantMessage } from '@/utils/assistantMessageFormatter';
import { useAuth } from '@/context/AuthContext';
import {
  getAssistantPromptSets,
  getPagePrompts,
} from '@/constants/assistantPrompts';
import {
  ASSISTANT_PERIOD_OPTIONS,
  inferAssistantPeriodKey,
  resolveAssistantPeriod,
} from '@/utils/assistantPeriod';

const CARD_BORDER = { border: '1px solid #e5e7eb' };
const PERIOD_SELECTED = { backgroundColor: '#166534', color: '#fff', borderColor: '#166534' };

const extractMarketingDraft = (content = '') => {
  const text = String(content || '').trim();
  const subjectMatch = text.match(/^subject:\s*(.+)$/im);
  const subject = (subjectMatch?.[1] || '').trim();
  const withoutMetaTail = text
    .split(/^---$/m)[0]
    .split(/quick question:/i)[0]
    .trim();
  return {
    subject,
    emailBody: withoutMetaTail,
  };
};

const isMarketingDraft = (content = '') => {
  const text = String(content || '').trim();
  const draft = extractMarketingDraft(text);
  if (!draft.subject) return false;
  return /promotional|campaign|offer|newsletter|email/i.test(text);
};

function PromptSection({ title, prompts, onSelect, loading }) {
  if (!prompts?.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-foreground">{title}</p>
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <Button
            key={prompt}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelect(prompt)}
            disabled={loading}
            className="text-left h-auto py-2 whitespace-normal"
          >
            {prompt}
          </Button>
        ))}
      </div>
    </div>
  );
}

function PeriodFilterBar({ selectedPeriod, onSelect, disabled }) {
  return (
    <div
      className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-card border-b border-border"
      role="group"
      aria-label="Analysis period"
    >
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {ASSISTANT_PERIOD_OPTIONS.map((opt) => {
          const selected = selectedPeriod === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(opt.key)}
              className={cn(
                'shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                'disabled:opacity-50 disabled:pointer-events-none',
                !selected && 'border-border bg-background text-foreground hover:bg-muted'
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
  );
}

/**
 * Ask AI page — ABS Assistant for business insights, support, and drafts.
 */
export default function AskAI() {
  const navigate = useNavigate();
  const { activeTenant } = useAuth();
  const [searchParams] = useSearchParams();
  const pageContext = searchParams.get('from') || searchParams.get('pageContext') || undefined;
  const initialPrompt = searchParams.get('prompt') || undefined;
  const urlStartDate = searchParams.get('startDate') || undefined;
  const urlEndDate = searchParams.get('endDate') || undefined;
  const urlPeriodLabel = searchParams.get('periodLabel') || undefined;

  const businessType = activeTenant?.businessType || 'printing_press';
  const shopType = activeTenant?.metadata?.shopType || null;

  const [selectedPeriod, setSelectedPeriod] = useState(() =>
    inferAssistantPeriodKey(urlStartDate, urlEndDate, urlPeriodLabel)
  );
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const handledInitialPromptRef = useRef(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const periodRange = useMemo(() => resolveAssistantPeriod(selectedPeriod), [selectedPeriod]);

  const promptSets = useMemo(
    () => getAssistantPromptSets({ businessType, shopType }),
    [businessType, shopType]
  );

  const pagePrompts = useMemo(() => {
    if (!pageContext) return [];
    if (urlStartDate && urlEndDate && (pageContext === 'reports' || pageContext === 'dashboard')) {
      const period = urlPeriodLabel || periodRange.periodLabel || 'this period';
      return getPagePrompts(pageContext, {
        businessType,
        shopType,
        periodLabel: period,
      }).length
        ? [
            `Summarize performance for ${period}`,
            `What should I focus on for ${period}?`,
            'Compare this period to the previous period',
          ].filter((p) => {
            // Keep studio-safe: no restock in focus chips
            if (promptSets.kind === 'studio' && /restock|stock/i.test(p)) return false;
            return true;
          })
        : [];
    }
    return getPagePrompts(pageContext, {
      businessType,
      shopType,
      periodLabel: periodRange.periodLabel,
    });
  }, [
    pageContext,
    urlStartDate,
    urlEndDate,
    urlPeriodLabel,
    businessType,
    shopType,
    periodRange.periodLabel,
    promptSets.kind,
  ]);

  const assistantContextOptions = useMemo(
    () => ({
      pageContext,
      period: periodRange.period,
      startDate: periodRange.startDate,
      endDate: periodRange.endDate,
      periodLabel: periodRange.periodLabel,
    }),
    [pageContext, periodRange]
  );

  const scrollToBottom = useCallback(() => {
    const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, []);

  const sendMessage = useCallback(
    async (rawText) => {
      const text = String(rawText || '').trim();
      if (!text || loading) return;

      const userMessage = { role: 'user', content: text };
      const nextConversation = [...messagesRef.current, userMessage];
      setMessages(nextConversation);
      setInputValue('');
      setLoading(true);

      try {
        const res = await assistantService.chat(nextConversation, assistantContextOptions);
        const content = res?.message || 'No response from assistant.';
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content,
            meta: res?.meta || null,
            insight: res?.insight || null,
          },
        ]);
        requestAnimationFrame(scrollToBottom);
      } catch (err) {
        const aiMessage = getAiProviderErrorMessage(err);
        if (aiMessage) {
          setMessages((prev) => [...prev, { role: 'assistant', content: aiMessage }]);
          requestAnimationFrame(scrollToBottom);
        } else {
          showError(err, 'Failed to get AI response');
          setMessages((prev) => prev.slice(0, -1));
        }
      } finally {
        setLoading(false);
      }
    },
    [assistantContextOptions, loading, scrollToBottom]
  );

  /**
   * Re-run last analysis intent for a new period via owned engine (no Anthropic).
   */
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
              periodLabel: range.periodLabel,
            },
            insight: res?.insight || null,
          },
        ]);
        requestAnimationFrame(scrollToBottom);
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

  useEffect(() => {
    if (!initialPrompt || handledInitialPromptRef.current === initialPrompt) return;
    handledInitialPromptRef.current = initialPrompt;
    sendMessage(initialPrompt);
  }, [initialPrompt, sendMessage]);

  const emptyState = messages.length === 0;

  const handleNewChat = useCallback(() => {
    if (loading) return;
    setMessages([]);
    setInputValue('');
    handledInitialPromptRef.current = null;
  }, [loading]);

  const handleCopy = useCallback(async (content) => {
    try {
      await navigator.clipboard.writeText(String(content || ''));
      showSuccess('Copied to clipboard');
    } catch (err) {
      showError(err, 'Failed to copy text');
    }
  }, []);

  const handlePostToMarketing = useCallback(
    (content) => {
      const draft = extractMarketingDraft(content);
      navigate('/marketing', {
        state: {
          prefill: {
            channelEmail: true,
            subject: draft.subject,
            emailBody: draft.emailBody,
          },
        },
      });
    },
    [navigate]
  );

  const handleExportPdf = useCallback(async (content) => {
    const printable = document.createElement('div');
    printable.style.background = '#ffffff';
    printable.style.color = '#111827';
    printable.style.fontFamily = 'Inter, Arial, sans-serif';
    printable.innerHTML = `
      <h2 style="margin:0 0 12px 0;">ABS Assistant</h2>
      <p style="margin:0 0 16px 0;color:#6b7280;font-size:12px;">Generated on ${new Date().toLocaleString()}</p>
      <div>${formatAssistantMessage(String(content || ''))}</div>
    `;

    document.body.appendChild(printable);
    try {
      await generatePDF(printable, {
        filename: `abs-assistant-${new Date().toISOString().split('T')[0]}.pdf`,
      });
      showSuccess('Exported as PDF');
    } catch (err) {
      showError(err, 'Failed to export PDF');
    } finally {
      document.body.removeChild(printable);
    }
  }, []);

  return (
    <div className="w-full space-y-4 md:space-y-6">
      <div className="mb-2 md:mb-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-8 w-8 shrink-0" style={{ color: 'var(--color-primary)' }} aria-hidden />
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">Ask AI</h1>
        </div>
        <p className="text-muted-foreground mt-2 text-sm md:text-base max-w-3xl">
          ABS Assistant helps with business insights, ABS support, payment reminders, and customer message drafts.
        </p>
      </div>

      <Card style={CARD_BORDER}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="text-base">ABS Assistant</CardTitle>
              <CardDescription>
                Answers use your live workspace data for {periodRange.periodLabel.toLowerCase()}.
                Business insights come from your numbers; drafts and how-tos are guidance.
              </CardDescription>
            </div>
            {!emptyState && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleNewChat}
                disabled={loading}
                className="shrink-0"
                aria-label="New chat"
              >
                <MessageSquarePlus className="h-4 w-4 mr-1.5" />
                New chat
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <PeriodFilterBar
            selectedPeriod={selectedPeriod}
            onSelect={handlePeriodSelect}
            disabled={loading}
          />

          <ScrollArea ref={scrollRef} className="h-[55vh] rounded-md border border-border p-3">
            {emptyState ? (
              <div className="space-y-4">
                {pagePrompts.length > 0 && (
                  <PromptSection
                    title="For this page"
                    prompts={pagePrompts}
                    onSelect={sendMessage}
                    loading={loading}
                  />
                )}
                <PromptSection
                  title="Business insights"
                  prompts={promptSets.business}
                  onSelect={sendMessage}
                  loading={loading}
                />
                <PromptSection
                  title="ABS support"
                  prompts={promptSets.support}
                  onSelect={sendMessage}
                  loading={loading}
                />
                <PromptSection
                  title="Draft messages"
                  prompts={promptSets.draft}
                  onSelect={sendMessage}
                  loading={loading}
                />
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, i) => {
                  const isAnalysis = msg.meta?.source === 'analysis_engine';
                  const showReasons =
                    msg.role === 'assistant' &&
                    Array.isArray(msg.meta?.reasons) &&
                    msg.meta.reasons.length > 0 &&
                    !isAnalysis;

                  return (
                    <div
                      key={`${msg.role}-${i}`}
                      className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                    >
                      <div className="max-w-[85%] space-y-2">
                        <div
                          className={cn(
                            'rounded-lg px-3 py-2 text-sm',
                            msg.role === 'user'
                              ? 'bg-brand text-white'
                              : 'bg-muted text-foreground border border-border'
                          )}
                        >
                          {msg.role === 'assistant' ? (
                            <div
                              className="leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: formatAssistantMessage(msg.content) }}
                            />
                          ) : (
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                          )}
                          {showReasons && (
                            <ul className="mt-2 space-y-1 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                              {msg.meta.reasons.slice(0, 5).map((reason) => (
                                <li key={reason.code || reason.label}>
                                  <span className="font-medium text-foreground">{reason.label}</span>
                                  {reason.detail ? ` — ${reason.detail}` : ''}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        {msg.role === 'assistant' && (
                          <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => handleCopy(msg.content)}>
                              <Copy className="h-3.5 w-3.5 mr-1" />
                              Copy
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleExportPdf(msg.content)}
                            >
                              <FileDown className="h-3.5 w-3.5 mr-1" />
                              Export PDF
                            </Button>
                            {isMarketingDraft(msg.content) && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handlePostToMarketing(msg.content)}
                              >
                                Post to Marketing
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
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

          <p className="text-xs text-muted-foreground">
            Business numbers come from your workspace data. Drafts and how-tos are guidance, not guarantees.
          </p>

          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(inputValue);
            }}
          >
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask ABS Assistant about your business or how to use ABS..."
              disabled={loading}
            />
            <Button type="submit" className="bg-brand hover:bg-brand-dark" disabled={loading || !inputValue.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
