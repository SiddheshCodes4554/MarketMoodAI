import { DashboardData, NewsItem, TrendingStock } from '../types';

export const mockNews: NewsItem[] = [
  {
    title: 'RBI maintains repo rate, signals inflation easing in coming quarters',
    description: 'The central bank held rates and emphasized growth stability, lifting broader market confidence.',
    publishedAt: new Date().toISOString(),
    source: 'Economic Times',
  },
  {
    title: 'IT majors report strong deal wins from US clients despite macro uncertainty',
    description: 'Large-cap IT counters gained as guidance commentary remained resilient.',
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
    source: 'Mint',
  },
  {
    title: 'Crude oil rises on geopolitical tensions, pressuring transport and paint stocks',
    description: 'Higher input costs triggered selling in fuel-sensitive sectors.',
    publishedAt: new Date(Date.now() - 7200000).toISOString(),
    source: 'Business Standard',
  },
  {
    title: 'Bank Nifty climbs as private lenders post improved asset quality',
    description: 'NPA ratio compression and stable credit growth boosted valuations.',
    publishedAt: new Date(Date.now() - 10800000).toISOString(),
    source: 'Moneycontrol',
  },
  {
    title: 'Global equities mixed ahead of US inflation print',
    description: 'Risk appetite stayed cautious in emerging markets during late session trade.',
    publishedAt: new Date(Date.now() - 14400000).toISOString(),
    source: 'Reuters',
  },
];

export const mockTrendingStocks: TrendingStock[] = [
  { symbol: 'TCS', name: 'Tata Consultancy Services', price: 4126.4, changePct: 1.3, sentimentScore: 72 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', price: 1688.1, changePct: 0.9, sentimentScore: 64 },
  { symbol: 'SUNPHARMA', name: 'Sun Pharma', price: 1512.7, changePct: -0.4, sentimentScore: 48 },
  { symbol: 'TATAMOTORS', name: 'Tata Motors', price: 937.2, changePct: -1.2, sentimentScore: 42 },
];

export const mockDashboardData: DashboardData = {
  marketSentimentIndex: 67,
  sentimentTrend: [52, 56, 60, 63, 65, 67],
  fearGreed: 61,
  sectors: [
    { sector: 'IT', score: 75 },
    { sector: 'Banking', score: 70 },
    { sector: 'Pharma', score: 58 },
    { sector: 'Auto', score: 44 },
  ],
  trendingStocks: mockTrendingStocks,
  riskAlerts: [
    'PANIC ALERT: High panic in market from negative sentiment spike.',
    'HYPE ALERT: Overhyped stock detected (TCS) after a sharp sentiment jump.',
  ],
  missedOpportunities: [
    {
      stockName: 'Infosys',
      symbol: 'INFY',
      movePercent: 5.8,
      reason: 'Momentum accelerated after strong earnings commentary and sustained buying interest.',
      lesson: 'Track volume breakouts after results to catch continuation setups earlier.',
    },
  ],
  aiSummary:
    'Markets stayed mildly bullish as rate stability from RBI and stronger banking commentary outweighed global caution. IT and financials led gains while oil-sensitive sectors lagged.',
  aiSuggestedAction:
    'Monitor sector rotation and consider staggered positioning while global risk cues remain mixed.',
  aiForYouAdvice:
    'Moderate opportunity: consider a balanced approach while waiting for stronger confirmations.',
  aiConfidence: 76,
  aiFactors: ['Sentiment consistency: 74%', '10 sources analyzed', 'Trend strength: 79%'],
};
