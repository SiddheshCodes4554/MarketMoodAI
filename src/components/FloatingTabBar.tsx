import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadows, radius, spacing } from '../constants/theme';

export const FLOATING_TAB_BAR_HEIGHT = 64;

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { bottom: Math.max(16, insets.bottom + 10) }]}>
      <View style={styles.content}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          let iconName: keyof typeof Ionicons.glyphMap = 'help-circle';
          if (route.name === 'Dashboard') iconName = 'home';
          else if (route.name === 'StockExplorer') iconName = 'search';
          else if (route.name === 'OpportunityRadar') iconName = 'scan-circle';
          else if (route.name === 'WhyMoved') iconName = 'pulse';
          else if (route.name === 'NewsSentiment') iconName = 'newspaper';
          else if (route.name === 'MarketChat') iconName = 'chatbubble-ellipses';

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={[styles.tabItem, isFocused && styles.tabItemFocused]}
            >
              <Ionicons
                name={iconName}
                size={22}
                color={isFocused ? colors.textPrimary : colors.textSecondary}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: width,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    pointerEvents: 'box-none',
  },
  content: {
    flexDirection: 'row',
    backgroundColor: colors.navBackground,
    width: Math.min(width - spacing.lg, 420),
    height: FLOATING_TAB_BAR_HEIGHT,
    borderRadius: radius.xl,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    ...shadows.floating,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  tabItemFocused: {
    backgroundColor: '#FFFFFF',
  },
});
