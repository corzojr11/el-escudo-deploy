import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';

interface ToastNotificationProps {
  message: string;
  visible: boolean;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ message, visible }) => {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();

      setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: 100, duration: 200, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start();
      }, 2500);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY }], opacity },
      ]}
    >
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: Spacing.base,
    right: Spacing.base,
    backgroundColor: Colors.bg.card,
    borderColor: Colors.accent.green,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    zIndex: 100,
  },
  message: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
    textAlign: 'center',
  },
});
