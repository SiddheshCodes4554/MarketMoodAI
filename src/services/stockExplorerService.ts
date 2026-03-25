import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../constants/config';
import { logError } from '../utils/errorHandler';
import { PopularStock, StockSearchResult } from '../types';

const FINNHUB_API_KEY = CONFIG.API.FINNHUB;

const SEARCH_TTL_MS = 10 * 60 * 1000;
const QUOTE_TTL_MS = 60 * 1000;

const SEARCH_CACHE_PREFIX = 'stock-explorer:search:';
const QUOTE_CACHE_PREFIX = 'stock-explorer:quote:';

type CacheEnvelope<T> = {
  expiresAt: number;
  data: T;
};

const memorySearchCache = new Map<string, CacheEnvelope<StockSearchResult[]>>();
const memoryQuoteCache = new Map<string, CacheEnvelope<QuoteSnapshot>>();

export const POPULAR_STOCKS: PopularStock[] = [
  { name: 'Reliance', symbol: 'RELIANCE.NS' },
  { name: 'TCS', symbol: 'TCS.NS' },
  { name: 'Infosys', symbol: 'INFY.NS' },
  { name: 'HDFC Bank', symbol: 'HDFCBANK.NS' },
  { name: 'ICICI Bank', symbol: 'ICICIBANK.NS' },
  { name: 'Apple', symbol: 'AAPL' },
  { name: 'Tesla', symbol: 'TSLA' },
];

export const TRENDING_SEARCHES: string[] = ['Reliance', 'TCS', 'Tesla'];

export type QuoteSnapshot = {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
};

type QuoteData = {
  price: number;
  change: number;
  percent: number;
};

function getStorageKey(prefix: string, id: string): string {
  return `${prefix}${id.toUpperCase()}`;
}

function now(): number {
  return Date.now();
}

function fallbackSearch(query: string): StockSearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return POPULAR_STOCKS.filter(
    (item) => item.name.toLowerCase().includes(normalized) || item.symbol.toLowerCase().includes(normalized),
  ).map((item) => ({ symbol: item.symbol, name: item.name }));
}

function toCommonStockResult(input: any): StockSearchResult | null {
  const symbol = String(input?.symbol ?? '').trim();
  const name = String(input?.description ?? input?.displaySymbol ?? input?.symbol ?? '').trim();

  if (!symbol || !name) {
    return null;
  }

  const instrumentType = String(input?.type ?? '').toLowerCase();
  if (instrumentType && !instrumentType.includes('common') && !instrumentType.includes('stock')) {
    return null;
  }

  return { symbol, name };
}

async function readCache<T>(key: string): Promise<CacheEnvelope<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed.expiresAt !== 'number') {
      return null;
    }

    if (parsed.expiresAt <= now()) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function writeCache<T>(key: string, envelope: CacheEnvelope<T>): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Ignore cache write failures so live flow is not blocked.
  }
}

export async function searchStocks(query: string): Promise<StockSearchResult[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return [];
  }

  const key = getStorageKey(SEARCH_CACHE_PREFIX, normalizedQuery);
  const memoryHit = memorySearchCache.get(key);
  if (memoryHit && memoryHit.expiresAt > now()) {
    return memoryHit.data;
  }

  const storageHit = await readCache<StockSearchResult[]>(key);
  if (storageHit) {
    memorySearchCache.set(key, storageHit);
    return storageHit.data;
  }

  if (!FINNHUB_API_KEY) {
    return fallbackSearch(normalizedQuery);
  }

  try {
    const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(normalizedQuery)}&token=${FINNHUB_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Search request failed');
    }

    const data = await response.json();
    const items: any[] = Array.isArray(data?.result) ? data.result : [];

    const seen = new Set<string>();
    const mapped = items
      .map((item: any) => toCommonStockResult(item))
      .filter((item: StockSearchResult | null): item is StockSearchResult => Boolean(item))
      .filter((item: StockSearchResult) => {
        const keyValue = item.symbol.toUpperCase();
        if (seen.has(keyValue)) {
          return false;
        }
        seen.add(keyValue);
        return true;
      })
      .slice(0, 50);

    const envelope: CacheEnvelope<StockSearchResult[]> = {
      expiresAt: now() + SEARCH_TTL_MS,
      data: mapped,
    };

    memorySearchCache.set(key, envelope);
    await writeCache(key, envelope);

    return mapped;
  } catch {
    return fallbackSearch(normalizedQuery);
  }
}

function quoteName(symbol: string): string {
  return symbol.replace('.NS', '');
}

const NON_NSE_SYMBOLS = new Set(['AAPL', 'TSLA', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META']);

export function normalizeSymbol(symbol: string): string {
  const cleaned = symbol.trim().toUpperCase();
  if (!cleaned) {
    return cleaned;
  }

  if (cleaned.startsWith('NSE:')) {
    return `${cleaned.slice(4)}.NS`;
  }

  if (cleaned.startsWith('BSE:')) {
    return `${cleaned.slice(4)}.BO`;
  }

  return cleaned;
}

function buildQuoteCandidates(symbol: string): string[] {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) {
    return [];
  }

  const set = new Set<string>([normalized]);

  if (normalized.startsWith('NSE:') || normalized.startsWith('BSE:')) {
    const [exchange, base] = normalized.split(':');
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

  if (normalized.endsWith('.NS') || normalized.endsWith('.BO')) {
    set.add(normalized.slice(0, -3));
  }

  if (!normalized.includes('.') && !normalized.includes(':') && /^[A-Z]+$/.test(normalized) && !NON_NSE_SYMBOLS.has(normalized)) {
    set.add(`${normalized}.NS`);
    set.add(`${normalized}.BO`);
    set.add(`NSE:${normalized}`);
  }

  return Array.from(set);
}

function mapFinnhubQuote(data: any): QuoteData | null {
  if (!data) {
    return null;
  }

  const current = Number(data?.c ?? 0);
  const change = Number(data?.d ?? 0);
  const percent = Number(data?.dp ?? 0);

  if (!Number.isFinite(current) || current === 0) {
    return null;
  }

  return {
    price: current,
    change: Number.isFinite(change) ? change : 0,
    percent: Number.isFinite(percent) ? percent : 0,
  };
}

async function fetchFromFinnhub(symbol: string): Promise<QuoteData | null> {
  if (!FINNHUB_API_KEY) {
    return null;
  }

  try {
    const normalizedSymbol = normalizeSymbol(symbol);
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(normalizedSymbol)}&token=${FINNHUB_API_KEY}`,
    );

    if (!response.ok) {
      return null;
    }

    const raw = await response.json();
    const mapped = mapFinnhubQuote(raw);
    if (!mapped) {
      logError('stockExplorerService/finnhub-quote', `No usable quote for ${normalizedSymbol}`);
    }
    return mapped;
  } catch (error) {
    logError('stockExplorerService/finnhub-quote', error);
    return null;
  }
}

async function fetchFromYahoo(symbol: string): Promise<QuoteData | null> {
  try {
    const normalizedSymbol = normalizeSymbol(symbol);
    const response = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(normalizedSymbol)}`,
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const row = data?.quoteResponse?.result?.[0];

    if (!row) {
      return null;
    }

    const price = Number(row.regularMarketPrice ?? row.regularMarketPreviousClose ?? 0);
    const change = Number(row.regularMarketChange ?? 0);
    const percent = Number(row.regularMarketChangePercent ?? 0);

    if (!Number.isFinite(price) || price <= 0) {
      return null;
    }

    const mapped: QuoteData = {
      price,
      change: Number.isFinite(change) ? change : 0,
      percent: Number.isFinite(percent) ? percent : 0,
    };
    return mapped;
  } catch (error) {
    logError('stockExplorerService/yahoo-quote', error);
    return null;
  }
}

export async function fetchQuote(symbol: string): Promise<QuoteData | null> {
  const candidates = buildQuoteCandidates(symbol);

  for (const candidate of candidates) {
    const data = await fetchFromFinnhub(candidate);
    if (data?.price && data.price > 0) {
      return data;
    }
  }

  for (const candidate of candidates) {
    const data = await fetchFromYahoo(candidate);
    if (data?.price && data.price > 0) {
      return data;
    }
  }

  logError('stockExplorerService/final-quote', `No live quote for ${symbol}`);
  return null;
}

export async function getFinnhubQuote(symbol: string): Promise<QuoteSnapshot | null> {
  const normalizedSymbol = normalizeSymbol(symbol);
  if (!normalizedSymbol) {
    return null;
  }

  const key = getStorageKey(QUOTE_CACHE_PREFIX, normalizedSymbol);
  const memoryHit = memoryQuoteCache.get(key);
  if (memoryHit && memoryHit.expiresAt > now()) {
    return memoryHit.data;
  }

  const storageHit = await readCache<QuoteSnapshot>(key);
  if (storageHit) {
    memoryQuoteCache.set(key, storageHit);
    return storageHit.data;
  }

  try {
    const quoteData = await fetchQuote(normalizedSymbol);
    if (!quoteData || !Number.isFinite(quoteData.price) || quoteData.price <= 0) {
      return null;
    }

    const quote: QuoteSnapshot = {
      symbol: normalizedSymbol,
      name: quoteName(normalizedSymbol),
      price: quoteData.price,
      changePct: quoteData.percent,
    };

    const envelope: CacheEnvelope<QuoteSnapshot> = {
      expiresAt: now() + QUOTE_TTL_MS,
      data: quote,
    };

    memoryQuoteCache.set(key, envelope);
    await writeCache(key, envelope);

    return quote;
  } catch {
    return null;
  }
}
