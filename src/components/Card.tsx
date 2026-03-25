import React, { PropsWithChildren, memo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, shadows, spacing } from '../constants/theme';

interface CardProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>;
}

function CardBase({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export const Card = memo(CardBase);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
});
