import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { Reveal } from '../components/Reveal';
import { SkeletonCard } from '../components/SkeletonCard';
import { SentimentBar } from '../components/SentimentBar';
import { colors, radius, spacing } from '../constants/theme';
import { useAppSession } from '../context/AppSessionContext';
import { RootStackParamList } from '../navigation/types';
import { getStockDetail } from '../services/stockService';
import { StockDetail } from '../types';

type StockRoute = RouteProp<RootStackParamList, 'StockDetail'>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

const chartConfig = {
  backgroundGradientFrom: '#FFFFFF',
  backgroundGradientTo: '#FFFFFF',
  color: (opacity = 1) => `rgba(46, 144, 250, ${opacity})`,
  strokeWidth: 2,
  useShadowColorFromDataset: false,
  propsForDots: {
    r: '0',
    strokeWidth: '0',
  },
  propsForBackgroundLines: {
    stroke: '#EDF2F7',
    strokeDasharray: '0',
  },
};

function headlineColor(score: number) {
  if (score >= 60) {
    return colors.positive;
  }

  if (score <= 40) {
    return colors.negative;
  }

  return colors.neutral;
}

export function StockDetailScreen() {
  const route = useRoute<StockRoute>();
  const navigation = useNavigation<NavProp>();
  const { userType } = useAppSession();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 380;
  const seed = route.params.initialStock;
  const [stock, setStock] = useState<StockDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const chartWidth = Math.max(220, width - spacing.xl * 2 - spacing.lg * 2);

  useEffect(() => {
    setError(null);
    setShowWhy(false);
    if (seed) {
      setStock({
        symbol: seed.symbol,
        name: seed.name,
        price: seed.price,
        changePct: seed.changePct,
        sentimentScore: seed.sentimentScore,
        headlines: [],
        outlook: 'Generating AI outlook from live market context...',
        suggestedAction: 'Monitor live confirmation and wait for stronger trend alignment.',
        forYouAdvice: 'Moderate setup: consider a balanced approach while waiting for stronger signals.',
        insightConfidence: 58,
        insightFactors: ['Sentiment consistency: 58%', '2 sources analyzed', 'Trend strength: 46%'],
      });
    } else {
      setStock(null);
    }

    getStockDetail(route.params.symbol, seed, userType)
      .then((data) => {
        setStock(data);
        setLastUpdatedAt(new Date().toISOString());
      })
      .catch((e) => {
        if (!seed) {
          setError(e instanceof Error ? e.message : 'Unable to load stock detail.');
          return;
        }
        setError('Live refresh is delayed. Showing latest available stock snapshot.');
      });
  }, [route.params.symbol, seed, userType, reloadNonce]);

  const trendData = useMemo(
    () => ({
      labels: ['1', '2', '3', '4', '5', 'Now'],
      datasets: [
        {
          data: stock
            ? [
                stock.price * 0.95,
                stock.price * 0.96,
                stock.price * 0.94,
                stock.price * 0.98,
                stock.price * 0.97,
                stock.price,
              ]
            : [90, 95, 91, 99, 96, 101],
        },
      ],
    }),
    [stock],
  );

  if (!stock) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}>
        {error ? (
          <Card>
            <Text style={styles.cardTitle}>Stock Fetch Failed</Text>
            <Text style={styles.outlook}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => setReloadNonce((value) => value + 1)}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </Card>
        ) : (
          <>
            <SkeletonCard lines={2} height={90} />
            <SkeletonCard lines={3} height={220} />
            <SkeletonCard lines={2} height={120} />
            <SkeletonCard lines={4} height={180} />
          </>
        )}
      </ScrollView>
    );
  }

  const isPositive = stock.changePct >= 0;
  const hasLivePrice = Number.isFinite(stock.price) && stock.price > 0;
  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRefreshing(true);
    setReloadNonce((value) => value + 1);
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <View style={styles.headerRight}>
          <Text style={[styles.headerSymbol, isCompact ? styles.headerSymbolCompact : null]}>{stock.symbol}</Text>
          <Text style={styles.headerName} numberOfLines={1}>
            {stock.name}
          </Text>
        </View>
      </View>
      {lastUpdatedAt ? <Text style={styles.lastUpdated}>Last updated {new Date(lastUpdatedAt).toLocaleTimeString()}</Text> : null}

      <Reveal delay={40}>
        <Card>
        <Text style={styles.priceLabel}>Current Price</Text>
        {hasLivePrice ? (
          <>
            <Text style={[styles.priceValue, isCompact ? styles.priceValueCompact : null]}>Rs {stock.price.toFixed(2)}</Text>
            <Text style={[styles.priceChange, { color: isPositive ? colors.positive : colors.negative }]}>
              {isPositive ? '+' : ''}
              {stock.changePct.toFixed(2)}% today
            </Text>
          </>
        ) : (
          <View style={styles.pricePendingWrap}>
            <Text style={styles.pricePendingText}>Fetching live data...</Text>
            <Pressable style={styles.retryButton} onPress={() => setReloadNonce((value) => value + 1)}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}
        </Card>
      </Reveal>

      <Reveal delay={90}>
        <Card>
        <Text style={styles.cardTitle}>Price Trend</Text>
        <LineChart
          data={trendData}
          width={chartWidth}
          height={170}
          chartConfig={chartConfig}
          bezier
          withVerticalLabels={false}
          withHorizontalLabels={false}
          withInnerLines
          withOuterLines={false}
          style={styles.chart}
        />
        </Card>
      </Reveal>

      <Reveal delay={140}>
        <Card>
        <Text style={styles.cardTitle}>Sentiment Score</Text>
        <SentimentBar value={stock.sentimentScore} />
        </Card>
      </Reveal>

      <Reveal delay={190}>
        <Card>
        <Text style={styles.cardTitle}>Related Headlines</Text>
        {stock.headlines.length ? (
          stock.headlines.map((item, idx) => (
            <View key={`${item.title}-${idx}`} style={[styles.newsRow, idx === stock.headlines.length - 1 ? styles.newsRowLast : null]}>
              <Text style={styles.newsTitle}>{item.title}</Text>
              <Text style={[styles.newsTag, { color: headlineColor(item.sentimentScore) }]}>
                {item.sentiment} ({item.sentimentScore})
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.outlook}>No live related articles found for this stock right now.</Text>
        )}
        </Card>
      </Reveal>

      <Reveal delay={240}>
        <Card>
        <Text style={styles.cardTitle}>AI Outlook for this Stock</Text>
        <View style={styles.confidenceRow}>
          <Text style={styles.confidenceText}>Confidence: {stock.insightConfidence}%</Text>
          <Pressable onPress={() => setShowWhy((value) => !value)}>
            <Text style={styles.whyButton}>Why?</Text>
          </Pressable>
        </View>
        {showWhy ? (
          <View style={styles.factorsWrap}>
            {stock.insightFactors.map((factor, idx) => (
              <Text key={`${factor}-${idx}`} style={styles.factorText}>• {factor}</Text>
            ))}
          </View>
        ) : null}
        <Text style={styles.outlook}>{stock.outlook}</Text>
        <Text style={styles.suggestedActionTitle}>Suggested Action</Text>
        <Text style={styles.outlook}>{stock.suggestedAction}</Text>
        <Text style={styles.suggestedActionTitle}>For You</Text>
        <Text style={styles.outlook}>{stock.forYouAdvice}</Text>
        <Text style={styles.educationalNote}>This is an AI-generated insight for educational purposes.</Text>
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
    paddingHorizontal: spacing.xl,
    paddingBottom: 120,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  backButton: {
    borderRadius: radius.md,
    backgroundColor: '#EAF4FF',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  backText: {
    color: colors.accent,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  headerRight: {
    flex: 1,
  },
  headerSymbol: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_700Bold',
    fontSize: 20,
    lineHeight: 26,
  },
  headerSymbolCompact: {
    fontSize: 18,
    lineHeight: 23,
  },
  headerName: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    marginTop: 1,
  },
  lastUpdated: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    marginBottom: 2,
  },
  priceLabel: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
  },
  priceValue: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_700Bold',
    fontSize: 30,
    marginTop: spacing.xs,
  },
  priceValueCompact: {
    fontSize: 26,
  },
  priceChange: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    marginTop: 2,
  },
  pricePendingWrap: {
    marginTop: spacing.sm,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  pricePendingText: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
  },
  retryButton: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#CFE5FF',
    backgroundColor: '#EAF4FF',
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  retryButtonText: {
    color: colors.accent,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  chart: {
    borderRadius: 16,
  },
  newsRow: {
    paddingVertical: spacing.sm,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 2,
  },
  newsRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  newsTitle: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    lineHeight: 19,
  },
  newsTag: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  outlook: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 20,
  },
  suggestedActionTitle: {
    marginTop: spacing.sm,
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    marginBottom: 2,
  },
  confidenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    marginBottom: spacing.sm,
    gap: 2,
  },
  factorText: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  educationalNote: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    lineHeight: 16,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
