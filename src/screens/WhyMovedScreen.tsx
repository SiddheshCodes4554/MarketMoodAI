import React, { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { Reveal } from '../components/Reveal';
import { colors, spacing } from '../constants/theme';
import { getMarketStory } from '../services/newsService';

type StorySections = {
  headline: string;
  whatHappened: string;
  whyHappened: string;
  watchNext: string[];
};

const DEFAULT_STORY: StorySections = {
  headline: "Today's Market Story",
  whatHappened: 'Tap below to generate today\'s market story.',
  whyHappened: 'The app will analyze live headlines and explain the key market drivers in plain language.',
  watchNext: ['Track sector leadership shifts.', 'Watch global risk cues and foreign flows.'],
};

function parseStorySections(raw: string): StorySections {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  let headline = "Today's Market Story";
  let whatHappened = '';
  let whyHappened = '';
  const watchNext: string[] = [];

  for (const line of lines) {
    if (/^headline\s*:/i.test(line)) {
      headline = line.replace(/^headline\s*:/i, '').trim() || headline;
      continue;
    }

    if (/^what happened\s*:/i.test(line)) {
      whatHappened = line.replace(/^what happened\s*:/i, '').trim();
      continue;
    }

    if (/^why it happened\s*:/i.test(line)) {
      whyHappened = line.replace(/^why it happened\s*:/i, '').trim();
      continue;
    }

    if (/^what to watch next\s*:/i.test(line)) {
      continue;
    }

    if (line.startsWith('- ')) {
      watchNext.push(line.slice(2).trim());
      continue;
    }

    if (!whatHappened) {
      whatHappened = line;
    } else if (!whyHappened) {
      whyHappened = line;
    }
  }

  return {
    headline: headline || DEFAULT_STORY.headline,
    whatHappened: whatHappened || DEFAULT_STORY.whatHappened,
    whyHappened: whyHappened || DEFAULT_STORY.whyHappened,
    watchNext: watchNext.length ? watchNext.slice(0, 3) : DEFAULT_STORY.watchNext,
  };
}

export function WhyMovedScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 380;
  const [loading, setLoading] = useState(false);
  const [story, setStory] = useState<StorySections>(DEFAULT_STORY);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const onGenerate = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setLoading(true);
    try {
      const text = await getMarketStory();
      setStory(parseStorySections(text));
      setLastUpdatedAt(new Date().toISOString());
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to generate market story from live data.';
      setStory({
        ...DEFAULT_STORY,
        whatHappened: message,
      });
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await onGenerate();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <Text style={[styles.title, isCompact ? styles.titleCompact : null]}>Market Story Mode 2.0</Text>
      <Text style={styles.subtitle}>Your mini news anchor powered by live market headlines</Text>
      {lastUpdatedAt ? <Text style={styles.lastUpdated}>Last updated {new Date(lastUpdatedAt).toLocaleTimeString()}</Text> : null}

      <Reveal delay={80}>
        <Pressable style={styles.actionButton} onPress={onGenerate}>
          <Text style={styles.buttonText}>Tell today&apos;s market story</Text>
        </Pressable>
      </Reveal>

      <Reveal delay={130}>
        <Card>
          <Text style={styles.cardTitle}>Today&apos;s Market Story</Text>
          {loading ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.loaderText}>Building your mini anchor script...</Text>
            </View>
          ) : (
            <View style={styles.storyWrap}>
              <Text style={styles.headline}>{story.headline}</Text>

              <Text style={styles.sectionTitle}>What happened</Text>
              <Text style={styles.body}>{story.whatHappened}</Text>

              <Text style={styles.sectionTitle}>Why it happened</Text>
              <Text style={styles.body}>{story.whyHappened}</Text>

              <Text style={styles.sectionTitle}>What to watch next</Text>
              {story.watchNext.map((item, idx) => (
                <Text key={`${item}-${idx}`} style={styles.bullet}>• {item}</Text>
              ))}
              <Text style={styles.educationalNote}>This is an AI-generated insight for educational purposes.</Text>
            </View>
          )}
        </Card>
      </Reveal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.md,
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
  lastUpdated: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
  },
  actionButton: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    marginBottom: spacing.sm,
  },
  storyWrap: {
    gap: spacing.xs,
  },
  headline: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    lineHeight: 24,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    marginTop: spacing.xs,
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
  },
  body: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 22,
  },
  bullet: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 21,
  },
  educationalNote: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    lineHeight: 16,
  },
  loaderWrap: {
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  loaderText: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
  },
});
