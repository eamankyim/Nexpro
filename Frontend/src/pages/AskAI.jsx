import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const CARD_BORDER = { border: '1px solid #e5e7eb' };

const STARTER_PROMPTS = [
  'How many customers do I have this month?',
  'Analyze my data and highlight key trends this month.',
  'Summarize this month performance in 5 bullets.',
  'Draft a promotional email for my customers.'
];

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

/**
 * Ask AI page for workspace managers.
 */
export default function AskAI() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

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
      const res = await assistantService.chat(nextConversation);
      const content = res?.message || 'No response from assistant.';
      setMessages((prev) => [...prev, { role: 'assistant', content }]);
      requestAnimationFrame(scrollToBottom);
    } catch (err) {
      showError(err, 'Failed to get AI response');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }, [loading, messages, scrollToBottom]);

  const emptyState = useMemo(() => messages.length === 0, [messages.length]);

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
      <h2 style="margin:0 0 12px 0;">Ask AI Response</h2>
      <p style="margin:0 0 16px 0;color:#6b7280;font-size:12px;">Generated on ${new Date().toLocaleString()}</p>
      <div>${formatAssistantMessage(String(content || ''))}</div>
    `;

    document.body.appendChild(printable);
    try {
      await generatePDF(printable, {
        filename: `ask-ai-${new Date().toISOString().split('T')[0]}.pdf`,
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
          Ask AI about your business performance, trends, and recommendations.
        </p>
      </div>

      <Card style={CARD_BORDER}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Assistant</CardTitle>
          <CardDescription>Responses are based on your workspace context.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScrollArea ref={scrollRef} className="h-[55vh] rounded-md border border-border p-3">
            {emptyState ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Try one of these prompts:</p>
                <div className="flex flex-wrap gap-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <Button
                      key={prompt}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => sendMessage(prompt)}
                      disabled={loading}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
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
              placeholder="Ask about your business, reports, or draft customer email..."
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
