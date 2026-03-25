import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../constants/config';
import { mockDashboardData, mockTrendingStocks } from '../constants/mockData';
import { DashboardData, OpportunityItem, StockDetail, StockSearchResult, TrendingStock, UserType } from '../types';
import { getCached, setCached } from '../utils/cache';
import { withErrorFallback } from '../utils/errorHandler';
import { getDashboardData as getLiveDashboardData, getOpportunityRadarData as getLiveOpportunityRadarData, getStockDetail as getLiveStockDetail } from './marketService';
import { searchStocks as searchLiveStocks } from './stockExplorerService';

async function isDemoMode(): Promise<boolean> {
  const mode = await AsyncStorage.getItem(CONFIG.APP.MODE_STORAGE_KEY);
  return mode === 'demo';
}

export async function searchStocks(query: string): Promise<StockSearchResult[]> {
  if (await isDemoMode()) {
    const normalized = query.trim().toLowerCase();
    return mockTrendingStocks
      .filter((item) => item.symbol.toLowerCase().includes(normalized) || item.name.toLowerCase().includes(normalized))
      .map((item) => ({ symbol: item.symbol, name: item.name }));
  }

  return searchLiveStocks(query);
}

export async function getDashboardData(userType: UserType = 'Intermediate'): Promise<DashboardData> {
  if (await isDemoMode()) {
    return mockDashboardData;
  }

  const key = `stockService:dashboard:${userType}`;
  const cached = await getCached<DashboardData>(key);
  if (cached) {
    return cached;
  }

  const live = await withErrorFallback('stockService/getDashboardData', () => getLiveDashboardData(userType), mockDashboardData);
  await setCached(key, live, CONFIG.APP.DEFAULT_CACHE_TTL_MS);
  return live;
}

export async function getStockDetail(symbol: string, fallbackStock?: TrendingStock, userType: UserType = 'Intermediate'): Promise<StockDetail> {
  if (await isDemoMode()) {
    const fallback = fallbackStock ?? mockTrendingStocks.find((item) => item.symbol === symbol) ?? mockTrendingStocks[0];
    return {
      symbol: symbol || fallback.symbol,
      name: fallback.name,
      price: fallback.price,
      changePct: fallback.changePct,
      sentimentScore: fallback.sentimentScore,
      headlines: [],
      outlook: 'Demo mode shows a stable sentiment backdrop with selective momentum.',
      suggestedAction: 'Monitor confirmation and avoid overreacting to single headlines.',
      forYouAdvice: 'Use demo mode to rehearse risk-managed entries and exits.',
      insightConfidence: 72,
      insightFactors: ['Sentiment consistency: 71%', '6 sources analyzed', 'Trend strength: 70%'],
    };
  }

  return getLiveStockDetail(symbol, fallbackStock, userType);
}

export async function getOpportunityRadarData(userType: UserType = 'Intermediate'): Promise<OpportunityItem[]> {
  if (await isDemoMode()) {
    return [
      {
        stockName: 'Infosys',
        symbol: 'INFY',
        signalType: 'Bullish',
        signalStrength: 'Moderate',
        confidence: 74,
        explanation: 'Momentum and sentiment are aligned after steady positive coverage.',
        whyThisMatters: 'Similar aligned setups often continue gradually when breadth remains healthy.',
        forYouAdvice: 'Use smaller tranches and track follow-through confirmation.',
        suggestedAction: 'Watch for confirmation above recent resistance before increasing exposure.',
        factors: ['Sentiment consistency: 73%', '5 sources analyzed', 'Trend strength: 72%'],
        sentimentAvg: 68,
        sentimentTrend: 'rising',
        buzz: 5,
        changePercent: 2.1,
      },
    ];
  }

  const key = `stockService:opportunities:${userType}`;
  const cached = await getCached<OpportunityItem[]>(key);
  if (cached?.length) {
    return cached;
  }

  const live = await withErrorFallback(
    'stockService/getOpportunityRadarData',
    () => getLiveOpportunityRadarData(userType),
    [] as OpportunityItem[],
  );
  if (live.length) {
    await setCached(key, live, CONFIG.APP.DEFAULT_CACHE_TTL_MS);
  }
  return live;
}
