import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { BorderRadius, Spacing } from '../theme/spacing';
import { useAppStore } from '../store';

/**
 * Maps goal units to their corresponding Ionicons icon names.
 */
const UNIT_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  kg: 'barbell',
  COP: 'cash',
  días: 'flame',
  km: 'walk',
  min: 'timer',
  libros: 'book',
  horas: 'time',
};

/**
 * GoalsWidget — Displays a list of active user goals with progress bars.
 *
 * Reads active goals from the Zustand store and renders each as a card showing:
 * - Unit-specific icon
 * - Goal name
 * - Current vs target value (formatted for COP currency)
 * - Percentage progress with visual progress bar
 *
 * Renders `null` when there are no active goals.
 *
 * @component
 * @example
 * ```tsx
 * <GoalsWidget />
 * ```
 */
const GoalsWidget: React.FC = () => {
  const goals = useAppStore((state) => state.goals);
  const activeGoals = goals.filter((g) => g.status === 'active');

  if (activeGoals.length === 0) return null;

  const formatValue = (val: number, unit: string) => {
    if (unit === 'COP') {
      return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
    }
    return `${val} ${unit}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="flag" size={14} color={Colors.accent.cyan} />
        <Text style={styles.headerTitle}>METAS ACTIVAS</Text>
        <Text style={styles.headerCount}>{activeGoals.length}</Text>
      </View>
      {activeGoals.map((goal) => {
        const progress = Math.min(1, goal.current_value / goal.target_value);
        const icon = UNIT_ICONS[goal.unit] || 'navigate';
        return (
          <View key={goal.id} style={styles.goalCard}>
            <View style={styles.goalHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name={icon} size={16} color={Colors.accent.green} />
              </View>
              <View style={styles.goalInfo}>
                <Text style={styles.goalName}>{goal.name}</Text>
                <Text style={styles.goalValues}>
                  {formatValue(goal.current_value, goal.unit)}{' '}
                  <Text style={styles.goalSeparator}>/</Text>{' '}
                  {formatValue(goal.target_value, goal.unit)}
                </Text>
              </View>
              <Text style={styles.goalPercent}>{Math.round(progress * 100)}%</Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: 2,
  },
  headerTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.xs,
    color: Colors.accent.cyan,
    letterSpacing: 1.5,
  },
  headerCount: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  goalCard: {
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(0, 255, 157, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalInfo: {
    flex: 1,
  },
  goalName: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
  },
  goalValues: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  goalSeparator: {
    color: Colors.text.muted,
  },
  goalPercent: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.sm,
    color: Colors.accent.green,
  },
  progressBg: {
    height: 4,
    backgroundColor: Colors.border.subtle,
    borderRadius: BorderRadius.xxs,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent.green,
    borderRadius: BorderRadius.xxs,
  },
});

export default GoalsWidget;
