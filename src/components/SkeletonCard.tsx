import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

interface SkeletonCardProps {
  lines?: number;
  height?: number;
}

export function SkeletonCard({ lines = 3, height = 120 }: SkeletonCardProps) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={[styles.card, { minHeight: height }]}>
      {Array.from({ length: lines }).map((_, idx) => (
        <Animated.View
          key={idx}
          style={[
            styles.line,
            {
              width: idx === lines - 1 ? '55%' : '100%',
              opacity: pulse,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  line: {
    height: 12,
    borderRadius: 8,
    backgroundColor: '#DDE7F2',
  },
});
