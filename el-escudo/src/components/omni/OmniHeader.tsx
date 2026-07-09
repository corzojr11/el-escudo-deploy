import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';

interface OmniHeaderProps {
  aiCostCop: number;
  onToggleRecipes: () => void;
}

export const OmniHeader: React.FC<OmniHeaderProps> = ({ aiCostCop, onToggleRecipes }) => {
  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="flash" size={14} color="#000" />
          </View>
          <Text style={styles.headerTitle}>NAVIR</Text>
          <Text style={styles.headerStatus}>Activo</Text>
        </View>
        <View style={styles.telemetryBadge}>
          <Text style={styles.telemetryLabel}>{aiCostCop ? `${Math.round(aiCostCop)} COP` : '$0 COP'}</Text>
        </View>
        <TouchableOpacity
          onPress={onToggleRecipes}
          style={styles.recipesBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="cube-outline" size={18} color={Colors.accent.green} />
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />
    </>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xs },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerIcon: { width: 24, height: 24, borderRadius: BorderRadius.md, backgroundColor: Colors.accent.green, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.techSemi, fontSize: FontSize.md, color: Colors.text.primary, letterSpacing: 1 },
  headerStatus: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.accent.green, opacity: 0.6 },
  telemetryBadge: { backgroundColor: 'rgba(0, 255, 157, 0.06)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  telemetryLabel: { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.accent.green },
  recipesBtn: { padding: Spacing.xs, marginLeft: Spacing.xs },
  divider: { height: 1, backgroundColor: Colors.border.subtle, marginHorizontal: Spacing.lg },
});


