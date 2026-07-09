import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';

interface StreakBadgeProps {
  days: number;
}

export const StreakBadge: React.FC<StreakBadgeProps> = ({ days }) => {
  const isActive = days > 0;
  const color = isActive ? Colors.accent.orange : Colors.text.muted;
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isActive) {
      scale.value = withRepeat(
        withTiming(1.15, { duration: 750 }),
        -1,
        true
      );
    } else {
      scale.value = 1;
    }
  }, [isActive]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={[styles.badge, {
      backgroundColor: isActive ? Colors.accent.orange + '15' : Colors.border.subtle,
      borderColor: isActive ? Colors.accent.orange + '30' : Colors.border.default,
    }]}>
      <Animated.View style={animatedIconStyle}>
        <Ionicons name="flame" size={14} color={color} />
      </Animated.View>
      <Text style={[styles.label, { color }]}>
        {days} DÍAS
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  label: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    marginLeft: Spacing.xs,
  },
});
