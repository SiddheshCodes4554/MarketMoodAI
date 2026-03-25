import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { Reveal } from '../components/Reveal';
import { SkeletonCard } from '../components/SkeletonCard';
import { colors, spacing } from '../constants/theme';
import { getNewsSentiment } from '../services/newsService';
import { NewsWithSentiment } from '../types';

function tagColor(sentiment: NewsWithSentiment['sentiment']) {
  if (sentiment === 'Positive') {
    return colors.positive;
  }

  if (sentiment === 'Negative') {
    return colors.negative;
  }

  return colors.neutral;
}

function tagBg(sentiment: NewsWithSentiment['sentiment']) {
  if (sentiment === 'Positive') {
    return '#EAF9F0';
  }

  if (sentiment === 'Negative') {
    return '#FDECEC';
  }

  return '#FFF8E8';
}

export function NewsSentimentScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 380;
  const [news, setNews] = useState<NewsWithSentiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const positiveCount = news.filter((item) => item.sentiment === 'Positive').length;
  const negativeCount = news.filter((item) => item.sentiment === 'Negative').length;
  const neutralCount = news.filter((item) => item.sentiment === 'Neutral').length;

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await getNewsSentiment();
      setNews(data);
      setLastUpdatedAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to fetch live sentiment feed.');
      setNews([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <Text style={[styles.title, isCompact ? styles.titleCompact : null]}>News → Sentiment Engine</Text>
      <Text style={styles.subtitle}>Headline tagging using finance-aware logic</Text>
      {lastUpdatedAt ? <Text style={styles.lastUpdated}>Last updated {new Date(lastUpdatedAt).toLocaleTimeString()}</Text> : null}

      {!loading && !error ? (
        <View style={styles.summaryRow}>
          <View style={[styles.summaryChip, { backgroundColor: '#EAF9F0' }]}>
            <Text style={[styles.summaryChipText, { color: colors.positive }]}>Positive {positiveCount}</Text>
          </View>
          <View style={[styles.summaryChip, { backgroundColor: '#FDECEC' }]}>
            <Text style={[styles.summaryChipText, { color: colors.negative }]}>Negative {negativeCount}</Text>
          </View>
          <View style={[styles.summaryChip, { backgroundColor: '#FFF8E8' }]}>
            <Text style={[styles.summaryChipText, { color: colors.neutral }]}>Neutral {neutralCount}</Text>
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loaderWrap}>
          <SkeletonCard lines={3} height={140} />
          <SkeletonCard lines={3} height={140} />
          <SkeletonCard lines={3} height={140} />
        </View>
      ) : error ? (
        <Card>
          <Ionicons name="alert-circle-outline" size={26} color={colors.textSecondary} />
          <Text style={styles.headline}>Live Feed Error</Text>
          <Text style={styles.description}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </Card>
      ) : (
        news.map((item, index) => (
          <Reveal key={`${item.title}-${index}`} delay={70 + index * 45}>
            <Card>
              <Text style={styles.headline}>{item.title}</Text>
              <Text style={styles.description}>{item.description}</Text>
              <View style={styles.row}>
                <Text style={styles.meta}>{item.source}</Text>
                <View style={[styles.tagPill, { backgroundColor: tagBg(item.sentiment) }]}>
                  <Text style={[styles.tag, { color: tagColor(item.sentiment) }]}>
                    {item.sentiment} ({item.sentimentScore})
                  </Text>
                </View>
              </View>
            </Card>
          </Reveal>
        ))
      )}
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
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  summaryChip: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  summaryChipText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  loaderWrap: {
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  headline: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    marginBottom: spacing.sm,
  },
  description: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  meta: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
  },
  tag: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
  },
  tagPill: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
});
