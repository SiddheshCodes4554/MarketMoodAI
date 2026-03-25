import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useAppMode } from '../context/AppModeContext';
import { colors, spacing } from '../constants/theme';

export function DemoModeToggle() {
  const { appMode, toggleAppMode } = useAppMode();
  const demoMode = appMode === 'demo';

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.title}>Demo Mode</Text>
        <Text style={styles.subtitle}>{demoMode ? 'ON (mock-safe)' : 'OFF (live APIs)'}</Text>
      </View>
      <Switch
        trackColor={{ false: '#C4CEDB', true: '#8DC4FF' }}
        thumbColor={demoMode ? '#FFFFFF' : '#F4F7FB'}
        value={demoMode}
        onValueChange={() => void toggleAppMode()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardAlt,
    borderRadius: 16,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderColor: colors.border,
    borderWidth: 1,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
});
