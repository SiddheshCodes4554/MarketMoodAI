import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { colors, radius, spacing } from '../constants/theme';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { RootStackParamList } from '../navigation/types';
import {
  POPULAR_STOCKS,
  TRENDING_SEARCHES,
} from '../services/stockExplorerService';
import { searchStocks } from '../services/stockService';
import { StockSearchResult } from '../types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const PAGE_SIZE = 10;

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const trimmed = query.trim();

  const parts = useMemo(() => {
    if (!trimmed) {
      return [text];
    }

    const regex = new RegExp(`(${escapeRegExp(trimmed)})`, 'ig');
    return text.split(regex);
  }, [text, trimmed]);

  if (!trimmed) {
    return <Text style={styles.resultName}>{text}</Text>;
  }

  return (
    <Text style={styles.resultName}>
      {parts.map((part, idx) => {
        const isMatch = part.toLowerCase() === trimmed.toLowerCase();
        return (
          <Text key={`${part}-${idx}`} style={isMatch ? styles.highlight : undefined}>
            {part}
          </Text>
        );
      })}
    </Text>
  );
}

export function StockExplorerScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim(), 500);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [page, setPage] = useState(1);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const run = async () => {
      if (!debouncedQuery) {
        setResults([]);
        setLoading(false);
        setPage(1);
        return;
      }

      setLoading(true);
      const data = await searchStocks(debouncedQuery);

      if (!isActive) {
        return;
      }

      setResults(data);
      setPage(1);
      setLastUpdatedAt(new Date().toISOString());
      setLoading(false);
    };

    run();

    return () => {
      isActive = false;
    };
  }, [debouncedQuery]);

  const visibleResults = useMemo(() => results.slice(0, page * PAGE_SIZE), [results, page]);
  const canLoadMore = visibleResults.length < results.length;

  const openDetail = (symbol: string) => {
    Haptics.selectionAsync().catch(() => {});
    navigation.navigate('StockDetail', { symbol });
  };

  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRefreshing(true);
    if (debouncedQuery) {
      const data = await searchStocks(debouncedQuery);
      setResults(data);
      setPage(1);
      setLastUpdatedAt(new Date().toISOString());
    }
    setRefreshing(false);
  };

  const hasSearch = debouncedQuery.length > 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <Text style={styles.title}>Stock Explorer</Text>
      <Text style={styles.subtitle}>Find any stock without mass API calls.</Text>
      {lastUpdatedAt ? <Text style={styles.lastUpdated}>Last updated {new Date(lastUpdatedAt).toLocaleTimeString()}</Text> : null}

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search stocks (Reliance, TCS, Tesla...)"
          placeholderTextColor={colors.textSecondary}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="characters"
          clearButtonMode="while-editing"
        />
      </View>

      <Card>
        <Text style={styles.sectionTitle}>Trending Searches</Text>
        <View style={styles.trendingRow}>
          {TRENDING_SEARCHES.map((item) => (
            <Pressable key={item} style={styles.trendingChip} onPress={() => setQuery(item)}>
              <Text style={styles.trendingChipText}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {hasSearch ? (
        <Card>
          <Text style={styles.sectionTitle}>Search Results</Text>

          {loading ? (
            <View style={styles.centeredState}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.hintText}>Searching live symbols...</Text>
            </View>
          ) : null}

          {!loading && results.length === 0 ? (
            <View style={styles.centeredState}>
              <Ionicons name="search-circle-outline" size={28} color={colors.textSecondary} />
              <Text style={styles.hintText}>No results found</Text>
              <Pressable style={styles.loadMoreButton} onPress={onRefresh}>
                <Text style={styles.loadMoreText}>Retry</Text>
              </Pressable>
            </View>
          ) : null}

          {!loading
            ? visibleResults.map((item, idx) => (
                <Pressable
                  key={`${item.symbol}-${idx}`}
                  style={[styles.resultRow, idx === visibleResults.length - 1 ? styles.resultRowLast : null]}
                  onPress={() => openDetail(item.symbol)}
                >
                  <View style={styles.resultCopy}>
                    <HighlightedText text={item.name} query={debouncedQuery} />
                    <HighlightedText text={item.symbol} query={debouncedQuery} />
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </Pressable>
              ))
            : null}

          {!loading && canLoadMore ? (
            <Pressable style={styles.loadMoreButton} onPress={() => setPage((value) => value + 1)}>
              <Text style={styles.loadMoreText}>Load more</Text>
            </Pressable>
          ) : null}
        </Card>
      ) : (
        <Card>
          <Text style={styles.sectionTitle}>Popular Stocks</Text>
          {POPULAR_STOCKS.map((item, idx) => (
            <Pressable
              key={item.symbol}
              style={[styles.resultRow, idx === POPULAR_STOCKS.length - 1 ? styles.resultRowLast : null]}
              onPress={() => openDetail(item.symbol)}
            >
              <View style={styles.resultCopy}>
                <Text style={styles.resultName}>{item.name}</Text>
                <Text style={styles.resultSymbol}>{item.symbol}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          ))}
        </Card>
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
    paddingHorizontal: spacing.xl,
    paddingBottom: 120,
    gap: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_700Bold',
    fontSize: 24,
  },
  subtitle: {
    marginTop: 2,
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
  },
  lastUpdated: {
    marginTop: -6,
    color: colors.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#D7E4F5',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    paddingVertical: 10,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  trendingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  trendingChip: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: '#EAF4FF',
  },
  trendingChipText: {
    color: colors.accent,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
  },
  centeredState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  hintText: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  resultRowLast: {
    borderBottomWidth: 0,
  },
  resultCopy: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  resultName: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
  },
  resultSymbol: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  highlight: {
    color: colors.accent,
    fontFamily: 'Poppins_700Bold',
  },
  loadMoreButton: {
    marginTop: spacing.sm,
    alignSelf: 'center',
    borderRadius: radius.md,
    backgroundColor: '#EAF4FF',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  loadMoreText: {
    color: colors.accent,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
});
