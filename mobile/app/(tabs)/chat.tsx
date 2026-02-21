import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { assistantService } from '@/services/assistantService';
import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';

type Message = { id: string; role: 'user' | 'assistant'; content: string };

const QUICK_PROMPTS = [
  "Today's summary",
  'Top customers this month',
  'Revenue vs expenses',
];

export default function ChatScreen() {
  const { resolvedTheme } = useTheme();
  const colors = Colors[resolvedTheme ?? 'light'];
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      const text = (content || input).trim();
      if (!text) return;

      setInput('');
      const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      setError(null);

      try {
        const history: { role: 'user' | 'assistant'; content: string }[] = [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: text },
        ];
        const res = await assistantService.chat(history);
        // Backend returns: { success: true, message: '...' }
        const reply = res?.message || '';
        const assistantMsg: Message = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: reply || 'No response.',
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error
          ?? (err as Error)?.message
          ?? 'Failed to get response';
        setError(msg);
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
    [input, messages]
  );

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const bg = resolvedTheme === 'dark' ? colors.background : '#f9fafb';
  const cardBg = resolvedTheme === 'dark' ? '#27272a' : '#fff';
  const bubbleUser = colors.tint;
  const textColor = resolvedTheme === 'dark' ? '#fff' : '#111';
  const mutedColor = resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280';

  const renderItem = ({ item }: { item: Message }) => (
    <View style={[styles.bubbleWrap, item.role === 'user' ? styles.bubbleRight : styles.bubbleLeft]}>
      <View
        style={[
          styles.bubble,
          item.role === 'user' ? { backgroundColor: bubbleUser } : { backgroundColor: cardBg, borderWidth: 1, borderColor: '#e5e7eb' },
        ]}
      >
        <Text style={[styles.bubbleText, { color: item.role === 'user' ? '#fff' : textColor }]}>
          {item.content}
        </Text>
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
        <View style={styles.welcome}>
          <FontAwesome name="comments" size={48} color={colors.tabIconDefault} />
          <Text style={[styles.welcomeTitle, { color: textColor }]}>AI Assistant</Text>
          <Text style={[styles.welcomeSubtitle, { color: mutedColor }]}>
            Ask about your business data, revenue, or get summaries
          </Text>
          <View style={styles.quickPrompts}>
            {QUICK_PROMPTS.map((p) => (
              <Pressable
                key={p}
                onPress={() => sendMessage(p)}
                disabled={loading}
                style={[styles.quickBtn, { backgroundColor: cardBg, borderColor: '#e5e7eb' }]}
              >
                <Text style={[styles.quickBtnText, { color: textColor }]}>{p}</Text>
              </Pressable>
            ))}
          </View>
        </View>
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

      <View style={[styles.inputRow, { backgroundColor: cardBg, borderTopColor: '#e5e7eb' }]}>
        <TextInput
          style={[styles.input, { color: textColor }]}
          placeholder="Ask about your business..."
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
          style={[styles.sendBtn, { backgroundColor: colors.tint }]}
        >
          <FontAwesome name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  welcome: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  welcomeTitle: { fontSize: 20, fontWeight: '700', marginTop: 16 },
  welcomeSubtitle: { fontSize: 15, marginTop: 8, textAlign: 'center' },
  quickPrompts: { marginTop: 24, gap: 12 },
  quickBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  quickBtnText: { fontSize: 15 },
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
    backgroundColor: '#f3f4f6',
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
