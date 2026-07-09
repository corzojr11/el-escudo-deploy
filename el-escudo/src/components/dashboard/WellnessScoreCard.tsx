import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';

export interface WellnessMetric {
  icon: string;
  label: string;
  value: string | number;
}

export interface WellnessScoreCardProps {
  score: number;
  color: string;
  subtitle: string;
  metrics: WellnessMetric[];
  onPress?: () => void;
}

export const WellnessScoreCard: React.FC<WellnessScoreCardProps> = React.memo(({ score, color, subtitle, metrics, onPress }) => {
  if (onPress) {
    return (
      <TouchableOpacity style={styles.wellnessCard} onPress={onPress} activeOpacity={0.85} accessibilityRole="button">
        <View style={styles.wellnessMain}>
          <View style={[styles.wellnessCircle, { borderColor: color }]}>
            <Text style={[styles.wellnessScoreText, { color }]}>{score}</Text>
            <Text style={styles.wellnessLabel}>/100</Text>
          </View>
          <View style={styles.wellnessInfo}>
            <Text style={styles.wellnessTitle}>BIENESTAR HOY</Text>
            <Text style={styles.wellnessSubtitle}>{subtitle}</Text>
            <View style={styles.wellnessBreakdown}>
              {metrics.map((metric) => (
                <View key={`${metric.label}-${metric.value}`} style={styles.wellnessMetric}>
                  <Ionicons name={metric.icon as any} size={10} color={Colors.text.muted} />
                  <Text style={styles.wellnessMetricText}>
                    {metric.label} {metric.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.wellnessCard}>
      <View style={styles.wellnessMain}>
        <View style={[styles.wellnessCircle, { borderColor: color }]}>
          <Text style={[styles.wellnessScoreText, { color }]}>{score}</Text>
          <Text style={styles.wellnessLabel}>/100</Text>
        </View>
        <View style={styles.wellnessInfo}>
          <Text style={styles.wellnessTitle}>BIENESTAR HOY</Text>
          <Text style={styles.wellnessSubtitle}>{subtitle}</Text>
          <View style={styles.wellnessBreakdown}>
            {metrics.map((metric) => (
              <View key={`${metric.label}-${metric.value}`} style={styles.wellnessMetric}>
                <Ionicons name={metric.icon as any} size={10} color={Colors.text.muted} />
                <Text style={styles.wellnessMetricText}>
                  {metric.label} {metric.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wellnessCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.border.default, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginHorizontal: Spacing.base, gap: Spacing.lg },
  wellnessMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  wellnessCircle: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg.input },
  wellnessScoreText: { fontFamily: FontFamily.tech, fontSize: FontSize.xxl, fontWeight: '700' },
  wellnessLabel: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.muted, marginTop: -2 },
  wellnessInfo: { flex: 1, gap: 4 },
  wellnessTitle: { fontFamily: FontFamily.techSemi, fontSize: FontSize.sm, color: Colors.text.primary, letterSpacing: 1.5 },
  wellnessSubtitle: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.text.muted },
  wellnessBreakdown: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
  wellnessMetric: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.bg.input, paddingHorizontal: Spacing.xs, paddingVertical: 3, borderRadius: BorderRadius.xs },
  wellnessMetricText: { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.text.muted },
});
