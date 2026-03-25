import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { CONFIG, AppMode } from '../constants/config';

interface AppModeContextValue {
  appMode: AppMode;
  isLoadingAppMode: boolean;
  setAppMode: (mode: AppMode) => Promise<void>;
  toggleAppMode: () => Promise<void>;
}

const AppModeContext = createContext<AppModeContextValue | undefined>(undefined);

export function AppModeProvider({ children }: PropsWithChildren) {
  const [appMode, setAppModeState] = useState<AppMode>(CONFIG.APP.DEMO_MODE ? 'demo' : 'live');
  const [isLoadingAppMode, setIsLoadingAppMode] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(CONFIG.APP.MODE_STORAGE_KEY);
        if (raw === 'demo' || raw === 'live') {
          setAppModeState(raw);
        }
      } finally {
        setIsLoadingAppMode(false);
      }
    };

    load();
  }, []);

  const setAppMode = async (mode: AppMode) => {
    setAppModeState(mode);
    await AsyncStorage.setItem(CONFIG.APP.MODE_STORAGE_KEY, mode);
  };

  const toggleAppMode = async () => {
    await setAppMode(appMode === 'demo' ? 'live' : 'demo');
  };

  const value = useMemo(
    () => ({ appMode, isLoadingAppMode, setAppMode, toggleAppMode }),
    [appMode, isLoadingAppMode],
  );

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}

export function useAppMode() {
  const context = useContext(AppModeContext);
  if (!context) {
    throw new Error('useAppMode must be used within AppModeProvider');
  }

  return context;
}
