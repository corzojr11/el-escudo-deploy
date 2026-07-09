import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { ClanSummary } from '../../types/api';

interface ClanCardProps {
  clan: ClanSummary;
  onPress: (clan: ClanSummary) => void;
}

const ClanCard: React.FC<ClanCardProps> = ({ clan, onPress }) => {
  const isFull = clan.member_count >= clan.max_members;

  return (
    <TouchableOpacity
      style={[styles.card, { borderColor: clan.color + '60' }]}
      onPress={() => onPress(clan)}
      activeOpacity={0.7}
    >
      <View style={[styles.colorAccent, { backgroundColor: clan.color }]} />

      <View style={styles.header}>
        {clan.tag && (
          <View style={[styles.tagBadge, { backgroundColor: clan.color + '30' }]}>
            <Text style={[styles.tagText, { color: clan.color }]}>{clan.tag}</Text>
          </View>
        )}
        {isFull && (
          <View style={styles.fullBadge}>
            <Text style={styles.fullText}>LLENO</Text>
          </View>
        )}
      </View>

      <Text style={styles.name} numberOfLines={1}>{clan.name}</Text>

      {clan.description && (
        <Text style={styles.description} numberOfLines={2}>{clan.description}</Text>
      )}

      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Ionicons name="people-outline" size={12} color={Colors.text.muted} />
          <Text style={styles.footerText}>{clan.member_count}/{clan.max_members}</Text>
        </View>
        <View style={styles.footerItem}>
          <Ionicons name="diamond-outline" size={12} color={Colors.accent.gold} />
          <Text style={[styles.footerText, styles.xpText]}>{clan.total_xp.toLocaleString()}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    overflow: 'hidden',
  },
  colorAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  fullBadge: {
    backgroundColor: Colors.accent.red + '20',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fullText: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.accent.red,
    fontWeight: '700',
  },
  name: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.md,
    color: Colors.text.primary,
  },
  description: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  xpText: {
    color: Colors.accent.gold,
    fontWeight: '700',
  },
});

export default ClanCard;
