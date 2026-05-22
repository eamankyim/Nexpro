import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, FileDown, Loader2, Send, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import assistantService from '@/services/assistantService';
import { generatePDF } from '@/utils/pdfUtils';
import { showError, showSuccess } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { formatAssistantMessage } from '@/utils/assistantMessageFormatter';
import {
  ASSISTANT_BUSINESS_PROMPTS,
  ASSISTANT_DRAFT_PROMPTS,
  ASSISTANT_PAGE_PROMPTS,
  ASSISTANT_SUPPORT_PROMPTS,
} from '@/constants/assistantPrompts';

const CARD_BORDER = { border: '1px solid #e5e7eb' };

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

/**
 * Ask AI page — ABS Assistant for business insights, support, and drafts.
 */
export default function AskAI() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pageContext = searchParams.get('from') || searchParams.get('pageContext') || undefined;
  const initialPrompt = searchParams.get('prompt') || undefined;
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const periodLabel = searchParams.get('periodLabel') || undefined;

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const handledInitialPromptRef = useRef(null);

  const pagePrompts = useMemo(() => {
    if (!pageContext) return [];
    const base = ASSISTANT_PAGE_PROMPTS[pageContext] || [];
    if (!startDate || !endDate) return base;
    const period = periodLabel || 'this period';
    if (pageContext === 'reports' || pageContext === 'dashboard') {
      return [
        `Summarize performance for ${period}`,
        `What should I focus on for ${period}?`,
        'Compare this period to the previous period',
      ];
    }
    return base;
  }, [pageContext, startDate, endDate, periodLabel]);

  const assistantContextOptions = useMemo(() => ({
    pageContext,
    startDate,
    endDate,
    periodLabel,
  }), [pageContext, startDate, endDate, periodLabel]);

  const scrollToBottom = useCallback(() => {
    const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, []);

  const sendMessage = useCallback(async (rawText) => {
    const text = String(rawText || '').trim();
    if (!text || loading) return;

    const userMessage = { role: 'user', content: text };
    const nextConversation = [...messages, userMessage];
    setMessages(nextConversation);
    setInputValue('');
    setLoading(true);

    try {
      const res = await assistantService.chat(nextConversation, assistantContextOptions);
      const content = res?.message || 'No response from assistant.';
      setMessages((prev) => [...prev, { role: 'assistant', content }]);
      requestAnimationFrame(scrollToBottom);
    } catch (err) {
      showError(err, 'Failed to get AI response');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }, [assistantContextOptions, loading, messages, scrollToBottom]);

  useEffect(() => {
    if (!initialPrompt || handledInitialPromptRef.current === initialPrompt) return;
    handledInitialPromptRef.current = initialPrompt;
    sendMessage(initialPrompt);
  }, [initialPrompt, sendMessage]);

  const emptyState = messages.length === 0;

  const handleCopy = useCallback(async (content) => {
    try {
      await navigator.clipboard.writeText(String(content || ''));
      showSuccess('Copied to clipboard');
    } catch (err) {
      showError(err, 'Failed to copy text');
    }
  }, []);

  const handlePostToMarketing = useCallback((content) => {
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
  }, [navigate]);

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
          <CardTitle className="text-base">ABS Assistant</CardTitle>
          <CardDescription>
            Answers use your live workspace data{startDate && endDate ? ` for ${periodLabel || 'the selected period'}` : ''}. Predictions are estimates only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                  prompts={ASSISTANT_BUSINESS_PROMPTS}
                  onSelect={sendMessage}
                  loading={loading}
                />
                <PromptSection
                  title="ABS support"
                  prompts={ASSISTANT_SUPPORT_PROMPTS}
                  onSelect={sendMessage}
                  loading={loading}
                />
                <PromptSection
                  title="Draft messages"
                  prompts={ASSISTANT_DRAFT_PROMPTS}
                  onSelect={sendMessage}
                  loading={loading}
                />
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, i) => (
                  <div key={`${msg.role}-${i}`} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
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
                      </div>
                      {msg.role === 'assistant' && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => handleCopy(msg.content)}>
                            <Copy className="h-3.5 w-3.5 mr-1" />
                            Copy
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => handleExportPdf(msg.content)}>
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

          <p className="text-xs text-muted-foreground">AI predictions are estimates, not guarantees.</p>

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
