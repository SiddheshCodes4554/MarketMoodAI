import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { Reveal } from '../components/Reveal';
import { SkeletonCard } from '../components/SkeletonCard';
import { SentimentBar } from '../components/SentimentBar';
import { TopStocksSection } from '../components/TopStocksSection';
import { colors, radius, spacing } from '../constants/theme';
import { useAppSession } from '../context/AppSessionContext';
import { RootStackParamList } from '../navigation/types';
import { getDashboardData } from '../services/stockService';
import { DashboardData, TopMoverStock, TrendingStock, UserType } from '../types';

const USER_TYPES: UserType[] = ['Beginner', 'Intermediate', 'Trader'];

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type InfoKey =
  | 'marketSentiment'
  | 'fearGreed'
  | 'dataSource'
  | 'sectorHeatmap'
  | 'riskAlerts'
  | 'missedOpportunities'
  | 'trendingStocks'
  | 'aiSummary';

const infoContent: Record<InfoKey, { title: string; description: string }> = {
  marketSentiment: {
    title: 'Market Sentiment Index',
    description:
      'This is a blended 0-100 signal built from recent market news sentiment and live market context. The line chart uses real rolling averages from fresh headline sentiment, not mock graph data.',
  },
  fearGreed: {
    title: 'Fear & Greed',
    description:
      'This meter estimates current market psychology. Lower values suggest defensive sentiment (fear), while higher values suggest stronger risk-taking behavior (greed).',
  },
  dataSource: {
    title: 'Data Source',
    description:
      'This app uses live public APIs for market news and stock prices, then computes sentiment and insights in near real time.',
  },
  sectorHeatmap: {
    title: 'Sector Heatmap',
    description:
      'Each sector score reflects how positive or negative the recent headline flow is for that sector. Use it to quickly spot relative sector strength or weakness.',
  },
  riskAlerts: {
    title: 'Risk Alert System',
    description:
      'Alerts are triggered from sentiment spikes. It flags panic setups, hype-driven stock moves, and sudden volatility shifts to help you identify risk regimes quickly.',
  },
  missedOpportunities: {
    title: 'You Might Have Missed',
    description:
      'Highlights strong completed moves that crossed momentum thresholds recently, with trigger context and lessons to watch next time.',
  },
  trendingStocks: {
    title: 'Top Trending Stocks',
    description:
      'This section uses Alpha Vantage live top movers feed with tabs for gainers, losers, and most active stocks. Data is cached locally so the app still shows last successful live results if the API is briefly unavailable.',
  },
  aiSummary: {
    title: 'AI Market Summary',
    description:
      'This is an AI-generated plain-language recap of current market drivers based on fresh news and sentiment signals. It is an explainer, not investment advice.',
  },
};

const chartConfig = {
  backgroundGradientFrom: '#FFFFFF',
  backgroundGradientTo: '#FFFFFF',
  color: (opacity = 1) => `rgba(46, 144, 250, ${opacity})`,
  strokeWidth: 2,
  useShadowColorFromDataset: false,
  propsForDots: {
    r: '0',
    strokeWidth: '0',
  },
  propsForBackgroundLines: {
    stroke: '#EDF2F7',
    strokeDasharray: '0',
  },
};

function sentimentColor(score: number) {
  if (score >= 60) {
    return colors.positive;
  }

  if (score <= 40) {
    return colors.negative;
  }

  return colors.neutral;
}

export function DashboardScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { mode, profile, userType, signOut, chooseAuthMode, updateProfile, setUserType } = useAppSession();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeInfo, setActiveInfo] = useState<InfoKey | null>(null);
  const [topMoversRefreshToken, setTopMoversRefreshToken] = useState(0);
  const [showSummaryWhy, setShowSummaryWhy] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [draftFullName, setDraftFullName] = useState('');
  const [draftUserType, setDraftUserType] = useState<UserType>('Intermediate');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const chartWidth = Math.max(220, width - spacing.xl * 2 - spacing.lg * 2);
  const isCompact = width < 380;

  const trendData = useMemo(
    () => ({
      labels: (dashboard?.sentimentTrend ?? []).map((_, idx, arr) => {
        if (idx === 0) {
          return 'Earlier';
        }
        if (idx === arr.length - 1) {
          return 'Now';
        }
        return '';
      }),
      datasets: [
        {
          data: dashboard?.sentimentTrend ?? [],
        },
      ],
    }),
    [dashboard],
  );

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await getDashboardData(userType);
      setDashboard(data);
      setLastUpdatedAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load live dashboard data.');
    }
  }, [userType]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  useEffect(() => {
    setDraftFullName(profile?.full_name ?? '');
    setDraftUserType(userType);
  }, [profile?.full_name, userType]);

  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setRefreshing(true);
    await loadData();
    setTopMoversRefreshToken((current) => current + 1);
    setRefreshing(false);
  };

  const saveProfile = async () => {
    setProfileMessage(null);

    if (mode === 'auth') {
      const result = await updateProfile({ fullName: draftFullName.trim(), userType: draftUserType });
      if (!result.ok) {
        setProfileMessage(result.message ?? 'Failed to update profile.');
        return;
      }
    } else {
      await setUserType(draftUserType);
      setProfileMessage('Investor type saved for demo mode.');
    }

    setEditingProfile(false);
    await loadData();
  };

  const openTopMoverDetail = (stock: TopMoverStock) => {
    const mapped: TrendingStock = {
      symbol: stock.symbol,
      name: stock.symbol,
      price: stock.price,
      changePct: stock.changePercent,
      sentimentScore: Math.max(5, Math.min(95, Math.round(50 + stock.changePercent * 6))),
    };

    navigation.navigate('StockDetail', { symbol: stock.symbol, initialStock: mapped });
  };

  const renderTitleWithInfo = (label: string, key: InfoKey, compact = false) => (
    <View style={styles.titleInfoRow}>
      <Text style={compact ? styles.metricTitle : styles.cardTitle}>{label}</Text>
      <Pressable style={styles.infoButton} onPress={() => setActiveInfo(key)} hitSlop={8}>
        <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
      </Pressable>
    </View>
  );

  if (loading || !dashboard) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}>
        {error ? (
          <Card>
            <Text style={styles.cardTitle}>Live Data Unavailable</Text>
            <Text style={styles.summaryText}>{error}</Text>
            <Pressable style={[styles.primaryButton, { marginTop: spacing.md, marginBottom: 0 }]} onPress={loadData}>
              <Text style={styles.primaryButtonText}>Retry</Text>
            </Pressable>
          </Card>
        ) : (
          <>
            <SkeletonCard lines={2} height={90} />
            <SkeletonCard lines={4} height={240} />
            <SkeletonCard lines={3} height={130} />
            <SkeletonCard lines={4} height={170} />
          </>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <View style={styles.header}>
        <View style={styles.headerCopyWrap}>
          <Text style={[styles.title, isCompact ? styles.titleCompact : null]}>MarketMood AI</Text>
          <Text style={styles.subtitle}>
            {mode === 'auth' ? `Welcome, ${profile?.full_name?.trim() || 'Investor'}` : 'Demo mode with live market feed'}
          </Text>
          {lastUpdatedAt ? <Text style={styles.lastUpdated}>Last updated {new Date(lastUpdatedAt).toLocaleTimeString()}</Text> : null}
        </View>
        <Pressable style={styles.iconButton} onPress={() => {
          setProfileMessage(null);
          setShowProfileModal(true);
        }}>
          <Ionicons name="person-circle" size={20} color={colors.accent} />
        </Pressable>
      </View>

      <Reveal delay={40}>
          <Card>
        <View style={styles.sentimentHeaderTopRow}>
          <View style={styles.sentimentTitleBlock}>
            <Text style={styles.cardTitle}>Market Sentiment Index</Text>
            <Text style={styles.sentimentSubLabel}>Live trend from recent headline sentiment</Text>
          </View>
          <Pressable style={styles.infoButton} onPress={() => setActiveInfo('marketSentiment')} hitSlop={8}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.sentimentScoreRow}>
          <Text
            style={[
              styles.metricPill,
              {
                color: sentimentColor(dashboard.marketSentimentIndex),
                borderColor: `${sentimentColor(dashboard.marketSentimentIndex)}66`,
                backgroundColor: `${sentimentColor(dashboard.marketSentimentIndex)}14`,
              },
            ]}
          >
            {dashboard.marketSentimentIndex}/100
          </Text>
        </View>
        {dashboard.sentimentTrend.length >= 3 ? (
          <LineChart
            data={trendData}
            width={chartWidth}
            height={170}
            chartConfig={chartConfig}
            bezier
            withVerticalLabels={false}
            withHorizontalLabels
            withInnerLines
            withOuterLines={false}
            style={styles.chart}
          />
        ) : (
          <View style={styles.trendUnavailableBox}>
            <Text style={styles.trendUnavailableText}>Live sentiment trend is still building from fresh headlines.</Text>
          </View>
        )}
        <View style={styles.sentimentLegendRow}>
          <Text style={styles.legendText}>Bearish</Text>
          <Text style={[styles.legendSignal, { color: sentimentColor(dashboard.marketSentimentIndex) }]}>
            {dashboard.marketSentimentIndex >= 60
              ? 'Bullish Bias'
              : dashboard.marketSentimentIndex <= 40
                ? 'Bearish Bias'
                : 'Neutral Bias'}
          </Text>
          <Text style={styles.legendText}>Bullish</Text>
        </View>
        <Text style={styles.helperText}>Trend reflects rolling averages from real recent market headlines.</Text>
        </Card>
      </Reveal>

      <Reveal delay={90}>
        <View style={styles.metricsRow}>
        <Card style={styles.metricCard}>
          {renderTitleWithInfo('Fear & Greed', 'fearGreed', true)}
          <Text style={styles.metricValue}>{dashboard.fearGreed}</Text>
          <View style={styles.meterWrap}>
            <SentimentBar value={dashboard.fearGreed} labelLeft="Fear" labelRight="Greed" showValue={false} />
          </View>
          <Text style={styles.metricSub}>Higher value indicates stronger risk appetite.</Text>
        </Card>
        <Card style={styles.metricCard}>
          {renderTitleWithInfo('Data Source', 'dataSource', true)}
          <Text style={styles.metricValue}>LIVE</Text>
          <Text style={styles.metricSub}>News and price feeds are fetched from real-time public APIs.</Text>
        </Card>
        </View>
      </Reveal>

      <Reveal delay={140}>
        <Card>
        <View style={styles.cardHeadingRow}>
          {renderTitleWithInfo('Sector Heatmap', 'sectorHeatmap')}
        </View>
        <View style={styles.sectorGrid}>
          {dashboard.sectors.map((sector) => (
            <View key={sector.sector} style={styles.sectorTile}>
              <View style={[styles.dot, { backgroundColor: sentimentColor(sector.score) }]} />
              <Text style={styles.sectorName}>{sector.sector}</Text>
              <Text style={styles.sectorValue}>{sector.score}</Text>
            </View>
          ))}
        </View>
        </Card>
      </Reveal>

      <Reveal delay={190}>
        <Card>
        <View style={styles.cardHeadingRow}>
          {renderTitleWithInfo('Risk Alert System', 'riskAlerts')}
        </View>
        <View style={styles.alertList}>
          {dashboard.riskAlerts.map((alert, idx) => (
            <View key={`${alert}-${idx}`} style={styles.alertRow}>
              <Text style={styles.alertIcon}>!!</Text>
              <Text style={styles.alertText}>{alert}</Text>
            </View>
          ))}
        </View>
        </Card>
      </Reveal>

      <Reveal delay={220}>
        <Card>
          <View style={styles.cardHeadingRow}>
            {renderTitleWithInfo('You Might Have Missed', 'missedOpportunities')}
          </View>
          {dashboard.missedOpportunities.length ? (
            dashboard.missedOpportunities.map((item, idx) => (
              <View key={`${item.symbol}-${idx}`} style={[styles.missedCard, idx === dashboard.missedOpportunities.length - 1 ? styles.missedCardLast : null]}>
                <View style={styles.missedTopRow}>
                  <Text style={styles.missedHeadline}>! {item.symbol} moved +{item.movePercent}% recently</Text>
                  <View style={styles.missedBadge}><Text style={styles.missedBadgeText}>Missed</Text></View>
                </View>
                <Text style={styles.missedReason}>{item.reason}</Text>
                <Text style={styles.missedLesson}>{item.lesson}</Text>
                <Text style={styles.missedCta}>Watch similar signals next time</Text>
              </View>
            ))
          ) : (
            <Text style={styles.summaryText}>No major completed {'>'}5% momentum moves were detected in the latest tracked set.</Text>
          )}
        </Card>
      </Reveal>

      <Reveal delay={240}>
        <View>
          <View style={styles.sectionInfoRow}>
            {renderTitleWithInfo('Top Trending Stocks', 'trendingStocks')}
          </View>
          <TopStocksSection refreshToken={topMoversRefreshToken} onSelectStock={openTopMoverDetail} />
        </View>
      </Reveal>

      <Reveal delay={280}>
        <Card>
        <View style={styles.cardHeadingRow}>
          {renderTitleWithInfo('AI Market Summary', 'aiSummary')}
        </View>
        <View style={styles.summaryConfidenceRow}>
          <Text style={styles.summaryConfidenceText}>Confidence: {dashboard.aiConfidence}%</Text>
          <Pressable onPress={() => setShowSummaryWhy((value) => !value)}>
            <Text style={styles.whyButton}>Why?</Text>
          </Pressable>
        </View>
        {showSummaryWhy ? (
          <View style={styles.summaryFactorsWrap}>
            {dashboard.aiFactors.map((factor, idx) => (
              <Text key={`${factor}-${idx}`} style={styles.summaryFactorText}>• {factor}</Text>
            ))}
          </View>
        ) : null}
        <Text style={styles.summaryText}>{dashboard.aiSummary}</Text>
        <Text style={styles.summaryActionTitle}>Suggested Action</Text>
        <Text style={styles.summaryActionText}>{dashboard.aiSuggestedAction}</Text>
        <Text style={styles.summaryActionTitle}>For You</Text>
        <Text style={styles.summaryActionText}>{dashboard.aiForYouAdvice}</Text>
        <Text style={styles.educationalNote}>This is an AI-generated insight for educational purposes.</Text>
        </Card>
      </Reveal>

      <Reveal delay={320}>
        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('MainTabs', { screen: 'WhyMoved' })}>
          <Text style={styles.primaryButtonText}>Why did market move today?</Text>
        </Pressable>
      </Reveal>

      <Modal visible={Boolean(activeInfo)} transparent animationType="fade" onRequestClose={() => setActiveInfo(null)}>
        <Pressable style={styles.infoBackdrop} onPress={() => setActiveInfo(null)}>
          <Pressable style={styles.infoModal} onPress={() => {}}>
            <View style={styles.infoModalHeader}>
              <Text style={styles.infoModalTitle}>{activeInfo ? infoContent[activeInfo].title : ''}</Text>
              <Pressable onPress={() => setActiveInfo(null)} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.infoModalBody}>{activeInfo ? infoContent[activeInfo].description : ''}</Text>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showProfileModal} transparent animationType="fade" onRequestClose={() => setShowProfileModal(false)}>
        <Pressable style={styles.infoBackdrop} onPress={() => setShowProfileModal(false)}>
          <Pressable style={styles.infoModal} onPress={() => {}}>
            <View style={styles.infoModalHeader}>
              <Text style={styles.infoModalTitle}>Profile</Text>
              <Pressable onPress={() => setShowProfileModal(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.profileTopRow}>
              <Text style={styles.profileText}>Name: {profile?.full_name?.trim() || 'Investor'}</Text>
              <Pressable onPress={() => setEditingProfile((value) => !value)}>
                <Text style={styles.profileEditText}>{editingProfile ? 'Cancel' : 'Edit Profile'}</Text>
              </Pressable>
            </View>
            <Text style={styles.profileText}>Email: {profile?.email ?? 'Demo user'}</Text>
            <Text style={styles.profileText}>Investor Type: {userType}</Text>

            {editingProfile ? (
              <>
                <Text style={styles.profileLabel}>Full Name</Text>
                <TextInput
                  style={styles.profileInput}
                  value={draftFullName}
                  onChangeText={setDraftFullName}
                  placeholder="Your name"
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={styles.profileLabel}>Investor Type</Text>
                <View style={styles.profileTypeRow}>
                  {USER_TYPES.map((type) => {
                    const selected = type === draftUserType;
                    return (
                      <Pressable
                        key={type}
                        style={[styles.profileTypeChip, selected ? styles.profileTypeChipActive : null]}
                        onPress={() => setDraftUserType(type)}
                      >
                        <Text style={[styles.profileTypeText, selected ? styles.profileTypeTextActive : null]}>{type}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable style={styles.profileSaveButton} onPress={saveProfile}>
                  <Text style={styles.profileSaveText}>Save Profile</Text>
                </Pressable>
              </>
            ) : null}

            {profileMessage ? <Text style={styles.profileMessage}>{profileMessage}</Text> : null}

            <View style={styles.profileActionsRow}>
              {mode === 'demo' ? (
                <Pressable style={styles.demoAuthButton} onPress={chooseAuthMode}>
                  <Text style={styles.demoAuthText}>Sign In</Text>
                </Pressable>
              ) : null}
              {mode === 'auth' ? (
                <Pressable style={styles.logoutButton} onPress={signOut}>
                  <Text style={styles.logoutButtonText}>Logout</Text>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 128,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerCopyWrap: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_700Bold',
    fontSize: 28,
    lineHeight: 34,
  },
  titleCompact: {
    fontSize: 24,
    lineHeight: 30,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    marginTop: 2,
  },
  lastUpdated: {
    marginTop: 3,
    color: colors.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EAF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  titleInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    flexShrink: 1,
  },
  sentimentHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sentimentTitleBlock: {
    flex: 1,
    gap: 2,
  },
  sentimentSubLabel: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
  },
  sentimentScoreRow: {
    marginTop: spacing.xs,
    alignItems: 'flex-end',
  },
  infoButton: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  profileEditText: {
    color: colors.accent,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  profileText: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 2,
    flexShrink: 1,
  },
  profileLabel: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    marginTop: spacing.xs,
    marginBottom: 6,
  },
  profileInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontFamily: 'Poppins_400Regular',
    backgroundColor: '#FBFDFF',
  },
  profileTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  profileTypeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  profileTypeChipActive: {
    borderColor: '#CFE5FF',
    backgroundColor: '#EAF4FF',
  },
  profileTypeText: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
  },
  profileTypeTextActive: {
    color: colors.accent,
  },
  profileSaveButton: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  profileSaveText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  profileMessage: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    marginTop: spacing.xs,
  },
  logoutButton: {
    marginTop: spacing.sm,
    backgroundColor: '#FFF4F2',
    borderColor: '#FFD0C8',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  logoutButtonText: {
    color: '#C4321C',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  profileActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  demoAuthButton: {
    marginTop: spacing.sm,
    backgroundColor: '#EAF4FF',
    borderColor: '#CFE5FF',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  demoAuthText: {
    color: colors.accent,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  metricPill: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    flexShrink: 0,
  },
  chart: {
    borderRadius: 16,
    marginVertical: spacing.xs,
  },
  trendUnavailableBox: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: '#F8FBFF',
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.sm,
  },
  trendUnavailableText: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  helperText: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    padding: spacing.md,
    minHeight: 120,
  },
  metricTitle: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
  },
  metricValue: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_700Bold',
    fontSize: 24,
    marginTop: spacing.xs,
  },
  metricSub: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  meterWrap: {
    marginTop: spacing.xs,
  },
  sentimentLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  legendText: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
  },
  legendSignal: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  sectorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sectorTile: {
    width: '48%',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.lg,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.md,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginBottom: spacing.xs,
  },
  sectorName: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
  },
  sectorValue: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_700Bold',
    fontSize: 20,
    marginTop: 2,
  },
  link: {
    color: colors.accent,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
  },
  sectionInfoRow: {
    marginBottom: spacing.xs,
    paddingHorizontal: 2,
  },
  alertList: {
    gap: spacing.sm,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#FFF4F2',
    borderColor: '#FFD0C8',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  alertIcon: {
    color: '#C4321C',
    fontFamily: 'Poppins_700Bold',
    fontSize: 12,
    marginTop: 1,
  },
  alertText: {
    flex: 1,
    color: '#7A2318',
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    lineHeight: 18,
  },
  missedCard: {
    borderWidth: 1,
    borderColor: '#FFD79A',
    backgroundColor: '#FFF8EA',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  missedCardLast: {
    marginBottom: 0,
  },
  missedTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  missedHeadline: {
    flex: 1,
    color: '#7A4A00',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    lineHeight: 18,
  },
  missedBadge: {
    borderWidth: 1,
    borderColor: '#FFB020',
    backgroundColor: '#FFE3A8',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  missedBadgeText: {
    color: '#A15C00',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 10,
  },
  missedReason: {
    marginTop: spacing.xs,
    color: '#8A5A00',
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    lineHeight: 18,
  },
  missedLesson: {
    marginTop: 2,
    color: '#7A5A2B',
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  missedCta: {
    marginTop: spacing.xs,
    color: '#A15C00',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  stockRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  stockLeft: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  stockName: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
  },
  stockSub: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    marginTop: 1,
  },
  stockRight: {
    alignItems: 'flex-end',
  },
  stockPrice: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
  },
  stockSentiment: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    marginTop: 1,
  },
  summaryText: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 20,
  },
  summaryConfidenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  summaryConfidenceText: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  whyButton: {
    color: colors.accent,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  summaryFactorsWrap: {
    marginBottom: spacing.sm,
    gap: 2,
  },
  summaryFactorText: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  summaryActionTitle: {
    marginTop: spacing.sm,
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  summaryActionText: {
    marginTop: 2,
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 20,
  },
  educationalNote: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    lineHeight: 16,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
  },
  infoBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 14, 22, 0.42)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  infoModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderColor: colors.border,
    borderWidth: 1,
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  infoModalTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
  },
  infoModalBody: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 20,
  },
  loaderWrap: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
