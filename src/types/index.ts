export type SentimentLabel = 'Positive' | 'Negative' | 'Neutral';
export type UserType = 'Beginner' | 'Intermediate' | 'Trader';

export type ChatRole = 'user' | 'assistant';

export interface NewsItem {
  title: string;
  description: string;
  url?: string;
  publishedAt: string;
  source: string;
}

export interface NewsWithSentiment extends NewsItem {
  sentiment: SentimentLabel;
  sentimentScore: number;
}

export interface SectorScore {
  sector: string;
  score: number;
}

export interface TrendingStock {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  sentimentScore: number;
}

export interface MissedOpportunityItem {
  stockName: string;
  symbol: string;
  movePercent: number;
  reason: string;
  lesson: string;
}

export interface TopMoverStock {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

export interface TopMoversData {
  gainers: TopMoverStock[];
  losers: TopMoverStock[];
  mostActive: TopMoverStock[];
  fetchedAt: string;
}

export interface PopularStock {
  name: string;
  symbol: string;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
}

export type OpportunitySignalType = 'Bullish' | 'Bearish' | 'Watchlist';
export type SignalStrength = 'Weak' | 'Moderate' | 'Strong';

export interface OpportunitySignalInput {
  symbol: string;
  sentimentAvg: number;
  sentimentTrend: 'rising' | 'falling' | 'flat';
  buzz: number;
  changePercent: number;
  priceTrend: 'up' | 'down' | 'flat';
}

export interface OpportunityItem {
  stockName: string;
  symbol: string;
  signalType: OpportunitySignalType;
  signalStrength: SignalStrength;
  confidence: number;
  explanation: string;
  whyThisMatters: string;
  forYouAdvice: string;
  suggestedAction: string;
  factors: string[];
  sentimentAvg: number;
  sentimentTrend: 'rising' | 'falling' | 'flat';
  buzz: number;
  changePercent: number;
}

export interface DashboardData {
  marketSentimentIndex: number;
  sentimentTrend: number[];
  fearGreed: number;
  sectors: SectorScore[];
  trendingStocks: TrendingStock[];
  missedOpportunities: MissedOpportunityItem[];
  riskAlerts: string[];
  aiSummary: string;
  aiSuggestedAction: string;
  aiForYouAdvice: string;
  aiConfidence: number;
  aiFactors: string[];
}

export interface StockDetail {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  sentimentScore: number;
  headlines: NewsWithSentiment[];
  outlook: string;
  suggestedAction: string;
  forYouAdvice: string;
  insightConfidence: number;
  insightFactors: string[];
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  confidence?: number;
  factors?: string[];
}
