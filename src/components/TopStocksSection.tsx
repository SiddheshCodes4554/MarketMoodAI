import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Card } from './Card';
import { colors, radius, spacing } from '../constants/theme';
import { fetchTopMovers, getStockServiceLastError } from '../services/alphaVantageService';
import { TopMoverStock, TopMoversData } from '../types';

type TopStocksTab = 'gainers' | 'losers' | 'mostActive';

interface TopStocksSectionProps {
  refreshToken?: number;
  onSelectStock?: (stock: TopMoverStock) => void;
}

interface CachedTopStocks {
  data: TopMoversData;
  cachedAt: string;
}

const CACHE_KEY = 'topStocks';
const CACHE_TTL_MS = 4 * 60 * 1000;
const RATE_LIMIT_COOLDOWN_MS = 65 * 1000;

const tabs: Array<{ key: TopStocksTab; label: string }> = [
  { key: 'gainers', label: 'Gainers' },
  { key: 'losers', label: 'Losers' },
  { key: 'mostActive', label: 'Most Active' },
];

function getMomentumTag(changePercent: number): string {
  if (changePercent > 2) return 'Strong Bullish';
  if (changePercent > 0) return 'Bullish';
  if (changePercent < -2) return 'Strong Bearish';
  if (changePercent < 0) return 'Bearish';
  return 'Neutral';
}

function tabRows(data: TopMoversData, tab: TopStocksTab): TopMoverStock[] {
  if (tab === 'gainers') return data.gainers;
  if (tab === 'losers') return data.losers;
  return data.mostActive;
}

function percentText(value: number): string {
  return `${value >= 0 ? '↑' : '↓'} ${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function priceText(value: number): string {
  return `Rs ${value.toFixed(2)}`;
}

function volumeText(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return `${Math.round(value)}`;
}

const StockRow = React.memo(function StockRow({ stock, onPress }: { stock: TopMoverStock; onPress?: (stock: TopMoverStock) => void }) {
  const isPositive = stock.changePercent >= 0;
  const tone = isPositive ? colors.positive : colors.negative;

  return (
    <Pressable
      style={({ pressed }) => [styles.stockRow, pressed ? styles.stockRowPressed : null]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.(stock);
      }}
    >
      <View style={styles.stockLeft}>
        <Text style={styles.stockSymbol}>{stock.symbol}</Text>
        <Text style={[styles.stockMomentum, { color: tone }]}>{getMomentumTag(stock.changePercent)}</Text>
      </View>
      <View style={styles.stockRight}>
        <Text style={styles.stockPrice}>{priceText(stock.price)}</Text>
        <Text style={[styles.stockPercent, { color: tone }]}>{percentText(stock.changePercent)}</Text>
        <Text style={styles.stockVolume}>Vol {volumeText(stock.volume)}</Text>
      </View>
    </Pressable>
  );
});

function SkeletonRows() {
  const shimmer = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.35, duration: 650, useNativeDriver: true }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  return (
    <View style={styles.skeletonWrap}>
      {[0, 1, 2].map((idx) => (
        <Animated.View key={idx} style={[styles.skeletonRow, { opacity: shimmer }]} />
      ))}
    </View>
  );
}

export function TopStocksSection({ refreshToken = 0, onSelectStock }: TopStocksSectionProps) {
  const [tab, setTab] = useState<TopStocksTab>('gainers');
  const [data, setData] = useState<TopMoversData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingCache, setUsingCache] = useState(false);
  const inFlight = useRef(false);
  const hasDataRef = useRef(false);
  const nextAllowedFetchRef = useRef(0);

  useEffect(() => {
    hasDataRef.current = Boolean(data);
  }, [data]);

  const isRateLimitError = (message: string | null) => Boolean(message && /rate limit|too many|quota|429/i.test(message));

  const readCached = async (): Promise<CachedTopStocks | null> => {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as CachedTopStocks;
      if (!parsed?.data?.fetchedAt || !parsed?.cachedAt) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  };

  const loadTopStocks = useCallback(async (mode: 'initial' | 'refresh' | 'background' = 'initial') => {
    const now = Date.now();
    if (mode !== 'refresh' && now < nextAllowedFetchRef.current) {
      return;
    }

    if (mode !== 'refresh') {
      const cached = await readCached();
      if (cached) {
        const ageMs = now - new Date(cached.cachedAt).getTime();
        if (ageMs <= CACHE_TTL_MS) {
          setData(cached.data);
          setUsingCache(false);
          setLoading(false);
          setError(null);
          return;
        }

        if (!hasDataRef.current) {
          setData(cached.data);
          setUsingCache(true);
          setLoading(false);
        }
      }
    }

    if (inFlight.current) {
      return;
    }

    inFlight.current = true;

    if (mode === 'refresh') {
      setRefreshing(true);
    } else if (!hasDataRef.current) {
      setLoading(true);
    }

    try {
      const live = await fetchTopMovers();
      if (!live || (!live.gainers.length && !live.losers.length && !live.mostActive.length)) {
        throw new Error('No live top-mover data available right now.');
      }

      nextAllowedFetchRef.current = 0;

      setData(live);
      setUsingCache(false);
      setError(null);

      const payload: CachedTopStocks = {
        data: live,
        cachedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch {
      const lastError = getStockServiceLastError();
      const limited = isRateLimitError(lastError);
      if (limited) {
        nextAllowedFetchRef.current = Date.now() + RATE_LIMIT_COOLDOWN_MS;
      }

      const cached = await readCached();
      if (cached) {
        setData(cached.data);
        setUsingCache(true);
        setError(
          limited
            ? 'Rate limit reached. Showing last saved market movers.'
            : 'Live market data unavailable. Showing last saved market movers.',
        );
      } else {
        setError(limited ? 'Rate limit reached. Please retry in a minute.' : 'Updating market data...');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    loadTopStocks('initial');
  }, [loadTopStocks, refreshToken]);

  const rows = data ? tabRows(data, tab) : [];

  return (
    <Card>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Top Trending Stocks</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            loadTopStocks('refresh');
          }}
          style={styles.refreshBtn}
        >
          {refreshing ? <ActivityIndicator size="small" color={colors.accent} /> : <Text style={styles.refreshText}>Refresh</Text>}
        </Pressable>
      </View>

      <View style={styles.tabRow}>
        {tabs.map((item) => {
          const selected = item.key === tab;
          return (
            <Pressable
              key={item.key}
              style={[styles.tabChip, selected ? styles.tabChipActive : null]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setTab(item.key);
              }}
            >
              <Text style={[styles.tabText, selected ? styles.tabTextActive : null]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading && !data ? <SkeletonRows /> : null}

      {!loading && rows.length > 0 ? (
        <View style={styles.stockList}>
          {rows.slice(0, 6).map((stock) => (
            <StockRow key={`${tab}-${stock.symbol}`} stock={stock} onPress={onSelectStock} />
          ))}
        </View>
      ) : null}

      {!loading && !rows.length ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Live market data unavailable</Text>
          <Pressable style={styles.retryButton} onPress={() => loadTopStocks('refresh')}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {(error || usingCache) && data ? <Text style={styles.noticeText}>{error ?? 'Showing cached market movers.'}</Text> : null}
      {data?.fetchedAt ? <Text style={styles.updatedText}>Updated: {new Date(data.fetchedAt).toLocaleTimeString()}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    flex: 1,
  },
  refreshBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FBFF',
  },
  refreshText: {
    color: colors.accent,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  tabChip: {
    flex: 1,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  tabChipActive: {
    backgroundColor: '#EAF4FF',
    borderColor: '#CFE5FF',
  },
  tabText: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
  },
  tabTextActive: {
    color: colors.accent,
  },
  stockList: {
    gap: spacing.xs,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.cardAlt,
    gap: spacing.sm,
  },
  stockRowPressed: {
    transform: [{ scale: 0.985 }],
  },
  stockLeft: {
    flex: 1,
  },
  stockSymbol: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
  },
  stockMomentum: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    marginTop: 2,
  },
  stockRight: {
    alignItems: 'flex-end',
  },
  stockPrice: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
  },
  stockPercent: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    marginTop: 2,
  },
  stockVolume: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    marginTop: 1,
  },
  skeletonWrap: {
    gap: spacing.xs,
  },
  skeletonRow: {
    height: 58,
    borderRadius: radius.md,
    backgroundColor: '#E7ECF3',
  },
  emptyWrap: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
  },
  retryButton: {
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
    marginTop: spacing.sm,
    color: '#9A6700',
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    lineHeight: 16,
  },
  updatedText: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
  },
});
