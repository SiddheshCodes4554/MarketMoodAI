import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';

interface SentimentBarProps {
  value: number;
  labelLeft?: string;
  labelRight?: string;
  showValue?: boolean;
}

function toneColor(score: number): string {
  if (score >= 60) {
    return colors.positive;
  }

  if (score <= 40) {
    return colors.negative;
  }

  return colors.neutral;
}

export function SentimentBar({ value, labelLeft = 'Bearish', labelRight = 'Bullish', showValue = true }: SentimentBarProps) {
  const width = `${Math.max(0, Math.min(100, value))}%` as `${number}%`;
  const fillColor = toneColor(value);

  return (
    <View>
      <View style={styles.row}>
        <Text style={styles.label}>{labelLeft}</Text>
        {showValue ? <Text style={styles.value}>{value}/100</Text> : null}
        <Text style={styles.label}>{labelRight}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width, backgroundColor: fillColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
  },
  value: {
    color: colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
  },
  track: {
    height: 12,
    borderRadius: 999,
    backgroundColor: '#E5EDF6',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
});
