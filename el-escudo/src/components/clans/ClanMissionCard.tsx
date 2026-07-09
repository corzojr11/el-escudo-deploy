import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { ClanMission } from '../../types/api';

interface ClanMissionCardProps {
  mission: ClanMission;
  clanColor: string;
  canReport: boolean;
  onReportProgress: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: 'ACTIVA',     color: Colors.accent.green, bg: Colors.accent.green + '15' },
  completed: { label: 'COMPLETADA', color: Colors.accent.gold,  bg: Colors.accent.gold + '15' },
  failed:    { label: 'FALLIDA',    color: Colors.accent.red,   bg: Colors.accent.red + '15' },
};

const ClanMissionCard: React.FC<ClanMissionCardProps> = ({ mission, clanColor, canReport, onReportProgress }) => {
  const config = STATUS_CONFIG[mission.status] || STATUS_CONFIG.active;
  const progress = mission.target_value > 0 ? (mission.current_value / mission.target_value) * 100 : 0;
  const barColor = mission.status === 'completed' ? Colors.accent.gold : mission.status === 'failed' ? Colors.accent.red : clanColor;

  const endsAt = mission.ends_at ? new Date(mission.ends_at) : null;
  const daysLeft = endsAt ? Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;

  return (
    <View style={[styles.card, { borderColor: barColor + '40' }]}>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>{mission.name}</Text>
        <View style={[styles.badge, { backgroundColor: config.bg }]}>
          <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>

      {mission.description && (
        <Text style={styles.description} numberOfLines={2}>{mission.description}</Text>
      )}

      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Progreso grupal</Text>
          <Text style={styles.progressPct}>{Math.round(progress)}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(100, progress)}%`, backgroundColor: barColor }]} />
        </View>
        <Text style={styles.progressValues}>
          {mission.current_value} / {mission.target_value} {mission.unit}
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Ionicons name="diamond-outline" size={10} color={Colors.accent.gold} />
          <Text style={[styles.footerText, styles.xpText]}>+{mission.xp_reward} XP</Text>
        </View>
        {daysLeft !== null && mission.status === 'active' && (
          <View style={styles.footerItem}>
            <Ionicons name="hourglass-outline" size={10} color={Colors.text.muted} />
            <Text style={styles.footerText}>{daysLeft}d</Text>
          </View>
        )}
        {canReport && mission.status === 'active' && (
          <TouchableOpacity style={styles.reportBtn} onPress={onReportProgress} activeOpacity={0.7}>
            <Ionicons name="sync-outline" size={12} color={clanColor} />
            <Text style={[styles.reportText, { color: clanColor }]}>REPORTAR</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
    flex: 1,
  },
  badge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: Spacing.sm,
  },
  badgeText: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: '700',
  },
  description: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    lineHeight: 16,
  },
  progressSection: { gap: Spacing.xs },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  progressPct: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.xs,
    color: Colors.accent.green,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.border.subtle,
    borderRadius: BorderRadius.xxs,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BorderRadius.xxs,
  },
  progressValues: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  xpText: { color: Colors.accent.gold, fontWeight: '700' },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border.green,
    backgroundColor: Colors.accent.green + '10',
  },
  reportText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
});

export default ClanMissionCard;
