import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Award,
  Briefcase,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Copy,
  FileDown,
  FileText,
  Loader2,
  MessageSquarePlus,
  Package,
  Paperclip,
  Send,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import assistantService from '@/services/assistantService';
import { generatePDF } from '@/utils/pdfUtils';
import { showError, showSuccess } from '@/utils/toast';
import { getAiProviderErrorMessage, AI_SETTINGS_PATH } from '@/utils/aiProviderErrors';
import { PRIVACY_POLICY_URL } from '@/constants/legal';
import { cn } from '@/lib/utils';
import { formatAssistantMessage } from '@/utils/assistantMessageFormatter';
import { useAuth } from '@/context/AuthContext';
import {
  getAssistantPromptSets,
  getAssistantSuggestionCards,
  getPagePrompts,
} from '@/constants/assistantPrompts';
import {
  ASSISTANT_PERIOD_OPTIONS,
  inferAssistantPeriodKey,
  resolveAssistantPeriod,
} from '@/utils/assistantPeriod';

const PERIOD_SELECTED = { backgroundColor: '#166534', color: '#fff', borderColor: '#166534' };

const CARD_ICONS = {
  trending: TrendingUp,
  wallet: Wallet,
  package: Package,
  briefcase: Briefcase,
  file: FileText,
  award: Award,
  calendar: CalendarDays,
  users: Users,
  utensils: UtensilsCrossed,
  sparkles: Sparkles,
};

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

function PeriodFilterBar({ selectedPeriod, onSelect, disabled }) {
  return (
    <div
      className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-background border-b border-border"
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

function SuggestionCard({ card, onSelect, disabled }) {
  const Icon = CARD_ICONS[card.icon] || Sparkles;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(card.prompt)}
      className={cn(
        'w-[200px] shrink-0 rounded-xl border border-border bg-white p-4 text-left transition-colors',
        'hover:border-[#166534]/40 hover:bg-[#f0fdf4]/40',
        'disabled:opacity-50 disabled:pointer-events-none'
      )}
    >
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#dcfce7]">
        <Icon className="h-4 w-4 text-[#166534]" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-foreground">{card.title}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{card.prompt}</p>
    </button>
  );
}

/**
 * Ask AI page — ABS Assistant for business insights, support, and drafts.
 */
export default function AskAI() {
  const navigate = useNavigate();
  const { activeTenant, user } = useAuth();
  const [searchParams] = useSearchParams();
  const pageContext = searchParams.get('from') || searchParams.get('pageContext') || undefined;
  const initialPrompt = searchParams.get('prompt') || undefined;
  const urlStartDate = searchParams.get('startDate') || undefined;
  const urlEndDate = searchParams.get('endDate') || undefined;
  const urlPeriodLabel = searchParams.get('periodLabel') || undefined;

  const businessType = activeTenant?.businessType || 'printing_press';
  const shopType = activeTenant?.metadata?.shopType || null;
  const firstName = String(user?.name || '').trim().split(/\s+/)[0] || 'there';

  const [selectedPeriod, setSelectedPeriod] = useState(() =>
    inferAssistantPeriodKey(urlStartDate, urlEndDate, urlPeriodLabel)
  );
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const cardsScrollRef = useRef(null);
  const textareaRef = useRef(null);
  const handledInitialPromptRef = useRef(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const periodRange = useMemo(() => resolveAssistantPeriod(selectedPeriod), [selectedPeriod]);
  const selectedPeriodLabel = useMemo(
    () => ASSISTANT_PERIOD_OPTIONS.find((opt) => opt.key === selectedPeriod)?.label || 'Smart',
    [selectedPeriod]
  );

  const promptSets = useMemo(
    () => getAssistantPromptSets({ businessType, shopType }),
    [businessType, shopType]
  );

  const emptyStateSubcopy = useMemo(() => {
    if (promptSets.kind === 'studio') {
      return 'Get quick answers, insights, and help with your business. Ask anything about your sales, collections, jobs, and more.';
    }
    if (promptSets.kind === 'restaurant') {
      return 'Get quick answers, insights, and help with your kitchen. Ask anything about food sales, orders, ingredients, collections, and more.';
    }
    return 'Get quick answers, insights, and help with your business. Ask anything about your sales, collections, stock, and more.';
  }, [promptSets.kind]);

  const suggestionCards = useMemo(
    () => getAssistantSuggestionCards({ businessType, shopType, limit: 5 }),
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

  const scrollCards = useCallback((direction) => {
    const el = cardsScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * 220, behavior: 'smooth' });
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

  const handleComposerKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage(inputValue);
      }
    },
    [inputValue, sendMessage]
  );

  const composer = (
    <div
      className={cn(
        'rounded-2xl border-2 border-[#166534] bg-white p-3 md:p-4',
        emptyState ? 'mx-auto w-full max-w-3xl' : 'w-full'
      )}
    >
      <Textarea
        ref={textareaRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleComposerKeyDown}
        placeholder="Ask me anything about your business..."
        disabled={loading}
        rows={emptyState ? 3 : 2}
        className="min-h-[72px] resize-none border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
      />
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            title="Attachments coming soon"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground opacity-60"
            aria-label="Attach file (coming soon)"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-full border-border px-3"
                disabled={loading}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5 text-[#166534]" />
                {selectedPeriodLabel === 'Today' ? 'Smart' : selectedPeriodLabel}
                <ChevronDown className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {ASSISTANT_PERIOD_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.key}
                  onClick={() => handlePeriodSelect(opt.key)}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button
          type="button"
          size="icon"
          className="h-10 w-10 rounded-full bg-[#166534] hover:bg-[#14532d]"
          disabled={loading || !inputValue.trim()}
          onClick={() => sendMessage(inputValue)}
          aria-label="Send message"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  return (
    <div className={cn('w-full', emptyState ? 'min-h-[calc(100vh-8rem)]' : 'space-y-4')}>
      {emptyState ? (
        <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 py-8">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#dcfce7]">
            <Sparkles className="h-7 w-7 text-[#166534]" aria-hidden />
          </div>
          <h1 className="max-w-2xl text-center text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Hi {firstName}, I&apos;m your{' '}
            <span className="text-[#166534]">ABS AI Assistant</span>
          </h1>
          <p className="mt-3 max-w-xl text-center text-sm text-muted-foreground md:text-base">
            {emptyStateSubcopy}
          </p>

          <div className="mt-8 w-full">{composer}</div>

          {pagePrompts.length > 0 ? (
            <div className="mt-6 flex max-w-3xl flex-wrap justify-center gap-2">
              {pagePrompts.slice(0, 3).map((prompt) => (
                <Button
                  key={prompt}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => sendMessage(prompt)}
                  className="h-auto whitespace-normal py-2 text-left"
                >
                  {prompt}
                </Button>
              ))}
            </div>
          ) : null}

          <div className="mt-10 w-full max-w-5xl">
            <p className="mb-3 text-sm font-semibold text-foreground">Try asking about</p>
            <div className="relative">
              <div
                ref={cardsScrollRef}
                className="flex gap-3 overflow-x-auto pb-2 pr-12 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {suggestionCards.map((card) => (
                  <SuggestionCard
                    key={card.id}
                    card={card}
                    onSelect={sendMessage}
                    disabled={loading}
                  />
                ))}
              </div>
              {suggestionCards.length > 3 ? (
                <button
                  type="button"
                  onClick={() => scrollCards(1)}
                  className="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white text-foreground"
                  aria-label="Show more suggestions"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          <p className="mt-10 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              ABS AI uses your workspace data securely and privately.{' '}
              <a
                href={PRIVACY_POLICY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#166534] underline underline-offset-2"
              >
                Learn more
              </a>
            </span>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dcfce7]">
                  <Sparkles className="h-4 w-4 text-[#166534]" aria-hidden />
                </div>
                <h1 className="text-xl font-bold text-foreground md:text-2xl">
                  ABS AI Assistant
                </h1>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Live numbers use your workspace data for {periodRange.periodLabel.toLowerCase()}.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleNewChat}
              disabled={loading}
              className="shrink-0"
              aria-label="New chat"
            >
              <MessageSquarePlus className="mr-1.5 h-4 w-4" />
              New chat
            </Button>
          </div>

          <PeriodFilterBar
            selectedPeriod={selectedPeriod}
            onSelect={handlePeriodSelect}
            disabled={loading}
          />

          <ScrollArea ref={scrollRef} className="h-[55vh] rounded-xl border border-border bg-white p-3">
            <div className="space-y-3">
              {messages.map((msg, i) => {
                const isAnalysis = msg.meta?.source === 'analysis_engine';
                const needsTenantKey = msg.meta?.source === 'tenant_key_required';
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
                            ? 'bg-[#166534] text-white'
                            : 'border border-border bg-muted text-foreground'
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
                            <Copy className="mr-1 h-3.5 w-3.5" />
                            Copy
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleExportPdf(msg.content)}
                          >
                            <FileDown className="mr-1 h-3.5 w-3.5" />
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
                          {needsTenantKey && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => navigate(AI_SETTINGS_PATH)}
                            >
                              Open AI Settings
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
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking...
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {composer}
        </div>
      )}
    </div>
  );
}
