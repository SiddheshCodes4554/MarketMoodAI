import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '../constants/theme';
import { useAppSession } from '../context/AppSessionContext';
import {
  AuthScreen,
  DashboardScreen,
  ModeSelectScreen,
} from '../screens';
import { FloatingTabBar } from '../components/FloatingTabBar';
import { MainTabParamList, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="StockExplorer" getComponent={() => require('../screens').StockExplorerScreen} options={{ title: 'Explore' }} />
      <Tab.Screen name="OpportunityRadar" getComponent={() => require('../screens').OpportunityRadarScreen} options={{ title: 'Radar' }} />
      <Tab.Screen name="WhyMoved" getComponent={() => require('../screens').WhyMovedScreen} options={{ title: 'Story' }} />
      <Tab.Screen name="NewsSentiment" getComponent={() => require('../screens').NewsSentimentScreen} options={{ title: 'News' }} />
      <Tab.Screen name="MarketChat" getComponent={() => require('../screens').MarketChatScreen} options={{ title: 'AI Chat' }} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { loading, mode, session } = useAppSession();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const showModeSelect = mode === 'unknown';
  const showAuth = mode === 'auth' && !session;

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          animation: 'slide_from_right',
          animationDuration: 220,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: {
            fontFamily: 'Poppins_600SemiBold',
          },
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        {showModeSelect ? <Stack.Screen name="ModeSelect" component={ModeSelectScreen} options={{ headerShown: false }} /> : null}
        {showAuth ? <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} /> : null}
        {!showModeSelect && !showAuth ? <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} /> : null}
        {!showModeSelect && !showAuth ? <Stack.Screen name="StockDetail" getComponent={() => require('../screens').StockDetailScreen} options={{ title: 'Stock Detail' }} /> : null}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
