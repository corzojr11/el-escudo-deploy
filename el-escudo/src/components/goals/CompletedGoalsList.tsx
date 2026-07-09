import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { useAppStore } from '../../store';
import GoalShareButton from './GoalShareButton';

const UNIT_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  kg: 'barbell',
  COP: 'cash',
  días: 'flame',
  km: 'walk',
  min: 'timer',
  libros: 'book',
  horas: 'time',
};

const CompletedGoalsList: React.FC = () => {
  const goals = useAppStore((state) => state.goals);
  const completedGoals = goals.filter((g) => g.status === 'completed');

  if (completedGoals.length === 0) return null;

  const formatValue = (val: number, unit: string) => {
    if (unit === 'COP') {
      return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
    }
    return `${val} ${unit}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="trophy" size={14} color={Colors.accent.gold} />
        <Text style={styles.headerTitle}>METAS COMPLETADAS</Text>
        <Text style={styles.headerCount}>{completedGoals.length}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {completedGoals.map((goal) => {
          const icon = UNIT_ICONS[goal.unit] || 'trophy';
          return (
            <View key={goal.id} style={styles.goalCard}>
              <View style={styles.goldAccent} />

              <View style={styles.goalHeader}>
                <View style={styles.iconCircle}>
                  <Ionicons name={icon} size={18} color={Colors.accent.gold} />
                </View>
                <View style={styles.goalInfo}>
                  <Text style={styles.goalName}>{goal.name}</Text>
                  <Text style={styles.goalValue}>{formatValue(goal.target_value, goal.unit)}</Text>
                </View>
              </View>

              <View style={styles.xpBadge}>
                <Ionicons name="diamond-outline" size={10} color={Colors.accent.gold} />
                <Text style={styles.xpText}>+500 XP</Text>
              </View>

              <GoalShareButton goal={goal} xpEarned={500} />
            </View>
          );
        })}
      </ScrollView>
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
    color: Colors.accent.gold,
    letterSpacing: 1.5,
  },
  headerCount: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  scrollContent: {
    gap: Spacing.sm,
    paddingRight: Spacing.base,
  },
  goalCard: {
    width: 200,
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    overflow: 'hidden',
  },
  goldAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.accent.gold,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.15)',
  },
  goalInfo: {
    flex: 1,
  },
  goalName: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
    lineHeight: 18,
  },
  goalValue: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.accent.gold,
    marginTop: 2,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderRadius: BorderRadius.full,
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
  },
  xpText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.accent.gold,
    fontWeight: '700',
  },
});

export default CompletedGoalsList;
