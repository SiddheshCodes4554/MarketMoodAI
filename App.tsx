import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from './src/constants/theme';
import { AppModeProvider } from './src/context/AppModeContext';
import { AppSessionProvider } from './src/context/AppSessionContext';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppModeProvider>
        <AppSessionProvider>
          <StatusBar style="dark" />
          <AppNavigator />
        </AppSessionProvider>
      </AppModeProvider>
    </SafeAreaProvider>
  );
}
