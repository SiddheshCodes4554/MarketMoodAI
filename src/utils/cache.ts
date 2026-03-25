import AsyncStorage from '@react-native-async-storage/async-storage';

type CacheEnvelope<T> = {
  expiresAt: number;
  data: T;
};

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed?.expiresAt || parsed.expiresAt <= Date.now()) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

export async function setCached<T>(key: string, data: T, ttlMs: number): Promise<void> {
  try {
    const envelope: CacheEnvelope<T> = {
      expiresAt: Date.now() + ttlMs,
      data,
    };
    await AsyncStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Ignore cache write failures.
  }
}

export async function clearCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Ignore cache clear failures.
  }
}
