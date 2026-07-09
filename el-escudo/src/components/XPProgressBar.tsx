import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { Spacing } from '../theme/spacing';

interface XPProgressBarProps {
  level: number;
  xpCurrent: number;
  xpToNext: number;
}

export const XPProgressBar: React.FC<XPProgressBarProps> = ({ level, xpCurrent, xpToNext }) => {
  const progress = xpToNext > 0 ? xpCurrent / xpToNext : 0;
  const widthAnim = useSharedValue(0);

  useEffect(() => {
    widthAnim.value = withSpring(progress * 100, { damping: 15, stiffness: 100 });
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${widthAnim.value}%`,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.levelLabel}>NIVEL {level}</Text>
        <Text style={styles.xpLabel}>
          {xpCurrent} / {xpToNext} XP
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, animatedStyle]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xxs,
  },
  levelLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    letterSpacing: 1,
  },
  xpLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  track: {
    height: 6,
    backgroundColor: Colors.border.subtle,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: Colors.accent.gold,
    borderRadius: 3,
  },
});
