import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import assistantService from '@/services/assistantService';
import { showError } from '@/utils/toast';
import { cn } from '@/lib/utils';

const SUGGESTED_PROMPTS = [
  'How many customers do I have this month?',
  'Predict next month sales',
  'Summarize this month\'s performance',
];

/**
 * AssistantChatPanel - Slide-over chat panel for the AI business assistant.
 * Uses Sheet (right), message list, input, and suggested prompts.
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

  const handleSend = useCallback(async (text) => {
    const trimmed = (text || inputValue).trim();
    if (!trimmed || loading) return;

    const userMessage = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      const conversation = [...messages, userMessage];
      const { message: assistantContent } = await assistantService.chat(conversation);
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        showOverlay={false}
        className={cn(
          'flex flex-col w-full sm:max-w-md p-0 gap-0 border-l border-gray-200',
          'shadow-none'
        )}
      >
        <SheetHeader className="px-4 py-3 border-b border-gray-200">
          <SheetTitle className="text-base font-semibold">AI Assistant</SheetTitle>
        </SheetHeader>

        <ScrollArea
          ref={scrollRef}
          className="flex-1 min-h-0 px-4 py-3"
        >
          {messages.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                Ask about your business data (customers, revenue, sales) or request a summary or prediction.
              </p>
              <p className="text-xs text-gray-400">Suggested questions:</p>
              <ul className="space-y-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <li key={prompt}>
                    <button
                      type="button"
                      onClick={() => handleSuggestionClick(prompt)}
                      disabled={loading}
                      className={cn(
                        'text-left text-sm w-full px-3 py-2 rounded-lg border border-gray-200',
                        'bg-gray-50 hover:bg-gray-100 text-gray-700',
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
                        ? 'bg-[#166534] text-white'
                        : 'bg-gray-100 text-gray-900 border border-gray-200'
                    )}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-lg px-3 py-2 bg-gray-100 border border-gray-200 flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking…
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="px-4 py-3 border-t border-gray-200 space-y-2">
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
              className="bg-[#166534] hover:bg-[#14502a]"
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
