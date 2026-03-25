import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../constants/config';
import { mockNews } from '../constants/mockData';
import { NewsWithSentiment } from '../types';
import { getCached, setCached } from '../utils/cache';
import { withErrorFallback } from '../utils/errorHandler';
import { getNewsSentiment as getLiveNewsSentiment, getMarketStory as getLiveMarketStory, getWhyMarketMoved as getLiveWhyMarketMoved } from './marketService';

async function isDemoMode(): Promise<boolean> {
  const mode = await AsyncStorage.getItem(CONFIG.APP.MODE_STORAGE_KEY);
  return mode === 'demo';
}

export async function getNewsSentiment(): Promise<NewsWithSentiment[]> {
  if (await isDemoMode()) {
    return mockNews.map((item) => ({
      ...item,
      sentiment: 'Neutral',
      sentimentScore: 55,
    }));
  }

  const cacheKey = 'newsService:sentiment';
  const cached = await getCached<NewsWithSentiment[]>(cacheKey);
  if (cached?.length) {
    return cached;
  }

  const live = await withErrorFallback('newsService/getNewsSentiment', () => getLiveNewsSentiment(), [] as NewsWithSentiment[]);
  if (live.length) {
    await setCached(cacheKey, live, CONFIG.APP.DEFAULT_CACHE_TTL_MS);
  }
  return live;
}

export async function getWhyMarketMoved(): Promise<string> {
  if (await isDemoMode()) {
    return 'Summary: Demo mode shows a stable market session with mild positive bias.';
  }

  return withErrorFallback(
    'newsService/getWhyMarketMoved',
    () => getLiveWhyMarketMoved(),
    'Summary: Live data is delayed. Please refresh in a moment.',
  );
}

export async function getMarketStory(): Promise<string> {
  if (await isDemoMode()) {
    return [
      'Headline: Today\'s Market Story',
      'What happened: Markets held gains through the session with selective participation in banking and IT names.',
      'Why it happened: Cooling inflation expectations and stable global cues supported sentiment while energy-linked names stayed mixed.',
      'What to watch next:',
      '- Watch whether breadth improves in mid-caps.',
      '- Track crude and global rates for risk appetite shifts.',
    ].join('\n');
  }

  return withErrorFallback(
    'newsService/getMarketStory',
    () => getLiveMarketStory(),
    [
      'Headline: Today\'s Market Story',
      'What happened: Live data is delayed for this moment.',
      'Why it happened: The fallback guard prevented an empty story state.',
      'What to watch next:',
      '- Refresh after a few seconds.',
      '- Check dashboard signals for confirmation.',
    ].join('\n'),
  );
}
