import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { AppIcon } from '@/components/AppIcon';
import { assistantService } from '@/services/assistantService';
import { useAuth } from '@/context/AuthContext';
import { useScreenColors } from '@/hooks/useScreenColors';
import { logger } from '@/utils/logger';
import { getAiProviderErrorMessage } from '@/utils/aiProviderErrors';
import {
  getAssistantPromptSets,
  getPagePrompts,
} from '@/constants/assistantPrompts';
import {
  ASSISTANT_PERIOD_OPTIONS,
  resolveAssistantPeriod,
  type AssistantPeriodKey,
} from '@/utils/assistantPeriod';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasons?: Array<{ code?: string; label: string; detail?: string }>;
  intent?: string;
  source?: string;
};
type TextSegment = { text: string; bold: boolean };

function parseBoldSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false });
  }

  return segments.length > 0 ? segments : [{ text, bold: false }];
}

function FormattedMessage({ content, color }: { content: string; color: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');

  return (
    <View>
      {lines.map((line, lineIndex) => {
        const trimmed = line.trim();
        const isBlank = trimmed.length === 0;
        const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
        const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
        const displayText = bulletMatch
          ? bulletMatch[1]
          : orderedMatch
            ? orderedMatch[1]
            : line;

        if (isBlank) {
          return <View key={`blank-${lineIndex}`} style={styles.messageSpacer} />;
        }

        const textNode = (
          <Text style={[styles.bubbleText, { color }]}>
            {parseBoldSegments(displayText).map((segment, segmentIndex) => (
              <Text
                key={`${lineIndex}-${segmentIndex}`}
                style={segment.bold ? styles.boldText : undefined}
              >
                {segment.text}
              </Text>
            ))}
          </Text>
        );

        if (bulletMatch || orderedMatch) {
          const prefix = orderedMatch ? `${trimmed.match(/^\d+/)?.[0]}.` : '•';
          return (
            <View key={`line-${lineIndex}`} style={styles.bulletRow}>
              <Text style={[styles.bulletDot, { color }]}>{prefix}</Text>
              <View style={styles.bulletText}>{textNode}</View>
            </View>
          );
        }

        return (
          <View key={`line-${lineIndex}`} style={styles.messageLine}>
            {textNode}
          </View>
        );
      })}
    </View>
  );
}

function PromptSection({
  title,
  prompts,
  onPress,
  loading,
  cardBg,
  borderColor,
  textColor,
}: {
  title: string;
  prompts: string[];
  onPress: (p: string) => void;
  loading: boolean;
  cardBg: string;
  borderColor: string;
  textColor: string;
}) {
  if (prompts.length === 0) return null;
  return (
    <View style={styles.promptSection}>
      <Text style={[styles.promptSectionTitle, { color: textColor }]}>{title}</Text>
      {prompts.map((p) => (
        <Pressable
          key={p}
          onPress={() => onPress(p)}
          disabled={loading}
          style={({ pressed }) => [
            styles.quickBtn,
            { backgroundColor: cardBg, borderColor },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.quickBtnText, { color: textColor }]}>{p}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function ChatScreen() {
  const params = useLocalSearchParams<{ prompt?: string; pageContext?: string }>();
  const prompt = Array.isArray(params.prompt) ? params.prompt[0] : params.prompt;
  const pageContext = Array.isArray(params.pageContext) ? params.pageContext[0] : params.pageContext;

  const { activeTenant } = useAuth();
  const { colors, bg, cardBg, borderColor, textColor, mutedColor, resolvedTheme } = useScreenColors();
  const businessType = activeTenant?.businessType || 'printing_press';
  const shopType = activeTenant?.metadata?.shopType || null;

  const [selectedPeriod, setSelectedPeriod] = useState<AssistantPeriodKey>('today');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const handledInitialPromptRef = useRef<string | null>(null);
  const lastSendAtRef = useRef(0);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const SEND_DEBOUNCE_MS = 800;

  const periodRange = useMemo(() => resolveAssistantPeriod(selectedPeriod), [selectedPeriod]);
  const promptSets = useMemo(
    () => getAssistantPromptSets({ businessType, shopType }),
    [businessType, shopType]
  );
  const pagePrompts = useMemo(
    () => getPagePrompts(pageContext, { businessType, shopType }),
    [pageContext, businessType, shopType]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const text = (content || input).trim();
      if (!text || loading) return;

      const now = Date.now();
      if (now - lastSendAtRef.current < SEND_DEBOUNCE_MS) return;
      lastSendAtRef.current = now;

      const tapAt = now;
      logger.info('Assistant', 'perf:send_tapped', { tapAt, textLength: text.length });

      setInput('');
      const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
      const nextMessages = [...messagesRef.current, userMsg];
      setMessages(nextMessages);
      setLoading(true);

      try {
        const history: { role: 'user' | 'assistant'; content: string }[] = nextMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const uiPrepMs = Date.now() - tapAt;
        logger.info('Assistant', 'perf:history_ready', { tapAt, uiPrepMs, historyCount: history.length });

        const res = await assistantService.chat(history, {
          pageContext,
          period: periodRange.period,
          startDate: periodRange.startDate,
          endDate: periodRange.endDate,
          periodLabel: periodRange.periodLabel,
          clientSubmittedAt: tapAt,
        });
        const reply = res?.message || '';
        const reasons = Array.isArray(res?.meta?.reasons) ? res.meta.reasons : undefined;
        const assistantMsg: Message = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: reply || 'No response.',
          reasons,
          intent: res?.meta?.intent,
          source: res?.meta?.source,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: unknown) {
        const responseData = (err as { response?: { data?: { error?: string; errorCode?: string; code?: string } } })
          ?.response?.data;
        const msg =
          responseData?.error ??
          (err as Error)?.message ??
          'Failed to get response';
        const errorCode = responseData?.errorCode || responseData?.code;
        const aiMessage = getAiProviderErrorMessage(err);
        const errContent = aiMessage || `Sorry, I couldn't process that. ${msg}`;
        logger.warn('Assistant', 'perf:send_failed', { tapAt, errorCode, msg: errContent });
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'assistant',
            content: errContent,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, pageContext, loading, periodRange]
  );

  const refreshLastAnalysis = useCallback(
    async (range: ReturnType<typeof resolveAssistantPeriod>) => {
      const current = messagesRef.current;
      let lastAssistantIdx = -1;
      for (let i = current.length - 1; i >= 0; i -= 1) {
        if (current[i].role === 'assistant' && (current[i].source === 'analysis_engine' || current[i].intent)) {
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

      const intent = current[lastAssistantIdx].intent;
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
        const reply = res?.message || res?.answerMarkdown || 'No response.';
        const prefix = `For **${range.periodLabel}**:\n\n`;
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: reply.startsWith('For **') ? reply : `${prefix}${reply}`,
            intent: res?.intent || intent || res?.meta?.intent,
            source: 'analysis_engine',
            reasons: Array.isArray(res?.meta?.reasons) ? res.meta.reasons : undefined,
          },
        ]);
      } catch (err: unknown) {
        const aiMessage = getAiProviderErrorMessage(err);
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'assistant',
            content: aiMessage || 'Failed to refresh for the selected period.',
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [pageContext]
  );

  const handlePeriodSelect = useCallback(
    (periodKey: AssistantPeriodKey) => {
      if (loading || periodKey === selectedPeriod) return;
      const range = resolveAssistantPeriod(periodKey);
      setSelectedPeriod(periodKey);
      if (messagesRef.current.length === 0) return;
      refreshLastAnalysis(range);
    },
    [loading, selectedPeriod, refreshLastAnalysis]
  );

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  useEffect(() => {
    if (!prompt || handledInitialPromptRef.current === prompt) return;
    handledInitialPromptRef.current = prompt;
    sendMessage(prompt);
  }, [prompt, sendMessage]);

  const handleNewChat = useCallback(() => {
    if (loading) return;
    setMessages([]);
    setInput('');
    handledInitialPromptRef.current = null;
  }, [loading]);

  const bubbleUser = colors.tint;

  const renderItem = ({ item }: { item: Message }) => (
    <View style={[styles.bubbleWrap, item.role === 'user' ? styles.bubbleRight : styles.bubbleLeft]}>
      <View
        style={[
          styles.bubble,
          item.role === 'user'
            ? { backgroundColor: bubbleUser }
            : { backgroundColor: cardBg, borderWidth: 1, borderColor },
        ]}
      >
        <FormattedMessage content={item.content} color={item.role === 'user' ? '#fff' : textColor} />
      </View>
    </View>
  );

  const periodBar = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.periodRow}
      style={[styles.periodBar, { borderBottomColor: borderColor, backgroundColor: cardBg }]}
      keyboardShouldPersistTaps="handled"
    >
      {ASSISTANT_PERIOD_OPTIONS.map((opt) => {
        const selected = selectedPeriod === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => handlePeriodSelect(opt.key)}
            disabled={loading}
            style={[
              styles.periodChip,
              {
                borderColor: selected ? colors.tint : borderColor,
                backgroundColor: selected ? colors.tint : cardBg,
                opacity: loading ? 0.5 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.periodChipText, { color: selected ? '#fff' : textColor }]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      {messages.length > 0 ? (
        <View style={[styles.toolbar, { borderBottomColor: borderColor, backgroundColor: cardBg }]}>
          <Text style={[styles.toolbarTitle, { color: textColor }]}>ABS Assistant</Text>
          <Pressable
            onPress={handleNewChat}
            disabled={loading}
            style={({ pressed }) => [
              styles.newChatBtn,
              { borderColor },
              pressed && styles.pressed,
              loading && { opacity: 0.5 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="New chat"
          >
            <AppIcon name="plus" size={16} color={colors.tint} />
            <Text style={[styles.newChatText, { color: colors.tint }]}>New chat</Text>
          </Pressable>
        </View>
      ) : null}

      {periodBar}

      {messages.length === 0 ? (
        <ScrollView contentContainerStyle={styles.welcomeScroll} keyboardShouldPersistTaps="handled">
          <AppIcon name="brain" size={48} color={colors.tabIconDefault} />
          <Text style={[styles.welcomeTitle, { color: textColor }]}>ABS Assistant</Text>
          <Text style={[styles.welcomeSubtitle, { color: mutedColor }]}>
            Business insights, ABS support, and message drafts using your workspace data.
          </Text>
          <PromptSection
            title="For this screen"
            prompts={pagePrompts}
            onPress={sendMessage}
            loading={loading}
            cardBg={cardBg}
            borderColor={borderColor}
            textColor={textColor}
          />
          <PromptSection
            title="Business insights"
            prompts={promptSets.business}
            onPress={sendMessage}
            loading={loading}
            cardBg={cardBg}
            borderColor={borderColor}
            textColor={textColor}
          />
          <PromptSection
            title="ABS support"
            prompts={promptSets.support}
            onPress={sendMessage}
            loading={loading}
            cardBg={cardBg}
            borderColor={borderColor}
            textColor={textColor}
          />
          <PromptSection
            title="Draft messages"
            prompts={promptSets.draft}
            onPress={sendMessage}
            loading={loading}
            cardBg={cardBg}
            borderColor={borderColor}
            textColor={textColor}
          />
        </ScrollView>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListFooterComponent={
            loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={colors.tint} />
                <Text style={[styles.loadingText, { color: mutedColor }]}>Thinking...</Text>
              </View>
            ) : null
          }
        />
      )}

      <View style={[styles.inputRow, { backgroundColor: cardBg, borderTopColor: borderColor }]}>
        <TextInput
          style={[styles.input, { color: textColor, backgroundColor: resolvedTheme === 'dark' ? '#3f3f46' : '#f3f4f6' }]}
          placeholder="Ask ABS Assistant..."
          placeholderTextColor={mutedColor}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => sendMessage(input)}
          editable={!loading}
          multiline
          maxLength={500}
        />
        <Pressable
          onPress={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          style={[styles.sendBtn, { backgroundColor: colors.tint, opacity: loading || !input.trim() ? 0.5 : 1 }]}
        >
          <AppIcon name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  toolbarTitle: { fontSize: 16, fontWeight: '600' },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  newChatText: { fontSize: 14, fontWeight: '600' },
  periodBar: {
    borderBottomWidth: 1,
    maxHeight: 52,
  },
  periodRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    alignItems: 'center',
  },
  periodChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  periodChipText: { fontSize: 13, fontWeight: '600' },
  welcomeScroll: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 24,
    paddingBottom: 32,
  },
  welcomeTitle: { fontSize: 20, fontWeight: '700', marginTop: 16 },
  welcomeSubtitle: { fontSize: 15, marginTop: 8, textAlign: 'center', lineHeight: 22 },
  promptSection: { width: '100%', marginTop: 20, gap: 8 },
  promptSectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  quickBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickBtnText: { fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.8 },
  list: { padding: 16, paddingBottom: 16 },
  bubbleWrap: { marginBottom: 12 },
  bubbleLeft: { alignItems: 'flex-start' },
  bubbleRight: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 16,
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  boldText: { fontWeight: '700' },
  messageLine: { marginBottom: 4 },
  messageSpacer: { height: 8 },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  bulletDot: {
    fontSize: 15,
    lineHeight: 22,
    minWidth: 18,
  },
  bulletText: {
    flex: 1,
    minWidth: 0,
  },
  loadingWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  loadingText: { fontSize: 14 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    fontSize: 16,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
