import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { LeaderboardEntry } from '../../types/api';

interface LeaderboardEntryRowProps {
  entry: LeaderboardEntry;
  isUser: boolean;
}

const LeaderboardEntryRow: React.FC<LeaderboardEntryRowProps> = ({ entry, isUser }) => {
  const rank = entry.rank;

  return (
    <View style={[styles.row, isUser && styles.rowUser]}>
      <View style={styles.rankContainer}>
        {rank <= 3 ? (
          <Ionicons
            name={rank === 1 ? 'trophy' : 'medal'}
            size={16}
            color={rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : '#CD7F32'}
          />
        ) : (
          <Text style={[styles.rankText, rank <= 10 && styles.rankTextHighlight]}>{rank}</Text>
        )}
      </View>

      <View style={styles.avatar}>
        <Text style={styles.avatarLetter}>{entry.name.charAt(0).toUpperCase()}</Text>
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, isUser && styles.nameUser]} numberOfLines={1}>
          {entry.name}
          {isUser && <Text style={styles.userBadge}> · TÚ</Text>}
        </Text>
        <Text style={styles.level}>Nivel {entry.level}</Text>
      </View>

      <View style={styles.xpContainer}>
        <Ionicons name="diamond-outline" size={10} color={Colors.accent.gold} />
        <Text style={styles.xpText}>{entry.xp.toLocaleString()}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  rowUser: {
    borderColor: Colors.border.cyan,
    backgroundColor: 'rgba(0, 229, 255, 0.03)',
  },
  rankContainer: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    color: Colors.text.muted,
  },
  rankTextHighlight: {
    color: Colors.accent.gold,
    fontWeight: '700',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bg.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
  },
  nameUser: {
    color: Colors.accent.cyan,
  },
  userBadge: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.accent.cyan,
  },
  level: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  xpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  xpText: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.sm,
    color: Colors.accent.gold,
  },
});

export default LeaderboardEntryRow;
