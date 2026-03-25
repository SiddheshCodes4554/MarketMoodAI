import { TopMoverStock, TopMoversData } from '../types';
import { CONFIG } from '../constants/config';
import { logError } from '../utils/errorHandler';

const FINNHUB_API_KEY = CONFIG.API.FINNHUB;
const TOP_STOCKS = ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'AAPL', 'TSLA'];
let lastStockServiceError: string | null = null;
let lastErrorLogAt = 0;

function parseNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/[,%\s]/g, '');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function parsePercent(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const normalized = value.replace('%', '').trim();
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export const normalizeStock = (item: any): TopMoverStock => ({
  symbol: String(item?.ticker ?? item?.symbol ?? '').trim(),
  price: parseNumber(item?.price),
  change: parseNumber(item?.change_amount),
  changePercent: parsePercent(item?.change_percentage),
  volume: parseNumber(item?.volume),
});

export const getStockServiceLastError = (): string | null => lastStockServiceError;

async function fetchFromFinnhub(symbol: string): Promise<TopMoverStock | null> {
  try {
    if (!FINNHUB_API_KEY) {
      return null;
    }

    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`);
    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const price = parseNumber(data?.c);

    if (!price || price <= 0) {
      return null;
    }

    return {
      symbol,
      price,
      change: parseNumber(data?.d),
      changePercent: parseNumber(data?.dp),
      volume: parseNumber(data?.v),
    };
  } catch {
    return null;
  }
}

async function fetchFromYahoo(symbol: string): Promise<TopMoverStock | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`,
    );

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    const quote = json?.quoteResponse?.result?.[0];
    if (!quote) {
      return null;
    }

    const price = parseNumber(quote?.regularMarketPrice);
    if (!price || price <= 0) {
      return null;
    }

    return {
      symbol,
      price,
      change: parseNumber(quote?.regularMarketChange),
      changePercent: parseNumber(quote?.regularMarketChangePercent),
      volume: parseNumber(quote?.regularMarketVolume),
    };
  } catch {
    return null;
  }
}

async function fetchStock(symbol: string): Promise<TopMoverStock | null> {
  let data = await fetchFromFinnhub(symbol);

  if (!data || !data.price) {
    data = await fetchFromYahoo(symbol);
  }

  return data;
}

export const fetchTopMovers = async (): Promise<TopMoversData | null> => {
  try {
    const results = await Promise.all(TOP_STOCKS.map((symbol) => fetchStock(symbol)));
    const rows = results.filter((row): row is TopMoverStock => Boolean(row && row.symbol && row.price > 0));

    if (!rows.length) {
      throw new Error('No live market quote sources returned valid data.');
    }

    const gainers = [...rows].sort((a, b) => b.changePercent - a.changePercent).slice(0, 5);
    const losers = [...rows].sort((a, b) => a.changePercent - b.changePercent).slice(0, 5);
    const mostActive = [...rows]
      .sort((a, b) => (b.volume || 0) - (a.volume || 0))
      .slice(0, 5);

    lastStockServiceError = null;

    return {
      gainers,
      losers,
      mostActive,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Alpha Vantage error';
    lastStockServiceError = message;

    const now = Date.now();
    if (now - lastErrorLogAt > 30000) {
      logError('alphaVantageService/fetchTopMovers', error);
      lastErrorLogAt = now;
    }

    return null;
  }
};
