export const CONFIG = {
  API: {
    FINNHUB: process.env.EXPO_PUBLIC_FINNHUB_API_KEY ?? '',
    GROQ: process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '',
    GNEWS: process.env.EXPO_PUBLIC_GNEWS_API_KEY ?? '',
    SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  },
  APP: {
    DEMO_MODE: false,
    MODE_STORAGE_KEY: 'marketMoodAppMode',
    DEFAULT_CACHE_TTL_MS: 3 * 60 * 1000,
  },
} as const;

export type AppMode = 'demo' | 'live';
