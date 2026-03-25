import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../constants/theme';
import { useAppSession } from '../context/AppSessionContext';
import { UserType } from '../types';

const USER_TYPES: UserType[] = ['Beginner', 'Intermediate', 'Trader'];

export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { authBusy, modeError, signIn, signUp } = useAppSession();
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState<UserType>('Intermediate');
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async () => {
    setMessage(null);
    if (!email || !password || (isSignUp && !fullName)) {
      setMessage('Please fill all required fields.');
      return;
    }

    const response = isSignUp
      ? await signUp(fullName.trim(), email.trim(), password, userType)
      : await signIn(email.trim(), password);

    if (!response.ok) {
      setMessage(response.message ?? 'Authentication failed.');
      return;
    }

    if (response.message) {
      setMessage(response.message);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.hero}>
        <Text style={styles.title}>Invest with clarity</Text>
        <Text style={styles.subtitle}>Get live market sentiment, AI summaries, and stock-level context in one place.</Text>
      </View>

      <View style={styles.switchRow}>
        <Pressable style={[styles.switchPill, !isSignUp && styles.switchPillActive]} onPress={() => setIsSignUp(false)}>
          <Text style={[styles.switchText, !isSignUp && styles.switchTextActive]}>Sign In</Text>
        </Pressable>
        <Pressable style={[styles.switchPill, isSignUp && styles.switchPillActive]} onPress={() => setIsSignUp(true)}>
          <Text style={[styles.switchText, isSignUp && styles.switchTextActive]}>Create Account</Text>
        </Pressable>
      </View>

      <View style={styles.formCard}>
        {isSignUp ? (
          <>
            <Text style={styles.label}>Full Name</Text>
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Rafael Mehra" placeholderTextColor={colors.textSecondary} />

            <Text style={styles.label}>Investor Type</Text>
            <View style={styles.userTypeRow}>
              {USER_TYPES.map((type) => {
                const selected = type === userType;
                return (
                  <Pressable
                    key={type}
                    style={[styles.userTypeChip, selected ? styles.userTypeChipActive : null]}
                    onPress={() => setUserType(type)}
                  >
                    <Text style={[styles.userTypeText, selected ? styles.userTypeTextActive : null]}>{type}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={colors.textSecondary} />

        <Text style={styles.label}>Password</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Min 6 characters" placeholderTextColor={colors.textSecondary} />

        {message ? <Text style={styles.message}>{message}</Text> : null}
        {modeError ? <Text style={styles.error}>{modeError}</Text> : null}

        <Pressable style={styles.submitButton} onPress={onSubmit} disabled={authBusy}>
          {authBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>}
        </Pressable>
      </View>
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
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  hero: {
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_700Bold',
    fontSize: 30,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  switchRow: {
    flexDirection: 'row',
    backgroundColor: '#EAF1FA',
    borderRadius: 999,
    padding: 4,
  },
  switchPill: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 10,
  },
  switchPillActive: {
    backgroundColor: '#FFFFFF',
  },
  switchText: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
  },
  switchTextActive: {
    color: colors.textPrimary,
  },
  formCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  label: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontFamily: 'Poppins_400Regular',
    backgroundColor: '#FBFDFF',
  },
  userTypeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
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
  submitButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  submitText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
  },
  message: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    marginTop: spacing.md,
    lineHeight: 18,
  },
  error: {
    color: colors.negative,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
});
