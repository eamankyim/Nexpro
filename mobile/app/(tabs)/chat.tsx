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
import { ScreenShell } from '@/components/ScreenShell';
import { SHOP_TYPES } from '@/constants';
import {
  ASSISTANT_BUSINESS_PROMPTS,
  ASSISTANT_DRAFT_PROMPTS,
  ASSISTANT_PAGE_PROMPTS,
  ASSISTANT_RESTAURANT_PROMPTS,
  ASSISTANT_SUPPORT_PROMPTS,
} from '@/constants/assistantPrompts';

type Message = { id: string; role: 'user' | 'assistant'; content: string };
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
  const { colors, bg, cardBg, borderColor, textColor, mutedColor, inputBg, resolvedTheme } = useScreenColors();
  const isRestaurant = activeTenant?.metadata?.shopType === SHOP_TYPES.RESTAURANT;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const handledInitialPromptRef = useRef<string | null>(null);

  const pagePrompts = useMemo(
    () => (pageContext ? ASSISTANT_PAGE_PROMPTS[pageContext] || [] : []),
    [pageContext]
  );

  const businessPrompts = useMemo(
    () => (isRestaurant ? ASSISTANT_RESTAURANT_PROMPTS : ASSISTANT_BUSINESS_PROMPTS),
    [isRestaurant]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const text = (content || input).trim();
      if (!text) return;

      setInput('');
      const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const history: { role: 'user' | 'assistant'; content: string }[] = [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: text },
        ];
        const res = await assistantService.chat(history, { pageContext });
        const reply = res?.message || '';
        const assistantMsg: Message = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: reply || 'No response.',
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          (err as Error)?.message ??
          'Failed to get response';
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'assistant',
            content: `Sorry, I couldn't process that. ${msg}`,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, messages, pageContext]
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

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
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
            prompts={businessPrompts}
            onPress={sendMessage}
            loading={loading}
            cardBg={cardBg}
            borderColor={borderColor}
            textColor={textColor}
          />
          <PromptSection
            title="ABS support"
            prompts={ASSISTANT_SUPPORT_PROMPTS}
            onPress={sendMessage}
            loading={loading}
            cardBg={cardBg}
            borderColor={borderColor}
            textColor={textColor}
          />
          <PromptSection
            title="Draft messages"
            prompts={ASSISTANT_DRAFT_PROMPTS}
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
