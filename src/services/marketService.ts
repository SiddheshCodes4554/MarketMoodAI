import {
  DashboardData,
  MissedOpportunityItem,
  NewsItem,
  NewsWithSentiment,
  OpportunityItem,
  OpportunitySignalInput,
  SectorScore,
  SignalStrength,
  StockDetail,
  TopMoverStock,
  TrendingStock,
  UserType,
} from '../types';
import { CONFIG } from '../constants/config';
import { logError } from '../utils/errorHandler';
import {
  generateMarketStory,
  generateMarketSummary,
  generateOpportunityInsight,
  generateStockOutlook,
  generateWhyMovedExplanation,
} from './ai';
import { fetchTopMovers } from './alphaVantageService';
import { getFinnhubQuote } from './stockExplorerService';
import { sentimentLabelFromScore, scoreHeadlineSentiment } from './sentiment';

const GNEWS_BASE = 'https://gnews.io/api/v4/search';
const GOOGLE_RSS =
  'https://news.google.com/rss/search?q=Indian%20stock%20market%20NSE%20BSE&hl=en-IN&gl=IN&ceid=IN:en';
const EXTRA_RSS_SOURCES = [
  'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
  'https://www.moneycontrol.com/rss/business.xml',
];

const GNEWS_KEY = CONFIG.API.GNEWS;

const TRACKED_SYMBOLS = [
  'RELIANCE.NS',
  'TCS.NS',
  'HDFCBANK.NS',
  'INFY.NS',
  'ICICIBANK.NS',
  'SBIN.NS',
  'SUNPHARMA.NS',
  'TATAMOTORS.NS',
  'BHARTIARTL.NS',
  'LT.NS',
];

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function textFromTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return decodeHtml(match?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '')?.trim() ?? '');
}

function mapNewsWithSentiment(news: NewsItem[]): NewsWithSentiment[] {
  return news.map((item) => {
    const score = scoreHeadlineSentiment(`${item.title} ${item.description}`);
    return {
      ...item,
      sentimentScore: score,
      sentiment: sentimentLabelFromScore(score),
    };
  });
}

function sanitizeNewsArticles(news: NewsItem[]): NewsItem[] {
  const financeHints = [
    'market',
    'stock',
    'nifty',
    'sensex',
    'economy',
    'rbi',
    'bank',
    'inflation',
    'shares',
    'earnings',
    'india',
  ];

  const seen = new Set<string>();

  const cleaned = news
    .filter((item) => item.title && item.title.trim().length > 10)
    .filter((item) => {
      const id = `${item.title.trim().toLowerCase()}::${item.url ?? ''}`;
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    })
    .map((item) => ({
      ...item,
      title: item.title.trim(),
      description: item.description?.trim() || item.title.trim(),
    }));

  const financeOnly = cleaned.filter((item) =>
    financeHints.some((hint) => `${item.title} ${item.description}`.toLowerCase().includes(hint)),
  );

  const selected = financeOnly.length >= 6 ? financeOnly : cleaned;

  return selected
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 20);
}

function computeMarketIndex(newsWithSentiment: NewsWithSentiment[]): number {
  if (!newsWithSentiment.length) {
    return 50;
  }

  const avg = newsWithSentiment.reduce((acc, item) => acc + item.sentimentScore, 0) / newsWithSentiment.length;
  return Math.round(avg);
}

function computeFearGreed(marketSentimentIndex: number): number {
  const adjustment = marketSentimentIndex > 55 ? 8 : -6;
  return Math.max(0, Math.min(100, marketSentimentIndex + adjustment));
}

function deriveSectorScores(newsWithSentiment: NewsWithSentiment[]): SectorScore[] {
  const sectors = [
    { key: 'IT', hints: ['it', 'software', 'tech', 'digital'] },
    { key: 'Banking', hints: ['bank', 'nbfc', 'finance', 'loan'] },
    { key: 'Pharma', hints: ['pharma', 'drug', 'health', 'medicine'] },
    { key: 'Auto', hints: ['auto', 'vehicle', 'car', 'ev', 'transport'] },
  ];

  return sectors.map((sector, idx) => {
    const matched = newsWithSentiment.filter((item) =>
      sector.hints.some((hint) => `${item.title} ${item.description}`.toLowerCase().includes(hint)),
    );

    if (!matched.length) {
      return { sector: sector.key, score: [58, 56, 52, 50][idx] };
    }

    const avg = matched.reduce((acc, item) => acc + item.sentimentScore, 0) / matched.length;
    return { sector: sector.key, score: Math.round(avg) };
  });
}

function deriveRiskAlerts(
  newsWithSentiment: NewsWithSentiment[],
  trendingStocks: TrendingStock[],
  marketSentimentIndex: number,
  fearGreed: number,
): string[] {
  const alerts: string[] = [];

  if (!newsWithSentiment.length) {
    return ['Risk engine is waiting for fresh live sentiment data.'];
  }

  const negativeCount = newsWithSentiment.filter((item) => item.sentimentScore <= 40).length;
  const negativeShare = negativeCount / newsWithSentiment.length;
  const variance =
    newsWithSentiment.reduce((acc, item) => acc + (item.sentimentScore - marketSentimentIndex) ** 2, 0) /
    newsWithSentiment.length;
  const sentimentSpike = Math.sqrt(variance);

  if ((negativeShare >= 0.55 && fearGreed <= 40) || (marketSentimentIndex <= 42 && sentimentSpike >= 16)) {
    alerts.push('PANIC ALERT: High panic in market from negative sentiment spike.');
  }

  const overhyped = trendingStocks.find(
    (stock) => stock.sentimentScore >= 78 && stock.changePct >= 2.8 && stock.sentimentScore - marketSentimentIndex >= 18,
  );

  if (overhyped) {
    alerts.push(`HYPE ALERT: Overhyped stock detected (${overhyped.symbol}) after a sharp sentiment jump.`);
  }

  if (!alerts.length && sentimentSpike >= 14) {
    alerts.push('VOLATILITY ALERT: Sentiment is swinging sharply across headlines.');
  }

  if (!alerts.length) {
    alerts.push('No major sentiment spike detected right now.');
  }

  return alerts;
}

function deriveSentimentTrend(newsWithSentiment: NewsWithSentiment[]): number[] {
  if (newsWithSentiment.length < 3) {
    return [];
  }

  const sorted = [...newsWithSentiment].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
  );

  const targetPoints = Math.min(6, sorted.length);
  const chunkSize = Math.ceil(sorted.length / targetPoints);
  const trend: number[] = [];

  for (let idx = 0; idx < sorted.length; idx += chunkSize) {
    const chunk = sorted.slice(idx, idx + chunkSize);
    if (!chunk.length) {
      continue;
    }

    const avg = chunk.reduce((acc, item) => acc + item.sentimentScore, 0) / chunk.length;
    trend.push(Math.round(avg));
  }

  return trend.slice(0, 6);
}

function filterFreshStoryNews(news: NewsItem[]): NewsItem[] {
  const cleaned = sanitizeNewsArticles(news);
  if (!cleaned.length) {
    return [];
  }

  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todayItems = cleaned.filter((item) => {
    const ts = new Date(item.publishedAt).getTime();
    return Number.isFinite(ts) && ts >= startOfToday.getTime() && ts <= now + 60 * 60 * 1000;
  });

  if (todayItems.length >= 4) {
    return todayItems.slice(0, 10);
  }

  // If today's feed is thin, keep only the most recent session window.
  const sorted = [...cleaned].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  const latestTs = new Date(sorted[0].publishedAt).getTime();
  const sessionWindowMs = 18 * 60 * 60 * 1000;

  const recentSession = sorted.filter((item) => {
    const ts = new Date(item.publishedAt).getTime();
    return Number.isFinite(ts) && latestTs - ts <= sessionWindowMs;
  });

  return recentSession.slice(0, 10);
}

const SYMBOL_ALIASES: Record<string, string[]> = {
  'RELIANCE.NS': ['reliance', 'ril'],
  'TCS.NS': ['tcs', 'tata consultancy'],
  'INFY.NS': ['infosys', 'infy'],
  'HDFCBANK.NS': ['hdfc bank', 'hdfcbank'],
  'ICICIBANK.NS': ['icici bank', 'icicibank'],
  AAPL: ['apple', 'aapl'],
  TSLA: ['tesla', 'tsla'],
};

function normalizeSymbolLabel(symbol: string): string {
  return symbol.replace('.NS', '');
}

function mapSignalTrend(scores: number[]): 'rising' | 'falling' | 'flat' {
  if (scores.length < 2) {
    return 'flat';
  }

  const sorted = [...scores];
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const delta = last - first;

  if (delta >= 4) {
    return 'rising';
  }
  if (delta <= -4) {
    return 'falling';
  }
  return 'flat';
}

function sentimentForStock(symbol: string, news: NewsWithSentiment[], marketAverage: number): {
  sentimentAvg: number;
  sentimentTrend: 'rising' | 'falling' | 'flat';
  buzz: number;
} {
  const aliases = SYMBOL_ALIASES[symbol] ?? [symbol.toLowerCase(), normalizeSymbolLabel(symbol).toLowerCase()];

  const related = news.filter((item) => {
    const haystack = `${item.title} ${item.description}`.toLowerCase();
    return aliases.some((alias) => haystack.includes(alias));
  });

  if (!related.length) {
    return {
      sentimentAvg: marketAverage,
      sentimentTrend: 'flat',
      buzz: 0,
    };
  }

  const chronological = [...related]
    .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())
    .map((item) => item.sentimentScore);

  const avg = Math.round(related.reduce((acc, item) => acc + item.sentimentScore, 0) / related.length);

  return {
    sentimentAvg: avg,
    sentimentTrend: mapSignalTrend(chronological),
    buzz: related.length,
  };
}

function priceTrend(changePercent: number): 'up' | 'down' | 'flat' {
  if (changePercent >= 0.8) {
    return 'up';
  }
  if (changePercent <= -0.8) {
    return 'down';
  }
  return 'flat';
}

function computeStdDev(values: number[]): number {
  if (!values.length) {
    return 0;
  }

  const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
  const variance = values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildExplainabilityMetrics(params: {
  sentimentScores: number[];
  sourceCount: number;
  trendStrength: number;
}): {
  sentimentConsistency: number;
  sourceCount: number;
  trendStrength: number;
  confidence: number;
  factors: string[];
} {
  const std = computeStdDev(params.sentimentScores);
  const sentimentConsistency = clamp(Math.round(100 - std * 4), 25, 95);
  const sourceCount = Math.max(0, params.sourceCount);
  const sourceScore = clamp(sourceCount * 8, 20, 100);
  const trendStrength = clamp(Math.round(params.trendStrength), 20, 95);
  const confidence = clamp(Math.round(sentimentConsistency * 0.45 + sourceScore * 0.3 + trendStrength * 0.25), 30, 95);

  return {
    sentimentConsistency,
    sourceCount,
    trendStrength,
    confidence,
    factors: [
      `Sentiment consistency: ${sentimentConsistency}%`,
      `${sourceCount} sources analyzed`,
      `Trend strength: ${trendStrength}%`,
    ],
  };
}

function opportunityExplainability(input: OpportunitySignalInput): { confidence: number; factors: string[] } {
  const trendStrength = Math.abs(input.changePercent) * 16 + (input.sentimentTrend === 'flat' ? 28 : 44);
  const metrics = buildExplainabilityMetrics({
    sentimentScores: [input.sentimentAvg, input.sentimentAvg + (input.sentimentTrend === 'rising' ? 6 : input.sentimentTrend === 'falling' ? -6 : 0)],
    sourceCount: Math.max(1, input.buzz),
    trendStrength,
  });

  return {
    confidence: metrics.confidence,
    factors: metrics.factors,
  };
}

function classifySignalStrength(confidence: number): SignalStrength {
  if (confidence >= 76) {
    return 'Strong';
  }

  if (confidence >= 56) {
    return 'Moderate';
  }

  return 'Weak';
}

function generateHistoricalInsight(signalType: 'Bullish' | 'Bearish' | 'Watchlist', trendStrength: number): string {
  if (signalType === 'Bullish' && trendStrength > 0.7) {
    return 'Historically, similar sentiment spikes with strong momentum and active participation often showed 5-10% upside within 3-7 trading days.';
  }

  if (signalType === 'Bullish') {
    return 'Historically, bullish setups with moderate trend strength often delivered gradual upside follow-through when sentiment remained stable.';
  }

  if (signalType === 'Bearish') {
    return 'Historically, similar bearish sentiment phases often led to downside continuation or consolidation before a clear reversal emerged.';
  }

  return 'Historically, mixed setups like this often stayed range-bound until either sentiment or momentum became directional.';
}

function stockDisplayName(symbol: string): string {
  return normalizeSymbolLabel(symbol).replace(/\.(NS|BO)$/i, '');
}

function getUserAdvice(userType: UserType, sentiment: 'bullish' | 'bearish' | 'neutral'): string {
  if (userType === 'Beginner') {
    return sentiment === 'bearish'
      ? 'Lower risk profile: avoid aggressive entries and observe until sentiment stabilizes.'
      : 'Lower risk profile: better to observe and learn the setup before taking action.';
  }

  if (userType === 'Trader') {
    return sentiment === 'bullish'
      ? 'Short-term opportunity: monitor breakout levels and momentum confirmation closely.'
      : sentiment === 'bearish'
        ? 'Short-term caution: monitor support breaks and risk controls tightly.'
        : 'Short-term setup is mixed: monitor intraday direction before committing.';
  }

  return sentiment === 'bullish'
    ? 'Moderate opportunity: consider staggered exposure while monitoring confirmation.'
    : sentiment === 'bearish'
      ? 'Moderate risk: consider a balanced approach and wait for clearer stabilization.'
      : 'Moderate setup: consider a balanced approach while waiting for stronger signals.';
}

function markAsMissedOpportunity(stock: TopMoverStock): MissedOpportunityItem {
  const bullishMove = stock.changePercent > 0;
  const magnitude = Math.abs(stock.changePercent);
  const reason = bullishMove
    ? 'Trigger: Positive sentiment burst with strong momentum participation.'
    : 'Trigger: Sharp sentiment deterioration with broad risk-off pressure.';

  const lesson = bullishMove
    ? 'Lesson: Watch early sentiment spikes and volume expansion for faster momentum entries.'
    : 'Lesson: Watch for sentiment cracks early to manage downside risk sooner.';

  return {
    stockName: stockDisplayName(stock.symbol),
    symbol: normalizeSymbolLabel(stock.symbol),
    movePercent: Number(magnitude.toFixed(2)),
    reason,
    lesson,
  };
}

function detectMissedOpportunities(stocks: TopMoverStock[]): MissedOpportunityItem[] {
  return stocks
    .filter((stock) => Math.abs(stock.changePercent) > 5)
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
    .slice(0, 4)
    .map(markAsMissedOpportunity);
}

export async function getChatExplainabilityContext(): Promise<{
  sentimentConsistency: number;
  sourceCount: number;
  trendStrength: number;
}> {
  try {
    const news = await getNewsSentiment();
    const trendSeries = deriveSentimentTrend(news);
    const trendStrength = trendSeries.length >= 2 ? Math.abs(trendSeries[trendSeries.length - 1] - trendSeries[0]) * 12 : 38;
    const metrics = buildExplainabilityMetrics({
      sentimentScores: news.map((item) => item.sentimentScore),
      sourceCount: news.length,
      trendStrength,
    });

    return {
      sentimentConsistency: metrics.sentimentConsistency,
      sourceCount: metrics.sourceCount,
      trendStrength: metrics.trendStrength,
    };
  } catch {
    return {
      sentimentConsistency: 52,
      sourceCount: 3,
      trendStrength: 40,
    };
  }
}

export async function getOpportunityRadarData(userType: UserType = 'Intermediate'): Promise<OpportunityItem[]> {
  const [news, movers] = await Promise.all([
    getNewsSentiment().catch(() => [] as NewsWithSentiment[]),
    fetchTopMovers().catch(() => null),
  ]);

  const candidates: TopMoverStock[] = movers
    ? [...movers.gainers, ...movers.losers, ...movers.mostActive].reduce<TopMoverStock[]>((acc, stock) => {
        if (!acc.find((row) => row.symbol === stock.symbol)) {
          acc.push(stock);
        }
        return acc;
      }, [])
    : [];

  if (!candidates.length) {
    return [];
  }

  const marketAverage = news.length
    ? Math.round(news.reduce((acc, item) => acc + item.sentimentScore, 0) / news.length)
    : 50;

  const insights = await Promise.all(
    candidates.map(async (stock) => {
      const signal = sentimentForStock(stock.symbol, news, marketAverage);

      const input: OpportunitySignalInput = {
        symbol: stock.symbol,
        sentimentAvg: signal.sentimentAvg,
        sentimentTrend: signal.sentimentTrend,
        buzz: signal.buzz,
        changePercent: stock.changePercent,
        priceTrend: priceTrend(stock.changePercent),
      };

      const ai = await generateOpportunityInsight(input);
      const explainability = opportunityExplainability(input);
      const blendedConfidence = Math.round((ai.confidence + explainability.confidence) / 2);
      const trendStrength = Math.max(0, Math.min(1, Math.abs(input.changePercent) / 6 + (input.sentimentTrend === 'flat' ? 0.2 : 0.35)));
      const signalStrength = classifySignalStrength(blendedConfidence);
      const whyThisMatters = generateHistoricalInsight(ai.signalType, trendStrength);

      return {
        stockName: stockDisplayName(stock.symbol),
        symbol: normalizeSymbolLabel(stock.symbol),
        signalType: ai.signalType,
        signalStrength,
        confidence: blendedConfidence,
        explanation: ai.explanation,
        whyThisMatters,
        forYouAdvice: getUserAdvice(
          userType,
          ai.signalType === 'Bullish' ? 'bullish' : ai.signalType === 'Bearish' ? 'bearish' : 'neutral',
        ),
        suggestedAction: ai.suggestedAction,
        factors: ai.factors?.length ? ai.factors : explainability.factors,
        sentimentAvg: input.sentimentAvg,
        sentimentTrend: input.sentimentTrend,
        buzz: input.buzz,
        changePercent: input.changePercent,
      } satisfies OpportunityItem;
    }),
  );

  return insights.sort((a, b) => b.confidence - a.confidence).slice(0, 6);
}

async function fetchNewsFromGNews(query = 'Indian stock market'): Promise<NewsItem[]> {
  if (!GNEWS_KEY) {
    return [];
  }

  const url = `${GNEWS_BASE}?q=${encodeURIComponent(query)}&lang=en&country=in&max=12&apikey=${GNEWS_KEY}`;
  const response = await fetch(url);

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  const articles = data?.articles ?? [];

  return Array.isArray(articles)
    ? articles.map((article: any) => ({
        title: article.title ?? 'Market update',
        description: article.description ?? 'No description available.',
        url: article.url,
        publishedAt: article.publishedAt ?? new Date().toISOString(),
        source: article?.source?.name ?? 'GNews',
      }))
    : [];
}

async function fetchNewsFromGoogleRss(query = GOOGLE_RSS): Promise<NewsItem[]> {
  try {
    const response = await fetch(query);
    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    const itemBlocks = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).map((m) => m[0]);

    return itemBlocks.slice(0, 12).map((block) => {
      const fullTitle = textFromTag(block, 'title');
      const titleParts = fullTitle.split(' - ');
      const source = titleParts.length > 1 ? titleParts[titleParts.length - 1] : 'Google News';
      const headline = titleParts.length > 1 ? titleParts.slice(0, -1).join(' - ') : fullTitle;

      return {
        title: headline,
        description: textFromTag(block, 'description') || headline,
        url: textFromTag(block, 'link'),
        publishedAt: new Date(textFromTag(block, 'pubDate') || Date.now()).toISOString(),
        source,
      };
    });
  } catch (error) {
    logError('marketService/fetchNewsFromGoogleRss', error);
    return [];
  }
}

async function fetchLiveNews(query?: string): Promise<NewsItem[]> {
  const gnews = await fetchNewsFromGNews(query ?? 'Indian stock market');
  if (gnews.length) {
    return gnews;
  }

  const rssUrl = query
    ? `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`
    : GOOGLE_RSS;

  const rss = await fetchNewsFromGoogleRss(rssUrl);
  if (rss.length) {
    return rss;
  }

  if (!query) {
    for (const source of EXTRA_RSS_SOURCES) {
      const altFeed = await fetchNewsFromGoogleRss(source);
      if (altFeed.length) {
        return altFeed;
      }
    }
  }

  return [];
}

async function fetchQuotes(symbols: string[]): Promise<Record<string, { name: string; price: number; changePct: number }>> {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(','))}`,
  );

  if (!response.ok) {
    throw new Error('Unable to fetch live stock quotes.');
  }

  const data = await response.json();
  const results = data?.quoteResponse?.result ?? [];
  const quotes: Record<string, { name: string; price: number; changePct: number }> = {};

  for (const row of results) {
    if (!row?.symbol) {
      continue;
    }

    quotes[row.symbol] = {
      name: row.longName ?? row.shortName ?? row.symbol,
      price: Number(row.regularMarketPrice ?? row.regularMarketPreviousClose ?? 0),
      changePct: Number(row.regularMarketChangePercent ?? 0),
    };
  }

  return quotes;
}

function stooqSymbolFromNse(symbol: string): string {
  const upper = symbol.trim().toUpperCase();

  if (upper.startsWith('NSE:') || upper.startsWith('BSE:')) {
    const core = upper.split(':')[1] ?? upper;
    return `${core}.IN`.toLowerCase();
  }

  if (upper.endsWith('.NS') || upper.endsWith('.BO')) {
    return upper.replace(/\.(NS|BO)$/, '.IN').toLowerCase();
  }

  return upper.toLowerCase();
}

async function fetchQuotesFromStooq(symbols: string[]): Promise<Record<string, { name: string; price: number; changePct: number }>> {
  const rows = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const stooqSymbol = stooqSymbolFromNse(symbol);
        const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbol)}&f=sd2t2ohlcv&h&e=csv`;
        const response = await fetch(url);
        if (!response.ok) {
          return null;
        }

        const text = await response.text();
        const lines = text.trim().split('\n');
        if (lines.length < 2) {
          return null;
        }

        const values = lines[1].split(',');
        const close = Number(values[6]);

        if (!Number.isFinite(close) || close <= 0) {
          return null;
        }

        return {
          symbol,
          name: symbol.replace('.NS', ''),
          price: close,
          changePct: 0,
        };
      } catch {
        return null;
      }
    }),
  );

  const mapped: Record<string, { name: string; price: number; changePct: number }> = {};
  for (const row of rows) {
    if (!row) {
      continue;
    }
    mapped[row.symbol] = {
      name: row.name,
      price: row.price,
      changePct: row.changePct,
    };
  }

  return mapped;
}

function displaySymbol(fullSymbol: string): string {
  return fullSymbol.replace(/^(NSE:|BSE:)/, '').replace(/\.(NS|BO)$/, '');
}

function buildQuoteCandidates(rawSymbol: string): string[] {
  const upper = rawSymbol.trim().toUpperCase();
  const set = new Set<string>();

  if (!upper) {
    return [];
  }

  set.add(upper);

  if (upper.startsWith('NSE:') || upper.startsWith('BSE:')) {
    const [exchange, base] = upper.split(':');
    if (base) {
      set.add(base);
      if (exchange === 'NSE') {
        set.add(`${base}.NS`);
      }
      if (exchange === 'BSE') {
        set.add(`${base}.BO`);
      }
    }
  }

  if (upper.endsWith('.NS') || upper.endsWith('.BO')) {
    set.add(upper.slice(0, -3));
  }

  if (!upper.includes('.') && !upper.includes(':')) {
    set.add(`${upper}.NS`);
  }

  return Array.from(set);
}

async function buildTrendingStocks(newsWithSentiment: NewsWithSentiment[]): Promise<TrendingStock[]> {
  let quotes: Record<string, { name: string; price: number; changePct: number }> = {};

  try {
    quotes = await fetchQuotes(TRACKED_SYMBOLS);
  } catch {
    quotes = await fetchQuotesFromStooq(TRACKED_SYMBOLS);
  }

  const avgSentiment = computeMarketIndex(newsWithSentiment);

  const stocks = TRACKED_SYMBOLS.map((symbol) => {
    const quote = quotes[symbol];
    const sentimentScore = Math.max(10, Math.min(95, Math.round(avgSentiment + (quote?.changePct ?? 0) * 2.1)));

    return {
      symbol: displaySymbol(symbol),
      name: quote?.name ?? symbol,
      price: quote?.price ?? 0,
      changePct: quote?.changePct ?? 0,
      sentimentScore,
    };
  });

  const realStocks = stocks.filter((stock) => Number.isFinite(stock.price) && stock.price > 0);
  return realStocks.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 6);
}

export async function getNewsSentiment(): Promise<NewsWithSentiment[]> {
  const rawNews = await fetchLiveNews();
  const normalizedNews = sanitizeNewsArticles(rawNews);
  return mapNewsWithSentiment(normalizedNews);
}

export async function getDashboardData(userType: UserType = 'Intermediate'): Promise<DashboardData> {
  let news: NewsWithSentiment[] = [];

  try {
    news = await getNewsSentiment();
  } catch {
    news = [];
  }

  const marketSentimentIndex = computeMarketIndex(news);
  const sentimentTrend = deriveSentimentTrend(news);
  const fearGreed = computeFearGreed(marketSentimentIndex);
  const sectors = deriveSectorScores(news);
  let trendingStocks: TrendingStock[] = [];
  let missedOpportunities: MissedOpportunityItem[] = [];

  try {
    trendingStocks = await buildTrendingStocks(news);
  } catch {
    trendingStocks = [];
  }

  try {
    const movers = await fetchTopMovers();
    const pool = movers
      ? [...movers.gainers, ...movers.losers, ...movers.mostActive].reduce<TopMoverStock[]>((acc, stock) => {
          if (!acc.find((row) => row.symbol === stock.symbol)) {
            acc.push(stock);
          }
          return acc;
        }, [])
      : [];
    missedOpportunities = detectMissedOpportunities(pool);
  } catch {
    missedOpportunities = [];
  }

  const riskAlerts = deriveRiskAlerts(news, trendingStocks, marketSentimentIndex, fearGreed);
  const trendStrength = sentimentTrend.length >= 2 ? Math.abs(sentimentTrend[sentimentTrend.length - 1] - sentimentTrend[0]) * 12 : 40;
  const explainability = buildExplainabilityMetrics({
    sentimentScores: news.map((item) => item.sentimentScore),
    sourceCount: news.length,
    trendStrength,
  });

  const summaryOutput = news.length
    ? await generateMarketSummary(news, {
        sentimentConsistency: explainability.sentimentConsistency,
        sourceCount: explainability.sourceCount,
        trendStrength: explainability.trendStrength,
      }, userType)
    : {
        analysis:
          'Live feeds are temporarily delayed. Showing the latest available market snapshot; pull to refresh in a few seconds.',
        suggestedAction: 'Monitor headline flow and wait for fresh confirmations before changing exposure.',
        confidence: explainability.confidence,
        factors: explainability.factors,
      };

  return {
    marketSentimentIndex,
    sentimentTrend,
    fearGreed,
    sectors,
    trendingStocks,
    missedOpportunities,
    riskAlerts,
    aiSummary: summaryOutput.analysis,
    aiSuggestedAction: summaryOutput.suggestedAction,
    aiForYouAdvice: getUserAdvice(
      userType,
      marketSentimentIndex >= 60 ? 'bullish' : marketSentimentIndex <= 40 ? 'bearish' : 'neutral',
    ),
    aiConfidence: summaryOutput.confidence,
    aiFactors: summaryOutput.factors,
  };
}

export async function getWhyMarketMoved(): Promise<string> {
  const news = await fetchLiveNews();
  if (!news.length) {
    throw new Error('Unable to fetch live market news for explanation right now.');
  }
  return generateWhyMovedExplanation(news);
}

export async function getMarketStory(): Promise<string> {
  const news = await fetchLiveNews();
  if (!news.length) {
    throw new Error('Unable to fetch live market news for story mode right now.');
  }

  const storyNews = filterFreshStoryNews(news);
  if (!storyNews.length) {
    throw new Error('Fresh market headlines are not available right now for story mode.');
  }

  return generateMarketStory(storyNews);
}

export async function getStockDetail(
  symbol: string,
  fallbackStock?: TrendingStock,
  userType: UserType = 'Intermediate',
): Promise<StockDetail> {
  const upperSymbol = symbol.trim().toUpperCase();
  const quoteSymbols = buildQuoteCandidates(upperSymbol);

  let quotes: Record<string, { name: string; price: number; changePct: number }> = {};

  let finnhubQuote: { symbol: string; name: string; price: number; changePct: number } | null = null;

  for (const candidate of quoteSymbols) {
    finnhubQuote = await getFinnhubQuote(candidate);
    if (finnhubQuote?.price && finnhubQuote.price > 0) {
      break;
    }
  }

  if (!finnhubQuote) {
    try {
      quotes = await fetchQuotes(quoteSymbols);
    } catch {
      quotes = await fetchQuotesFromStooq(quoteSymbols);
    }
  }

  const fallbackSymbol = quoteSymbols.find((entry) => Boolean(quotes[entry])) ?? quoteSymbols[0] ?? upperSymbol;
  const quote = finnhubQuote ?? quotes[fallbackSymbol];
  const resolvedSymbol = finnhubQuote?.symbol ?? fallbackSymbol;
  const displayNameSymbol = displaySymbol(resolvedSymbol);

  let headlines: NewsWithSentiment[] = [];

  try {
    const stockNewsRaw = await fetchLiveNews(`${displayNameSymbol} stock India`);
    const stockNews = sanitizeNewsArticles(stockNewsRaw);
    headlines = mapNewsWithSentiment(stockNews).slice(0, 5);
  } catch {
    headlines = [];
  }

  const effectivePrice = quote?.price && quote.price > 0 ? quote.price : fallbackStock?.price ?? 0;
  const effectiveChange = Number.isFinite(quote?.changePct)
    ? quote?.changePct ?? 0
    : fallbackStock?.changePct ?? 0;
  const effectiveName = quote?.name ?? fallbackStock?.name ?? displayNameSymbol;

  const sentimentScore = headlines.length
    ? Math.round(headlines.reduce((acc, item) => acc + item.sentimentScore, 0) / headlines.length)
    : fallbackStock?.sentimentScore ?? Math.round(50 + effectiveChange * 2);

  const safeSentiment = Number.isFinite(sentimentScore) ? sentimentScore : 50;
  const stockMetrics = buildExplainabilityMetrics({
    sentimentScores: headlines.map((item) => item.sentimentScore),
    sourceCount: headlines.length,
    trendStrength: Math.abs(effectiveChange) * 16 + (headlines.length >= 3 ? 18 : 8),
  });

  let outlook = 'Live AI outlook is briefly delayed. The latest market snapshot is shown.';
  let suggestedAction = 'Monitor this stock and wait for clearer trend confirmation before adjusting exposure.';
  let insightConfidence = stockMetrics.confidence;
  let insightFactors = stockMetrics.factors;
  try {
    const stockOutput = await generateStockOutlook(displayNameSymbol, safeSentiment, {
      sentimentConsistency: stockMetrics.sentimentConsistency,
      sourceCount: stockMetrics.sourceCount,
      trendStrength: stockMetrics.trendStrength,
    }, userType);
    outlook = stockOutput.analysis;
    suggestedAction = stockOutput.suggestedAction;
    insightConfidence = stockOutput.confidence;
    insightFactors = stockOutput.factors;
  } catch {
    outlook = `Stock shows ${safeSentiment >= 55 ? 'positive' : safeSentiment <= 45 ? 'negative' : 'neutral'} momentum based on latest available market signals.`;
    suggestedAction = 'Watch for stronger confirmation from sentiment and momentum before making changes.';
    insightConfidence = stockMetrics.confidence;
    insightFactors = stockMetrics.factors;
  }

  return {
    symbol: displayNameSymbol,
    name: effectiveName || displayNameSymbol,
    price: effectivePrice,
    changePct: effectiveChange,
    sentimentScore: Math.max(5, Math.min(95, safeSentiment)),
    headlines,
    outlook,
    suggestedAction,
    forYouAdvice: getUserAdvice(userType, safeSentiment >= 58 ? 'bullish' : safeSentiment <= 42 ? 'bearish' : 'neutral'),
    insightConfidence,
    insightFactors,
  };
}
