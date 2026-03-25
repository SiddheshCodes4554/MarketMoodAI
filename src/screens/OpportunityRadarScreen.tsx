import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { Reveal } from '../components/Reveal';
import { SkeletonCard } from '../components/SkeletonCard';
import { colors, radius, spacing } from '../constants/theme';
import { useAppSession } from '../context/AppSessionContext';
import { getOpportunityRadarData } from '../services/stockService';
import { OpportunityItem, OpportunitySignalType } from '../types';

const CACHE_KEY = 'opportunityRadarCache';
type OpportunityFilter = 'All' | OpportunitySignalType;
const FILTERS: OpportunityFilter[] = ['All', 'Bullish', 'Bearish', 'Watchlist'];

type RadarCache = {
  items: OpportunityItem[];
  cachedAt: string;
};

function signalColor(type: OpportunitySignalType) {
  if (type === 'Bullish') {
    return colors.positive;
  }
  if (type === 'Bearish') {
    return colors.negative;
  }
  return colors.neutral;
}

function strengthColor(strength: 'Weak' | 'Moderate' | 'Strong') {
  if (strength === 'Strong') {
    return colors.positive;
  }

  if (strength === 'Moderate') {
    return '#B78103';
  }

  return colors.negative;
}

export function OpportunityRadarScreen() {
  const insets = useSafeAreaInsets();
  const { userType } = useAppSession();
  const [items, setItems] = useState<OpportunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<OpportunityFilter>('All');
  const [whyOpenBySymbol, setWhyOpenBySymbol] = useState<Record<string, boolean>>({});
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const loadRadar = useCallback(async () => {
    try {
      const live = await getOpportunityRadarData(userType);
      if (!live.length) {
        throw new Error('No opportunity signals from live feeds right now.');
      }

      setItems(live);
      setNotice(null);
      setLastUpdatedAt(new Date().toISOString());
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          items: live,
          cachedAt: new Date().toISOString(),
        } satisfies RadarCache),
      );
    } catch {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as RadarCache;
          if (parsed?.items?.length) {
            setItems(parsed.items);
            setNotice('Live radar is delayed. Showing last saved opportunities.');
            return;
          }
        } catch {
          // Ignore parse failure and show generic fallback.
        }
      }

      setItems([]);
      setNotice('Updating market data...');
    }
  }, [userType]);

  useEffect(() => {
    setLoading(true);
    loadRadar().finally(() => setLoading(false));
  }, [loadRadar]);

  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setRefreshing(true);
    await loadRadar();
    setRefreshing(false);
  };

  const visibleItems = activeFilter === 'All' ? items : items.filter((item) => item.signalType === activeFilter);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Opportunity Radar</Text>
      <Text style={styles.subtitle}>Actionable opportunities from sentiment, trend, momentum, and buzz</Text>
      {lastUpdatedAt ? <Text style={styles.lastUpdated}>Last updated {new Date(lastUpdatedAt).toLocaleTimeString()}</Text> : null}

      <View style={styles.filterRow}>
        {FILTERS.map((filter) => {
          const selected = filter === activeFilter;
          return (
            <Pressable
              key={filter}
              style={[styles.filterChip, selected ? styles.filterChipActive : null]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActiveFilter(filter);
              }}
            >
              <Text style={[styles.filterText, selected ? styles.filterTextActive : null]}>{filter}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <>
          <SkeletonCard lines={3} height={145} />
          <SkeletonCard lines={3} height={145} />
          <SkeletonCard lines={3} height={145} />
        </>
      ) : null}

      {!loading && !visibleItems.length ? (
        <Card>
          <Ionicons name="scan-circle-outline" size={26} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>Opportunity Radar is warming up</Text>
          <Text style={styles.emptyText}>
            {items.length
              ? `No ${activeFilter.toLowerCase()} opportunities detected right now.`
              : notice ?? 'Updating market data...'}
          </Text>
          <Pressable style={styles.retryBtn} onPress={onRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </Card>
      ) : null}

      {!loading
        ? visibleItems.map((item, idx) => (
            <Reveal key={`${item.symbol}-${idx}`} delay={idx * 40}>
              <Card style={[styles.signalCard, { borderColor: `${signalColor(item.signalType)}88` }]}>
                <View style={styles.rowBetween}>
                  <View style={styles.nameBlock}>
                    <Text style={styles.stockName}>{item.stockName}</Text>
                    <Text style={styles.stockSymbol}>{item.symbol}</Text>
                  </View>
                  <View style={[styles.signalPill, { borderColor: `${signalColor(item.signalType)}66`, backgroundColor: `${signalColor(item.signalType)}14` }]}>
                    <Ionicons
                      name={item.signalType === 'Bullish' ? 'trending-up' : item.signalType === 'Bearish' ? 'trending-down' : 'eye-outline'}
                      size={14}
                      color={signalColor(item.signalType)}
                    />
                    <Text style={[styles.signalText, { color: signalColor(item.signalType) }]}>{item.signalType}</Text>
                  </View>
                </View>

                <View style={styles.rowBetween}>
                  <Text style={styles.confidenceLabel}>Confidence</Text>
                  <View style={styles.confidenceRight}>
                    <Text style={[styles.confidenceValue, { color: signalColor(item.signalType) }]}>{item.confidence}%</Text>
                    <Pressable onPress={() => setWhyOpenBySymbol((current) => ({ ...current, [item.symbol]: !current[item.symbol] }))}>
                      <Text style={styles.whyButton}>Why?</Text>
                    </Pressable>
                  </View>
                </View>

                {whyOpenBySymbol[item.symbol] && item.factors?.length ? (
                  <View style={styles.factorsWrap}>
                    {item.factors.map((factor, factorIdx) => (
                      <Text key={`${item.symbol}-${factor}-${factorIdx}`} style={styles.factorText}>• {factor}</Text>
                    ))}
                  </View>
                ) : null}

                <Text style={styles.explanation}>{item.explanation}</Text>

                <Text style={styles.signalStrengthTitle}>Signal Strength</Text>
                <View style={styles.strengthMeterTrack}>
                  <View
                    style={[
                      styles.strengthMeterFill,
                      {
                        width:
                          item.signalStrength === 'Strong'
                            ? '92%'
                            : item.signalStrength === 'Moderate'
                              ? '62%'
                              : '35%',
                        backgroundColor: strengthColor(item.signalStrength),
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.signalStrengthValue, { color: strengthColor(item.signalStrength) }]}>{item.signalStrength}</Text>

                <Text style={styles.whyMattersTitle}>Why This Matters</Text>
                <Text style={styles.whyMattersText}>{item.whyThisMatters}</Text>

                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>Sentiment {item.sentimentAvg}</Text>
                  <Text style={styles.metaText}>Trend {item.sentimentTrend}</Text>
                  <Text style={styles.metaText}>Buzz {item.buzz}</Text>
                </View>

                <Text style={styles.actionTitle}>Suggested Action</Text>
                <Text style={styles.actionText}>{item.suggestedAction}</Text>
                <Text style={styles.actionTitle}>For You</Text>
                <Text style={styles.actionText}>{item.forYouAdvice}</Text>
                <Text style={styles.educationalNote}>This is an AI-generated insight for educational purposes.</Text>
              </Card>
            </Reveal>
          ))
        : null}

      {notice && items.length ? <Text style={styles.noticeText}>{notice}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 120,
    gap: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_700Bold',
    fontSize: 26,
    lineHeight: 32,
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
    marginTop: 2,
  },
  signalCard: {
    borderWidth: 1.2,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: {
    borderColor: '#CFE5FF',
    backgroundColor: '#EAF4FF',
  },
  filterText: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
  },
  filterTextActive: {
    color: colors.accent,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stockName: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
  },
  nameBlock: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  stockSymbol: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    marginTop: 2,
  },
  signalPill: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  signalText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  confidenceLabel: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
  },
  confidenceValue: {
    marginTop: spacing.sm,
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
  },
  confidenceRight: {
    marginTop: spacing.sm,
    alignItems: 'flex-end',
    gap: 2,
  },
  whyButton: {
    color: colors.accent,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  factorsWrap: {
    marginTop: spacing.xs,
    gap: 2,
  },
  factorText: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  explanation: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 20,
  },
  signalStrengthTitle: {
    marginTop: spacing.sm,
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  strengthMeterTrack: {
    marginTop: 6,
    height: 8,
    borderRadius: 99,
    backgroundColor: '#EDF2F7',
    overflow: 'hidden',
  },
  strengthMeterFill: {
    height: '100%',
    borderRadius: 99,
  },
  signalStrengthValue: {
    marginTop: 4,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  whyMattersTitle: {
    marginTop: spacing.sm,
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  whyMattersText: {
    marginTop: 2,
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 20,
  },
  metaRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  metaText: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.cardAlt,
  },
  actionTitle: {
    marginTop: spacing.sm,
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  actionText: {
    marginTop: 2,
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 20,
  },
  educationalNote: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    lineHeight: 16,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
  },
  emptyText: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  noticeText: {
    color: '#9A6700',
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
  },
});
