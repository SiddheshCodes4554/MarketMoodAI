import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import React, { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { hasSupabaseEnv, supabase } from '../services/supabase';
import { CONFIG } from '../constants/config';
import { UserType } from '../types';

type AppMode = 'unknown' | 'demo' | 'auth';

export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  user_type: UserType | null;
  created_at?: string;
}

interface AppSessionContextValue {
  mode: AppMode;
  loading: boolean;
  authBusy: boolean;
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  userType: UserType;
  modeError: string | null;
  setUserType: (value: UserType) => Promise<void>;
  updateProfile: (payload: { fullName?: string; userType?: UserType }) => Promise<{ ok: boolean; message?: string }>;
  chooseDemoMode: () => Promise<void>;
  chooseAuthMode: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  signUp: (fullName: string, email: string, password: string, userType: UserType) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
}

const MODE_KEY = 'marketMoodMode';
const USER_TYPE_KEY = 'marketMoodUserType';

const AppSessionContext = createContext<AppSessionContextValue | undefined>(undefined);

async function saveMode(mode: AppMode) {
  await AsyncStorage.setItem(MODE_KEY, mode);
}

async function loadMode(): Promise<AppMode> {
  const raw = await AsyncStorage.getItem(MODE_KEY);
  if (raw === 'demo' || raw === 'auth') {
    return raw;
  }
  return 'unknown';
}

async function saveUserType(userType: UserType) {
  await AsyncStorage.setItem(USER_TYPE_KEY, userType);
}

async function loadUserType(): Promise<UserType> {
  const raw = await AsyncStorage.getItem(USER_TYPE_KEY);
  if (raw === 'Beginner' || raw === 'Intermediate' || raw === 'Trader') {
    return raw;
  }
  return 'Intermediate';
}

async function upsertProfile(user: User, userTypeFallback?: UserType) {
  const fullName = (user.user_metadata?.full_name as string | undefined) ?? null;
  const userTypeFromMeta = user.user_metadata?.user_type as UserType | undefined;

  const payload: { id: string; email: string | null; user_type: UserType; full_name?: string } = {
    id: user.id,
    email: user.email ?? null,
    user_type: userTypeFromMeta ?? userTypeFallback ?? 'Intermediate',
  };

  if (typeof fullName === 'string' && fullName.trim()) {
    payload.full_name = fullName.trim();
  }

  const { error } = await supabase.from('profiles').upsert(
    payload,
    { onConflict: 'id' },
  );

  if (error) {
    throw error;
  }
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const primary = await supabase
    .from('profiles')
    .select('id, full_name, email, user_type, created_at')
    .eq('id', userId)
    .single();

  if (!primary.error && primary.data) {
    return primary.data as UserProfile;
  }

  const fallback = await supabase.from('profiles').select('id, full_name, email, created_at').eq('id', userId).single();

  if (fallback.error || !fallback.data) {
    return null;
  }

  return {
    ...(fallback.data as Omit<UserProfile, 'user_type'>),
    user_type: null,
  };
}

export function AppSessionProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<AppMode>('unknown');
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userType, setUserTypeState] = useState<UserType>('Intermediate');
  const [modeError, setModeError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const persistedMode = await loadMode();
        const persistedUserType = await loadUserType();

        if (!mounted) {
          return;
        }

        setMode(persistedMode);
        setUserTypeState(persistedUserType);

        if (!hasSupabaseEnv) {
          setModeError('Missing Supabase env keys. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.');
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (!mounted) {
          return;
        }

        setSession(data.session ?? null);

        if (data.session?.user) {
          try {
            await upsertProfile(data.session.user, persistedUserType);
            const profileRow = await fetchProfile(data.session.user.id);
            if (mounted) {
              setProfile(profileRow);
              if (profileRow?.user_type) {
                setUserTypeState(profileRow.user_type);
                await saveUserType(profileRow.user_type);
              }
            }
          } catch {
            if (mounted) {
              setProfile(null);
            }
          }
        }
      } catch {
        if (mounted) {
          setMode('unknown');
          setSession(null);
          setProfile(null);
          setModeError('Could not initialize app session. Check network and Supabase config, then restart.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    bootstrap();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, currentSession: Session | null) => {
      setSession(currentSession ?? null);
      if (currentSession?.user) {
        try {
          const persistedType = await loadUserType();
          await upsertProfile(currentSession.user, persistedType);
          const profileRow = await fetchProfile(currentSession.user.id);
          setProfile(profileRow);
          if (profileRow?.user_type) {
            setUserTypeState(profileRow.user_type);
            await saveUserType(profileRow.user_type);
          }
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const setUserType = async (value: UserType) => {
    setUserTypeState(value);
    await saveUserType(value);

    if (session?.user && hasSupabaseEnv) {
      await supabase
        .from('profiles')
        .upsert({ id: session.user.id, email: session.user.email ?? null, user_type: value }, { onConflict: 'id' });
      setProfile((current) => (current ? { ...current, user_type: value } : current));
    }
  };

  const updateProfile = async (payload: { fullName?: string; userType?: UserType }) => {
    const nextUserType = payload.userType ?? userType;
    if (payload.userType) {
      await saveUserType(payload.userType);
      setUserTypeState(payload.userType);
    }

    if (!session?.user || !hasSupabaseEnv) {
      setProfile((current) =>
        current
          ? {
              ...current,
              full_name: payload.fullName ?? current.full_name,
              user_type: nextUserType,
            }
          : current,
      );
      return { ok: true };
    }

    const { error } = await supabase.from('profiles').upsert(
      {
        id: session.user.id,
        email: session.user.email ?? null,
        full_name: payload.fullName ?? profile?.full_name ?? null,
        user_type: nextUserType,
      },
      { onConflict: 'id' },
    );

    if (error) {
      return { ok: false, message: error.message };
    }

    try {
      await supabase.auth.updateUser({
        data: {
          full_name: payload.fullName ?? profile?.full_name ?? null,
          user_type: nextUserType,
        },
      });
    } catch {
      // Keep profile table as source of truth if metadata update fails.
    }

    setProfile((current) =>
      current
        ? {
            ...current,
            full_name: payload.fullName ?? current.full_name,
            user_type: nextUserType,
          }
        : {
            id: session.user.id,
            email: session.user.email ?? null,
            full_name: payload.fullName ?? null,
            user_type: nextUserType,
          },
    );

    return { ok: true };
  };

  const chooseDemoMode = async () => {
    setMode('demo');
    await saveMode('demo');
    await AsyncStorage.setItem(CONFIG.APP.MODE_STORAGE_KEY, 'demo');
  };

  const chooseAuthMode = async () => {
    setMode('auth');
    await saveMode('auth');
    await AsyncStorage.setItem(CONFIG.APP.MODE_STORAGE_KEY, 'live');
  };

  const signIn = async (email: string, password: string) => {
    if (!hasSupabaseEnv) {
      return { ok: false, message: 'Supabase env is not configured.' };
    }

    setAuthBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthBusy(false);

    if (error) {
      return { ok: false, message: error.message };
    }

    return { ok: true };
  };

  const signUp = async (fullName: string, email: string, password: string, profileUserType: UserType) => {
    if (!hasSupabaseEnv) {
      return { ok: false, message: 'Supabase env is not configured.' };
    }

    setAuthBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          user_type: profileUserType,
        },
      },
    });
    setAuthBusy(false);

    if (error) {
      return { ok: false, message: error.message };
    }

    return { ok: true, message: 'Account created. If email confirmation is enabled, verify email first.' };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const value = useMemo(
    () => ({
      mode,
      loading,
      authBusy,
      session,
      user: session?.user ?? null,
      profile,
      userType,
      modeError,
      setUserType,
      updateProfile,
      chooseDemoMode,
      chooseAuthMode,
      signIn,
      signUp,
      signOut,
    }),
    [mode, loading, authBusy, session, profile, userType, modeError],
  );

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
}

export function useAppSession() {
  const context = useContext(AppSessionContext);
  if (!context) {
    throw new Error('useAppSession must be used inside AppSessionProvider');
  }
  return context;
}
