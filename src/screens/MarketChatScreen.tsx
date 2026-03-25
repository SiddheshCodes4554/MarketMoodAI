import React, { useEffect, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { FLOATING_TAB_BAR_HEIGHT } from '../components/FloatingTabBar';
import { Reveal } from '../components/Reveal';
import { colors, spacing } from '../constants/theme';
import { useAppSession } from '../context/AppSessionContext';
import { generateChatReply } from '../services/aiService';
import { getChatExplainabilityContext } from '../services/marketService';
import { ChatMessage } from '../types';

const prompts = [
  'Why is Nifty falling?',
  'Is banking sector good now?',
  'Should I invest in IT sector?',
  'How to handle volatile market weeks?',
  'What if crude rises again?',
  'Is this market panic or correction?',
];

function renderAssistantText(content: string) {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return <Text style={styles.messageText}>{content}</Text>;
  }

  return lines.map((line, idx) => {
    const isBullet = line.startsWith('- ') || line.startsWith('* ');
    const clean = isBullet ? line.slice(2).trim() : line;
    const isSuggestedAction = /^suggested action\s*:/i.test(clean);

    return (
      <Text
        key={`${line}-${idx}`}
        style={isSuggestedAction ? styles.suggestedActionText : isBullet ? styles.messageBullet : styles.messageText}
      >
        {isBullet ? `• ${clean}` : clean}
      </Text>
    );
  });
}

export function MarketChatScreen() {
  const insets = useSafeAreaInsets();
  const { userType } = useAppSession();
  const { width } = useWindowDimensions();
  const isCompact = width < 380;
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Ask anything about market mood, sectors, or sentiment.',
      createdAt: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [typingFrame, setTypingFrame] = useState(1);
  const [chatContext, setChatContext] = useState<{ sentimentConsistency: number; sourceCount: number; trendStrength: number } | null>(null);
  const [whyOpenByMessageId, setWhyOpenByMessageId] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const bottomInputPadding = Math.max(spacing.lg, insets.bottom + FLOATING_TAB_BAR_HEIGHT + spacing.md);

  useEffect(() => {
    getChatExplainabilityContext().then(setChatContext).catch(() => {
      setChatContext({ sentimentConsistency: 52, sourceCount: 3, trendStrength: 40 });
    });
  }, []);

  useEffect(() => {
    if (!loading) {
      setTypingFrame(1);
      return;
    }

    const timer = setInterval(() => {
      setTypingFrame((current) => (current >= 3 ? 1 : current + 1));
    }, 350);

    return () => clearInterval(timer);
  }, [loading]);

  const visibleMessages = useMemo(() => {
    if (!loading) {
      return messages;
    }

    const typingMessage: ChatMessage = {
      id: 'typing-indicator',
      role: 'assistant',
      content: `Thinking${'.'.repeat(typingFrame)}`,
      createdAt: new Date().toISOString(),
    };

    return [typingMessage, ...messages];
  }, [loading, messages, typingFrame]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [userMessage, ...current]);
    setInput('');
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      const reply = await generateChatReply(content, chatContext ?? undefined, userType);

      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: `${reply.insight}\nSuggested Action: ${reply.suggestedAction}`,
        createdAt: new Date().toISOString(),
        confidence: reply.confidence,
        factors: reply.factors,
      };

      setMessages((current) => [assistantMessage, ...current]);
      setLastUpdatedAt(new Date().toISOString());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.selectionAsync().catch(() => {});
    try {
      const context = await getChatExplainabilityContext();
      setChatContext(context);
      setLastUpdatedAt(new Date().toISOString());
    } catch {
      // Keep previous context if refresh fails.
    }
    setRefreshing(false);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
    >
      <View style={styles.header}>
        <Text style={[styles.title, isCompact ? styles.titleCompact : null]}>AI Market Chat</Text>
        <Text style={styles.subtitle}>Your market-focused ChatGPT assistant</Text>
        <Text style={styles.liveBadge}>Live model: Groq Llama 3.1 8B</Text>
        {lastUpdatedAt ? <Text style={styles.lastUpdated}>Last updated {new Date(lastUpdatedAt).toLocaleTimeString()}</Text> : null}
      </View>

      <Reveal delay={75}>
        <View style={styles.promptSection}>
          <View style={styles.promptTitleRow}>
            <Text style={styles.promptTitle}>Quick Prompts</Text>
            <Text style={styles.promptHint}>Slide</Text>
          </View>
          <FlatList
            data={prompts}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.promptSliderContent}
            renderItem={({ item }) => (
              <Pressable style={styles.promptChip} onPress={() => sendMessage(item)}>
                <Text style={styles.promptText}>{item}</Text>
              </Pressable>
            )}
          />
        </View>
      </Reveal>

      <FlatList
        style={styles.messagesWrap}
        contentContainerStyle={styles.messagesContent}
        data={visibleMessages}
        inverted
        refreshing={refreshing}
        onRefresh={onRefresh}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card style={[styles.messageCard, item.role === 'user' ? styles.userBubble : undefined]}>
            <Text style={styles.messageRole}>{item.role === 'user' ? 'You' : 'AI'}</Text>
            {item.role === 'user' ? (
              <Text style={styles.messageText}>{item.content}</Text>
            ) : (
              <View style={styles.assistantWrap}>
                {typeof item.confidence === 'number' ? (
                  <View style={styles.confidenceRow}>
                    <Text style={styles.confidenceText}>Confidence: {item.confidence}%</Text>
                    <Pressable onPress={() => setWhyOpenByMessageId((current) => ({ ...current, [item.id]: !current[item.id] }))}>
                      <Text style={styles.whyButton}>Why?</Text>
                    </Pressable>
                  </View>
                ) : null}
                {whyOpenByMessageId[item.id] && item.factors?.length ? (
                  <View style={styles.factorsWrap}>
                    {item.factors.map((factor, idx) => (
                      <Text key={`${factor}-${idx}`} style={styles.factorText}>• {factor}</Text>
                    ))}
                  </View>
                ) : null}
                {renderAssistantText(item.content)}
                <Text style={styles.educationalNote}>This is an AI-generated insight for educational purposes.</Text>
              </View>
            )}
          </Card>
        )}
      />

      <View style={[styles.inputRow, { paddingBottom: bottomInputPadding }]}>
        <TextInput
          style={styles.input}
          placeholder="Ask about market trend..."
          placeholderTextColor={colors.textSecondary}
          value={input}
          onChangeText={setInput}
          editable={!loading}
          returnKeyType="send"
          onSubmitEditing={() => sendMessage(input)}
        />
        <Pressable
          style={[styles.sendButton, (loading || !input.trim()) && styles.sendButtonDisabled]}
          onPress={() => sendMessage(input)}
          disabled={loading || !input.trim()}
        >
          <Text style={styles.sendText}>{loading ? '...' : 'Send'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_700Bold',
    fontSize: 24,
  },
  titleCompact: {
    fontSize: 21,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    marginTop: 2,
  },
  liveBadge: {
    marginTop: spacing.xs,
    color: colors.accent,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
  },
  lastUpdated: {
    marginTop: 2,
    color: colors.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
  },
  promptRow: {
    flexDirection: 'row',
  },
  promptSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  promptTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  promptTitle: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
  },
  promptHint: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
  },
  promptSliderContent: {
    paddingRight: spacing.lg,
    gap: spacing.sm,
  },
  promptChip: {
    backgroundColor: '#EAF4FF',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderColor: colors.border,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: 'center',
    maxWidth: 250,
  },
  promptText: {
    color: colors.accent,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
  },
  messagesWrap: {
    flex: 1,
    marginTop: spacing.sm,
  },
  messagesContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  messageCard: {
    paddingVertical: spacing.md,
    width: '92%',
  },
  userBubble: {
    backgroundColor: '#EAF4FF',
    alignSelf: 'flex-end',
    borderColor: '#CFE5FF',
  },
  messageRole: {
    color: colors.accent,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  messageText: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    lineHeight: 21,
    marginBottom: spacing.xs,
  },
  messageBullet: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    lineHeight: 21,
    marginBottom: spacing.xs,
  },
  assistantWrap: {
    gap: 0,
  },
  suggestedActionText: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    lineHeight: 21,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  confidenceText: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  whyButton: {
    color: colors.accent,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  factorsWrap: {
    marginBottom: spacing.xs,
    gap: 2,
  },
  factorText: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  educationalNote: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    lineHeight: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 46,
    fontFamily: 'Poppins_400Regular',
  },
  sendButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  sendText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_600SemiBold',
  },
});
