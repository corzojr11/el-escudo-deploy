import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';

/**
 * Props for the CircularProgress component.
 */
interface CircularProgressProps {
  /** Progress value from 0 to 100. */
  percentage: number;
  /** Outer radius of the circle in pixels (default: `45`). */
  radius?: number;
  /** Stroke width of the ring in pixels (default: `8`). */
  strokeWidth?: number;
  /** Stroke color for the progress arc (default: `Colors.accent.emerald`). */
  color?: string;
  /** Text displayed in the center. Defaults to the rounded percentage with `%`. */
  label?: string;
  /** Optional secondary text displayed below the label. */
  subLabel?: string;
}

/**
 * CircularProgress — SVG-based circular progress indicator.
 *
 * Renders an animated ring showing a percentage value with optional center labels.
 * Uses `react-native-svg` for smooth vector rendering with a rounded stroke cap.
 *
 * @component
 * @param {CircularProgressProps} props - Component props
 * @param {number} props.percentage - Progress value (0-100)
 * @param {number} [props.radius=45] - Circle radius
 * @param {number} [props.strokeWidth=8] - Ring stroke width
 * @param {string} [props.color] - Progress arc color
 * @param {string} [props.label] - Center label text
 * @param {string} [props.subLabel] - Secondary center text
 * @example
 * ```tsx
 * <CircularProgress percentage={75} color="#10B981" label="75%" subLabel="Completado" />
 * ```
 */
const CircularProgress: React.FC<CircularProgressProps> = ({ 
  percentage, 
  radius = 45, 
  strokeWidth = 8,
  color = Colors.accent.green,
  label,
  subLabel
}) => {
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View style={styles.container}>
      <Svg height={radius * 2} width={radius * 2}>
        <Circle
          stroke={Colors.border.strong}
          fill="transparent"
          strokeWidth={strokeWidth}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <Circle
          stroke={color}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          rotation="-90"
          originX={radius}
          originY={radius}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFillObject, styles.textContainer]}>
        <Text style={[styles.label, { color }]}>{label || `${Math.round(percentage)}%`}</Text>
        {subLabel && <Text style={styles.subLabel}>{subLabel}</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.lg,
  },
  subLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.text.muted,
    marginTop: 2,
  }
});

export default CircularProgress;
