import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { useAppStore } from '../../store';

/**
 * RestTimer — Floating countdown timer for workout rest periods.
 *
 * Automatically starts when a set is marked as done during a workout session.
 * Displays a floating pill at the bottom of the screen with a MM:SS countdown
 * and a dismiss button. Reads from the Zustand store's `health.restTimer` state
 * and ticks down via `tickRestTimer`.
 *
 * Renders `null` when no timer is active.
 *
 * @component
 * @example
 * ```tsx
 * <RestTimer />
 * ```
 */
const RestTimer: React.FC = () => {
  const { health, tickRestTimer, stopRestTimer } = useAppStore();
  const { current, isRunning } = health.restTimer;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && current > 0) {
      interval = setInterval(() => {
        tickRestTimer();
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, current, tickRestTimer]);

  if (!isRunning || current <= 0) return null;

  const minutes = Math.floor(current / 60);
  const seconds = current % 60;
  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <Ionicons name="timer-outline" size={20} color={Colors.text.primary} />
      <Text style={styles.time}>{timeString}</Text>
      <TouchableOpacity onPress={stopRestTimer} style={styles.stopBtn}>
        <Ionicons name="close" size={16} color={Colors.text.primary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: '#1C1C1F', // slightly lighter than bg
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: Colors.border.default,
    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
  },
  time: {
    fontFamily: FontFamily.mono,
    fontSize: 16,
    color: Colors.text.primary,
    marginHorizontal: Spacing.md,
  },
  stopBtn: {
    backgroundColor: Colors.bg.card,
    borderRadius: BorderRadius.md,
    padding: 2,
  }
});

export default RestTimer;
