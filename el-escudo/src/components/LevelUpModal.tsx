import React, { useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { PressableScale } from './PressableScale';

interface LevelUpModalProps {
  visible: boolean;
  newLevel: number;
  newTitle: string;
  onClose: () => void;
}

export const LevelUpModal: React.FC<LevelUpModalProps> = ({ visible, newLevel, newTitle, onClose }) => {
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 12, stiffness: 100 });
      opacity.value = withSpring(1, { damping: 12, stiffness: 100 });
    } else {
      scale.value = 0.5;
      opacity.value = 0;
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Animated.View style={[styles.card, animatedStyle, styles.noPointerEvents]}>
          <Ionicons name="trophy" size={56} color={Colors.accent.gold} style={styles.icon} />
          <Text style={styles.levelText}>NIVEL {newLevel} ALCANZADO</Text>
          <Text style={styles.titleText}>{newTitle}</Text>
          <Text style={styles.subtitleText}>Has subido de nivel</Text>
          <PressableScale style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>CONTINUAR</Text>
          </PressableScale>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.bg.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  card: {
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  noPointerEvents: {
    pointerEvents: 'box-none',
  },
  icon: {
    marginBottom: Spacing.md,
  },
  levelText: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.xxl,
    color: Colors.accent.gold,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  titleText: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.lg,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitleText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    color: Colors.text.muted,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  button: {
    backgroundColor: Colors.accent.green + '20',
    borderWidth: 1,
    borderColor: Colors.accent.green,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.base,
    color: Colors.accent.green,
    letterSpacing: 1.5,
  },
});
