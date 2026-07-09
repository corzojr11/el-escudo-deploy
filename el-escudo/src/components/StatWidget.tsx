import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { BorderRadius, Spacing } from '../theme/spacing';

/** Available accent color themes for the widget. */
export type WidgetAccent = 'orange' | 'gold' | 'purple' | 'green' | 'cyan' | 'red';
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Props for the StatWidget component.
 */
interface StatWidgetProps {
  /** Ionicon name to display as the background watermark icon. */
  iconName: IoniconName;
  /** Short uppercase label shown above the value (e.g., "XP TOTAL"). */
  label: string;
  /** Primary value string displayed prominently. */
  value: string;
  /** Secondary descriptive text shown below the value. */
  subtitle: string;
  /** Accent color theme that controls icon, dot, and value colors. */
  accent: WidgetAccent;
}

/** Maps accent keys to their corresponding hex color values. */
const ACCENT_COLOR: Record<WidgetAccent, string> = {
  orange: '#FF9500',
  gold:   Colors.accent.gold,
  purple: '#AF52DE',
  green:  Colors.accent.green,
  cyan:   Colors.accent.cyan,
  red:    Colors.accent.red,
};

/**
 * StatWidget — A compact stat display card with accent theming.
 *
 * Renders a glassmorphic card (using `BlurView` on native, `View` on web) showing:
 * - A colored accent dot and uppercase label
 * - A prominent value in the accent color
 * - A subtitle for context
 * - A large watermark icon in the background
 *
 * @component
 * @param {StatWidgetProps} props - Component props
 * @param {IoniconName} props.iconName - Background icon name
 * @param {string} props.label - Uppercase label above the value
 * @param {string} props.value - Primary displayed value
 * @param {string} props.subtitle - Secondary context text
 * @param {WidgetAccent} props.accent - Color theme for the widget
 * @example
 * ```tsx
 * <StatWidget
 *   iconName="star"
 *   label="XP TOTAL"
 *   value="4,905"
 *   subtitle="Nivel 5 — Cabo Primero"
 *   accent="gold"
 * />
 * ```
 */
const StatWidget: React.FC<StatWidgetProps> = ({ iconName, label, value, subtitle, accent }) => {
  const color = ACCENT_COLOR[accent];
  const Wrapper = Platform.OS === 'web' ? View : BlurView;

  return (
    <Wrapper intensity={40} tint="dark" style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconDot, { backgroundColor: color }]} />
        <Text style={styles.label}>{label.toUpperCase()}</Text>
      </View>

      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      
      <Ionicons 
        name={iconName} 
        size={32} 
        color={color} 
        style={styles.bgIcon} 
      />
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  card: {
    flex:             1,
    backgroundColor:  'rgba(255, 255, 255, 0.03)',
    borderRadius:     20,
    borderWidth:      1,
    borderColor:      'rgba(255, 255, 255, 0.08)',
    padding:          Spacing.lg,
    gap:              8,
    minHeight:        120,
    overflow:         'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  iconDot: {
    width:  6,
    height: 6,
    borderRadius: BorderRadius.xxs,
  },
  label: {
    fontFamily:    FontFamily.mono,
    fontSize:      10,
    color:         Colors.text.muted,
    letterSpacing: 2,
  },
  value: {
    fontFamily:    FontFamily.mono,
    fontSize:      26,
    fontWeight:    '700',
    letterSpacing: -1,
  },
  subtitle: {
    fontFamily: FontFamily.techRegular,
    fontSize:   12,
    color:      Colors.text.muted,
  },
  bgIcon: {
    position: 'absolute',
    right:    -8,
    bottom:   -8,
    opacity:  0.05,
    transform: [{ rotate: '-15deg' }],
  },
});

export default StatWidget;
