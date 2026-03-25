import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '../constants/config';

const supabaseUrl = CONFIG.API.SUPABASE_URL;
const supabaseAnonKey = CONFIG.API.SUPABASE_ANON_KEY;

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl || 'https://example.supabase.co', supabaseAnonKey || 'public-anon-key', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
