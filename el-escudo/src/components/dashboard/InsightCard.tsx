import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';

export interface InsightCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  title?: string;
  onPress?: () => void;
}

export const InsightCard: React.FC<InsightCardProps> = React.memo(({ icon, text, title = 'INSIGHT SEMANAL', onPress }) => {
  if (onPress) {
    return (
      <TouchableOpacity style={styles.insightCard} onPress={onPress} activeOpacity={0.85} accessibilityRole="button">
        <View style={styles.insightMain}>
          <View style={styles.insightIconWrap}>
            <Ionicons name={icon} size={20} color={Colors.accent.gold} />
          </View>
          <View style={styles.insightContent}>
            <Text style={styles.insightTitle}>{title}</Text>
            <Text style={styles.insightText}>{text}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.insightCard}>
      <View style={styles.insightIconWrap}>
        <Ionicons name={icon} size={20} color={Colors.accent.gold} />
      </View>
      <View style={styles.insightContent}>
        <Text style={styles.insightTitle}>{title}</Text>
        <Text style={styles.insightText}>{text}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  insightCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors.bg.card, borderLeftWidth: 3, borderLeftColor: Colors.accent.gold, borderTopWidth: 1, borderBottomWidth: 1, borderRightWidth: 1, borderColor: Colors.border.default, borderRadius: BorderRadius.lg, padding: Spacing.md, marginHorizontal: Spacing.base, gap: Spacing.md },
  insightMain: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  insightIconWrap: { width: 36, height: 36, borderRadius: BorderRadius.md, backgroundColor: Colors.accent.gold + '15', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  insightContent: { flex: 1, gap: 4 },
  insightTitle: { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.text.muted, letterSpacing: 1.5 },
  insightText: { fontFamily: FontFamily.techRegular, fontSize: FontSize.sm, color: Colors.text.primary, lineHeight: 20 },
});
