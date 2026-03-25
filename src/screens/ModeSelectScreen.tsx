import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DemoModeToggle } from '../components/DemoModeToggle';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../constants/theme';
import { useAppSession } from '../context/AppSessionContext';
import { UserType } from '../types';

const USER_TYPES: UserType[] = ['Beginner', 'Intermediate', 'Trader'];

export function ModeSelectScreen() {
  const insets = useSafeAreaInsets();
  const { chooseAuthMode, chooseDemoMode, userType, setUserType } = useAppSession();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xl }]}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>WELCOME TO</Text>
        <Text style={styles.title}>MarketMood AI</Text>
        <Text style={styles.subtitle}>AI-powered stock and economy sentiment engine for Indian investors</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Choose your experience</Text>
        <Text style={styles.cardBody}>Sign in to sync profile and usage history with Supabase, or start demo mode instantly.</Text>

        <DemoModeToggle />

        <Text style={styles.label}>Select Investor Type</Text>
        <View style={styles.userTypeRow}>
          {USER_TYPES.map((type) => {
            const selected = type === userType;
            return (
              <Pressable
                key={type}
                style={[styles.userTypeChip, selected ? styles.userTypeChipActive : null]}
                onPress={() => void setUserType(type)}
              >
                <Text style={[styles.userTypeText, selected ? styles.userTypeTextActive : null]}>{type}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.primaryButton} onPress={chooseAuthMode}>
          <Text style={styles.primaryText}>Sign In / Create Account</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={chooseDemoMode}>
          <Text style={styles.secondaryText}>Continue in Demo Mode</Text>
        </Pressable>
      </View>

      <Text style={styles.footnote}>Demo mode keeps real market data but skips account login.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
    paddingBottom: spacing.xl,
  },
  hero: {
    marginTop: spacing.xl,
  },
  kicker: {
    color: colors.accent,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    letterSpacing: 1,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_700Bold',
    fontSize: 34,
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 20,
  },
  cardBody: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 20,
  },
  label: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
  },
  userTypeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  userTypeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  userTypeChipActive: {
    borderColor: '#CFE5FF',
    backgroundColor: '#EAF4FF',
  },
  userTypeText: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
  },
  userTypeTextActive: {
    color: colors.accent,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  primaryText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: '#F8FBFF',
  },
  secondaryText: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
  },
  footnote: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    textAlign: 'center',
  },
});
