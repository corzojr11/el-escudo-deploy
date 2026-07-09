import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PlayerStats } from '../types';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { BorderRadius, Spacing } from '../theme/spacing';

/**
 * Props for the HudStatusBar component.
 */
interface HudStatusBarProps {
  /** Player statistics object containing XP, level, and credits. */
  stats: PlayerStats;
}

/**
 * HudStatusBar — Compact player stats HUD bar.
 *
 * Displays a thin status bar at the top of screens showing:
 * - App branding ("El Escudo") with shield icon
 * - Current XP pill
 * - Level pill
 * - Credits pill with diamond icon
 * - Thin XP progress track showing progress toward next level
 *
 * @component
 * @param {HudStatusBarProps} props - Component props
 * @param {PlayerStats} props.stats - Player statistics from the store
 * @example
 * ```tsx
 * <HudStatusBar stats={{ xpCurrent: 981, xpToNext: 1000, credits: 500, level: 5 }} />
 * ```
 */
const HudStatusBar: React.FC<HudStatusBarProps> = ({ stats }) => {
  const xpCurrent = stats?.xpCurrent || 0;
  const xpToNext = stats?.xpToNext || 1000;
  const xpPct = Math.min(xpCurrent / xpToNext, 1);
  const credits = stats?.credits || 0;
  const level = stats?.level || 1;

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        {/* Brand */}
        <View style={styles.brand}>
          <Ionicons name="shield-checkmark" size={15} color={Colors.accent.green} />
          <Text style={styles.brandName}>El Escudo</Text>
        </View>

        {/* Badges */}
        <View style={styles.badges}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{(xpCurrent || 0).toLocaleString()} XP</Text>
          </View>
          <View style={[styles.pill, styles.pillGreen]}>
            <Text style={[styles.pillText, styles.pillTextGreen]}>LVL {level}</Text>
          </View>
          <View style={styles.pill}>
            <Ionicons name="diamond-outline" size={9} color={Colors.accent.gold} />
            <Text style={[styles.pillText, { color: Colors.accent.gold }]}>
              {(credits || 0).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      {/* XP bar — thin 1px fill */}
      <View style={styles.xpTrack}>
        <View style={[styles.xpFill, { width: `${xpPct * 100}%` as any }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.bg.primary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical:   Spacing.sm + 2,
  },
  brand: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           7,
  },
  brandName: {
    fontFamily: FontFamily.techSemi,
    fontSize:   FontSize.md,
    color:      Colors.text.primary,
  },
  badges: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.xs,
  },
  pill: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    borderWidth:     1,
    borderColor:     Colors.border.default,
    borderRadius:    BorderRadius.full,
    paddingVertical:   3,
    paddingHorizontal: Spacing.sm,
  },
  pillGreen: {
    borderColor:     Colors.border.green,
    backgroundColor: '#0D2A1E',  // very dark green tint — not a glow
  },
  pillText: {
    fontFamily: FontFamily.mono,
    fontSize:   10,
    color:      Colors.text.secondary,
    fontWeight: '600',
  },
  pillTextGreen: {
    color: Colors.accent.green,
  },
  xpTrack: {
    height:          2,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow:        'hidden',
  },
  xpFill: {
    height:          2,
    backgroundColor: Colors.accent.green,
    boxShadow: `0 0 4px ${Colors.accent.green}`,
  },
});

export default HudStatusBar;
