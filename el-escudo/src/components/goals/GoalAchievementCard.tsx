import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Goal } from '../../types/api';

const UNIT_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  kg: 'barbell',
  COP: 'cash',
  días: 'flame',
  km: 'walk',
  min: 'timer',
  libros: 'book',
  horas: 'time',
  calorias: 'flame',
  pasos: 'footsteps',
};

const UNIT_LABELS: Record<string, string> = {
  kg: 'PESO',
  COP: 'AHORRO',
  días: 'RACHA',
  km: 'DISTANCIA',
  min: 'TIEMPO',
  libros: 'LECTURA',
  horas: 'ESTUDIO',
  calorias: 'ENERGÍA',
  pasos: 'ACTIVIDAD',
};

interface GoalAchievementCardProps {
  goal: Goal;
  completedAt?: string;
  xpEarned?: number;
  variant?: 'share' | 'inline';
}

const GoalAchievementCard: React.FC<GoalAchievementCardProps> = ({
  goal,
  completedAt,
  xpEarned = 500,
  variant = 'inline',
}) => {
  const isShare = variant === 'share';
  const icon = UNIT_ICONS[goal.unit] || 'trophy';
  const categoryLabel = UNIT_LABELS[goal.unit] || 'META';

  const completedDate = completedAt
    ? new Date(completedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

  const formatValue = (val: number, unit: string) => {
    if (unit === 'COP') {
      return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
    }
    return `${val.toLocaleString('es-MX')} ${unit}`;
  };

  return (
    <View style={[styles.container, isShare && styles.shareContainer]}>
      {/* Top accent line */}
      <View style={styles.accentLine} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={isShare ? 28 : 22} color={Colors.accent.gold} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.categoryLabel}>{categoryLabel}</Text>
          <Text style={styles.title}>META COMPLETADA</Text>
        </View>
      </View>

      {/* Goal name */}
      <Text style={styles.goalName}>{goal.name}</Text>

      {/* Target value */}
      <View style={styles.valueContainer}>
        <Text style={styles.valueLabel}>OBJETIVO ALCANZADO</Text>
        <Text style={styles.valueText}>{formatValue(goal.target_value, goal.unit)}</Text>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Footer info */}
      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Ionicons name="calendar-outline" size={12} color={Colors.text.muted} />
          <Text style={styles.footerText}>{completedDate}</Text>
        </View>
        <View style={styles.footerItem}>
          <Ionicons name="diamond-outline" size={12} color={Colors.accent.gold} />
          <Text style={[styles.footerText, styles.xpText]}>+{xpEarned} XP</Text>
        </View>
      </View>

      {/* Branding */}
      <View style={styles.branding}>
        <Ionicons name="shield-checkmark" size={10} color={Colors.text.muted} />
        <Text style={styles.brandText}>EL ESCUDO</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.gold,
    borderRadius: 16,
    padding: 20,
    gap: 12,
    overflow: 'hidden',
  },
  shareContainer: {
    width: 340,
    minHeight: 280,
    backgroundColor: '#0A0A0B',
    borderColor: Colors.border.gold,
    borderWidth: 2,
  },
  accentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.accent.gold,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  headerText: {
    flex: 1,
  },
  categoryLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.accent.gold,
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: {
    fontFamily: FontFamily.tech,
    fontSize: 14,
    color: Colors.text.primary,
    letterSpacing: 1,
  },
  goalName: {
    fontFamily: FontFamily.sans,
    fontSize: 18,
    color: Colors.text.primary,
    fontWeight: '600',
    lineHeight: 24,
  },
  valueContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.1)',
  },
  valueLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.text.muted,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  valueText: {
    fontFamily: FontFamily.tech,
    fontSize: 22,
    color: Colors.accent.gold,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border.subtle,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    color: Colors.text.muted,
  },
  xpText: {
    color: Colors.accent.gold,
    fontWeight: '700',
  },
  branding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
    marginTop: 4,
  },
  brandText: {
    fontFamily: FontFamily.mono,
    fontSize: 8,
    color: Colors.text.muted,
    letterSpacing: 2,
  },
});

export default GoalAchievementCard;
