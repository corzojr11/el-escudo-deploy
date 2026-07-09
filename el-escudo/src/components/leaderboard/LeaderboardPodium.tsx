import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { LeaderboardEntry } from '../../types/api';

interface LeaderboardPodiumProps {
  top3: LeaderboardEntry[];
}

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
const MEDAL_ICONS: (React.ComponentProps<typeof Ionicons>['name'] | null)[] = ['trophy', 'medal', 'medal'];
const PODIUM_HEIGHTS = [80, 60, 48];

const LeaderboardPodium: React.FC<LeaderboardPodiumProps> = ({ top3 }) => {
  if (top3.length === 0) return null;

  const ordered = [top3[1], top3[0], top3[2]].filter(Boolean);
  const positions = [2, 1, 3];

  return (
    <View style={styles.container}>
      <View style={styles.podiumRow}>
        {ordered.map((entry, idx) => {
          if (!entry) return null;
          const pos = positions[idx];
          const color = MEDAL_COLORS[pos - 1];
          const icon = MEDAL_ICONS[pos - 1];
          const height = PODIUM_HEIGHTS[pos - 1];

          return (
            <View key={entry.player_id} style={[styles.podiumColumn, pos === 1 && styles.podiumCenter]}>
              <View style={styles.avatarWrapper}>
                <View style={[styles.avatar, { borderColor: color }]}>
                  <Text style={[styles.avatarLetter, { color }]}>{entry.name.charAt(0).toUpperCase()}</Text>
                </View>
                {icon && (
                  <View style={[styles.medalBadge, { backgroundColor: color }]}>
                    <Ionicons name={icon} size={10} color="#0A0A0B" />
                  </View>
                )}
              </View>
              <Text style={styles.name} numberOfLines={1}>{entry.name}</Text>
              <Text style={styles.level}>Nivel {entry.level}</Text>
              <View style={styles.xpRow}>
                <Ionicons name="diamond-outline" size={8} color={color} />
                <Text style={[styles.xp, { color }]}>{entry.xp.toLocaleString()}</Text>
              </View>
              <View style={[styles.podiumBlock, { height, backgroundColor: color + '15', borderColor: color + '40' }]}>
                <Text style={[styles.podiumRank, { color }]}>{pos}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.md,
  },
  podiumRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: Spacing.md,
  },
  podiumColumn: {
    alignItems: 'center',
    gap: 6,
  },
  podiumCenter: {
    marginTop: -12,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.bg.card,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.lg,
  },
  medalBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.bg.primary,
  },
  name: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
    maxWidth: 80,
    textAlign: 'center',
  },
  level: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  xp: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.xs,
  },
  podiumBlock: {
    width: 72,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  podiumRank: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.xxl,
  },
});

export default LeaderboardPodium;
