import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { BorderRadius, Spacing } from '../theme/spacing';

/** Abbreviated Spanish day-of-week labels (Mon-Sun). */
const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/**
 * Props for the RachaWidget component.
 */
interface RachaWidgetProps {
  /** Total number of active days in the current streak. */
  days: number;
  /** Array of 7 booleans indicating which days of the week are active. */
  activeDays: boolean[];
}

/**
 * RachaWidget — Weekly streak tracker with animated day indicators.
 *
 * Displays the user's current weekly streak as a card with:
 * - Flame icon and total active days count
 * - "Hecho" completion chip
 * - 7-day dot grid with animated entrance, showing active/inactive days
 *
 * @component
 * @param {RachaWidgetProps} props - Component props
 * @param {number} props.days - Current streak day count
 * @param {boolean[]} props.activeDays - Array of 7 booleans for weekly activity
 * @example
 * ```tsx
 * <RachaWidget days={5} activeDays={[true, true, false, true, true, true, false]} />
 * ```
 */
const RachaWidget: React.FC<RachaWidgetProps> = ({ days, activeDays }) => {
  const dotScales = useRef(DAY_LABELS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(
      50,
      dotScales.map(s =>
        Animated.spring(s, { toValue: 1, tension: 90, friction: 9, useNativeDriver: Platform.OS !== 'web' })
      )
    ).start();
  }, []);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons name="flame" size={18} color={Colors.accent.orange} />
        </View>
        <View>
          <Text style={styles.label}>RACHA SEMANAL</Text>
          <Text style={styles.daysVal}>
            {days} <Text style={styles.daysSuf}>días</Text>
          </Text>
        </View>
        <View style={styles.doneChip}>
          <Ionicons name="checkmark" size={11} color={Colors.accent.green} />
          <Text style={styles.doneText}>Hecho</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Dot row */}
      <View style={styles.dotsRow}>
        {DAY_LABELS.map((lbl, i) => {
          const active = activeDays[i] ?? false;
          return (
            <Animated.View
              key={i}
              style={[styles.dayCell, { transform: [{ scale: dotScales[i] }] }]}
            >
              <Text style={styles.dayLabel}>{lbl}</Text>
              <View style={[styles.dot, active ? styles.dotOn : styles.dotOff]} />
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg.card,
    borderRadius:    BorderRadius.lg,
    borderWidth:     1,
    borderColor:     Colors.border.default,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent.orange,
    padding:         Spacing.base,
    gap:             Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.sm,
  },
  iconBox: {
    width:           38,
    height:          38,
    borderRadius:    BorderRadius.md,
    backgroundColor: '#1C1C1F',
    borderWidth:     1,
    borderColor:     Colors.border.default,
    alignItems:      'center',
    justifyContent:  'center',
  },
  label: {
    fontFamily:    FontFamily.mono,
    fontSize:      8.5,
    color:         Colors.text.muted,
    letterSpacing: 1,
  },
  daysVal: {
    fontFamily: FontFamily.tech,
    fontSize:   FontSize.xl,
    color:      Colors.text.primary,
    lineHeight: FontSize.xl * 1.2,
    marginTop:  2,
  },
  daysSuf: {
    fontFamily: FontFamily.techRegular,
    fontSize:   FontSize.base,
    color:      Colors.text.secondary,
  },
  doneChip: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    marginLeft:      'auto',
    borderWidth:     1,
    borderColor:     Colors.border.green,
    borderRadius:    BorderRadius.md,
    paddingVertical:   4,
    paddingHorizontal: Spacing.sm,
  },
  doneText: {
    fontFamily: FontFamily.techSemi,
    fontSize:   FontSize.sm,
    color:      Colors.accent.green,
  },
  divider: {
    height:          1,
    backgroundColor: Colors.border.subtle,
  },
  dotsRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  dayCell: {
    alignItems: 'center',
    gap:        6,
  },
  dayLabel: {
    fontFamily: FontFamily.mono,
    fontSize:   9,
    color:      Colors.text.muted,
  },
  dot: {
    width:        26,
    height:       26,
    borderRadius: BorderRadius.full,
  },
  dotOn: {
    backgroundColor: Colors.accent.green,
  },
  dotOff: {
    backgroundColor: '#27272A',
    borderWidth:     1,
    borderColor:     Colors.border.subtle,
  },
});

export default RachaWidget;
