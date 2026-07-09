import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { ChallengeTemplate } from '../../types/api';

const CATEGORY_CONFIG: Record<string, { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; label: string }> = {
  habits:   { icon: 'checkmark-circle', color: Colors.accent.green, label: 'HÁBITOS' },
  weight:   { icon: 'scale',            color: Colors.accent.cyan,  label: 'PESO' },
  exercise: { icon: 'barbell',          color: Colors.accent.gold,  label: 'EJERCICIO' },
  finance:  { icon: 'wallet',           color: Colors.accent.purple, label: 'FINANZAS' },
  OMNI:     { icon: 'bulb',             color: Colors.accent.red,   label: 'OMNI' },
};

interface ChallengeTemplateCardProps {
  template: ChallengeTemplate;
  onPress: (template: ChallengeTemplate) => void;
}

const ChallengeTemplateCard: React.FC<ChallengeTemplateCardProps> = ({ template, onPress }) => {
  const config = CATEGORY_CONFIG[template.category] || CATEGORY_CONFIG.habits;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(template)}
      activeOpacity={0.7}
    >
      <View style={styles.accentLine} />

      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: config.color + '15' }]}>
          <Ionicons name={config.icon} size={20} color={config.color} />
        </View>
        <Text style={[styles.categoryLabel, { color: config.color }]}>{config.label}</Text>
      </View>

      <Text style={styles.name} numberOfLines={2}>{template.name}</Text>

      {template.description && (
        <Text style={styles.description} numberOfLines={3}>{template.description}</Text>
      )}

      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Ionicons name="time-outline" size={12} color={Colors.text.muted} />
          <Text style={styles.footerText}>{template.duration_days}d</Text>
        </View>
        {template.target_value && template.target_unit && (
          <View style={styles.footerItem}>
            <Ionicons name="flag-outline" size={12} color={Colors.text.muted} />
            <Text style={styles.footerText}>{template.target_value} {template.target_unit}</Text>
          </View>
        )}
        <View style={styles.footerItem}>
          <Ionicons name="diamond-outline" size={12} color={Colors.accent.gold} />
          <Text style={[styles.footerText, styles.xpText]}>+{template.xp_reward}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 220,
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    overflow: 'hidden',
  },
  accentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.accent.green,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  name: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
    lineHeight: 18,
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
    alignItems: 'center',
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

export default ChallengeTemplateCard;


