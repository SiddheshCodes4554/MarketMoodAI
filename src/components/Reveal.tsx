import React, { PropsWithChildren, useEffect, useRef } from 'react';
import { Animated } from 'react-native';

interface RevealProps extends PropsWithChildren {
  delay?: number;
}

export function Reveal({ children, delay = 0 }: RevealProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  const scale = useRef(new Animated.Value(0.985)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        damping: 16,
        stiffness: 150,
        mass: 0.8,
        overshootClamping: false,
        restDisplacementThreshold: 0.1,
        restSpeedThreshold: 0.1,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        delay,
        damping: 15,
        stiffness: 180,
        mass: 0.8,
        overshootClamping: false,
        restDisplacementThreshold: 0.1,
        restSpeedThreshold: 0.1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, scale, translateY]);

  return <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>{children}</Animated.View>;
}
