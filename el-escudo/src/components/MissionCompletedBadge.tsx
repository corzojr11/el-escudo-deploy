import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';

interface MissionCompletedBadgeProps {
  missionName: string;
  xpReward: number;
  visible: boolean;
  onClose: () => void;
}

export const MissionCompletedBadge: React.FC<MissionCompletedBadgeProps> = ({ missionName, xpReward, visible, onClose }) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 12, stiffness: 100 });
      opacity.value = withSpring(1, { damping: 12, stiffness: 100 });
    } else {
      scale.value = withSpring(0, { damping: 12, stiffness: 100 });
      opacity.value = withSpring(0, { damping: 12, stiffness: 100 });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
      <Animated.View style={[styles.badge, animatedStyle, styles.noPointerEvents]}>
        <Ionicons name="checkmark-circle" size={48} color={Colors.accent.gold} />
        <Text style={styles.title}>MISIÓN COMPLETADA</Text>
        <Text style={styles.missionName}>{missionName}</Text>
        {xpReward > 0 && (
          <Text style={styles.xpText}>+{xpReward} XP</Text>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  badge: {
    backgroundColor: Colors.bg.card,
    borderColor: Colors.accent.gold,
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    width: '80%',
    maxWidth: 320,
  },
  noPointerEvents: {
    pointerEvents: 'box-none',
  },
  title: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.lg,
    color: Colors.accent.gold,
    marginTop: Spacing.sm,
    letterSpacing: 1.5,
  },
  missionName: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.base,
    color: Colors.text.primary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  xpText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    color: Colors.accent.green,
    marginTop: Spacing.xs,
    fontWeight: '700',
  },
});
