import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';

interface XPFloatAnimationProps {
  amount: number;
  visible: boolean;
  onComplete?: () => void;
}

export const XPFloatAnimation: React.FC<XPFloatAnimationProps> = ({ amount, visible, onComplete }) => {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = 0;
      opacity.value = 1;

      translateY.value = withTiming(-60, {
        duration: 800,
        easing: Easing.out(Easing.ease),
      });
      opacity.value = withTiming(0, {
        duration: 800,
        easing: Easing.out(Easing.ease),
      }, () => {
        onComplete?.();
      });
    } else {
      translateY.value = 0;
      opacity.value = 0;
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle, styles.noPointerEvents]}>
      <Animated.Text style={styles.text}>+{amount} XP</Animated.Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '30%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  noPointerEvents: {
    pointerEvents: 'none',
  },
  text: {
    color: Colors.accent.green,
    fontFamily: FontFamily.tech,
    fontSize: FontSize.xxl,
    letterSpacing: 2,
  },
});
