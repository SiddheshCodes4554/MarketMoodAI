import { NavigatorScreenParams } from '@react-navigation/native';
import { TrendingStock } from '../types';

export type MainTabParamList = {
  Dashboard: undefined;
  StockExplorer: undefined;
  OpportunityRadar: undefined;
  WhyMoved: undefined;
  NewsSentiment: undefined;
  MarketChat: undefined;
};

export type RootStackParamList = {
  ModeSelect: undefined;
  Auth: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  StockDetail: { symbol: string; initialStock?: TrendingStock };
};
