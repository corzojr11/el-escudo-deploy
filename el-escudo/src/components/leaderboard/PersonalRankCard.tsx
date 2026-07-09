import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { PersonalRankResponse } from '../../types/api';
import LeaderboardEntryRow from './LeaderboardEntryRow';

interface PersonalRankCardProps {
  data: PersonalRankResponse;
}

const PersonalRankCard: React.FC<PersonalRankCardProps> = ({ data }) => {
  const progress = data.next_milestone > 0 ? (data.xp / data.next_milestone) * 100 : 0;

  return (
    <View style={styles.container}>
      {/* Rank header */}
      <View style={styles.header}>
        <View style={styles.rankSection}>
          <Text style={styles.rankLabel}>TU POSICIÓN</Text>
          <Text style={styles.rank}>#{data.rank}</Text>
          {data.total_users > 0 && (
            <Text style={styles.total}>de {data.total_users} jugadores</Text>
          )}
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>{data.name.charAt(0).toUpperCase()}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Ionicons name="flash" size={14} color={Colors.accent.green} />
          <Text style={styles.statText}>Nivel {data.level}</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="diamond-outline" size={14} color={Colors.accent.gold} />
          <Text style={[styles.statText, styles.statXP]}>{data.xp.toLocaleString()} XP</Text>
        </View>
      </View>

      {/* XP progress bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Siguiente hito</Text>
          <Text style={styles.progressTarget}>{data.next_milestone.toLocaleString()} XP</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(100, progress)}%` }]} />
        </View>
      </View>

      {/* Nearby players */}
      {data.nearby_players.length > 0 && (
        <View style={styles.nearbySection}>
          <Text style={styles.nearbyTitle}>CERCANOS</Text>
          {data.nearby_players.map((p) => (
            <LeaderboardEntryRow key={p.player_id} entry={p} isUser={p.is_me} />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.gold,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rankSection: {
    gap: 2,
  },
  rankLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.accent.gold,
    letterSpacing: 2,
  },
  rank: {
    fontFamily: FontFamily.tech,
    fontSize: 36,
    color: Colors.accent.gold,
    lineHeight: 40,
  },
  total: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.bg.chip,
    borderWidth: 2,
    borderColor: Colors.border.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.xl,
    color: Colors.accent.gold,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
  },
  statXP: {
    color: Colors.accent.gold,
  },
  progressSection: {
    gap: 6,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  progressTarget: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.sm,
    color: Colors.accent.gold,
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.border.subtle,
    borderRadius: BorderRadius.xxs,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent.gold,
    borderRadius: BorderRadius.xxs,
  },
  nearbySection: {
    gap: Spacing.xs,
  },
  nearbyTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.xs,
    color: Colors.accent.cyan,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
});

export default PersonalRankCard;
