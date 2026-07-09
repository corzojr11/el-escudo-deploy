import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';

interface AchievementUnlockedModalProps {
  name: string;
  description: string;
  visible: boolean;
}

export const AchievementUnlockedModal: React.FC<AchievementUnlockedModalProps> = ({ name, description, visible }) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 12 });
      opacity.value = withSpring(1, { damping: 12 });
    } else {
      scale.value = withSpring(0, { damping: 12 });
      opacity.value = withSpring(0, { damping: 12 });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.touchable} activeOpacity={1} onPress={() => {}} />
      <Animated.View style={[styles.modal, animatedStyle]}>
        <Ionicons name="trophy" size={44} color={Colors.accent.gold} />
        <Text style={styles.title}>LOGRO DESBLOQUEADO</Text>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.description}>{description}</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 120,
    zIndex: 100,
  },
  touchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modal: {
    backgroundColor: Colors.bg.card,
    borderColor: Colors.accent.cyan,
    borderWidth: 1,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xl,
    alignItems: 'center',
    maxWidth: '90%',
  },
  title: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.lg,
    color: Colors.accent.gold,
    marginTop: Spacing.md,
    letterSpacing: 1,
  },
  name: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.base,
    color: Colors.text.primary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  description: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    color: Colors.text.muted,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
});
