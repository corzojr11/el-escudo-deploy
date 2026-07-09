import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';

interface HealthFocusPanelProps {
  focusStreak: number;
  focusBest: number;
  urgeCount: number;
  isUrgencyActive: boolean;
  urgencySeconds: number;
  onStartUrgency: () => void;
  onStopUrgency: () => void;
  onMarkFocusDay: () => void;
  onRegisterSlip: () => void;
}

const HealthFocusPanel: React.FC<HealthFocusPanelProps> = ({
  focusStreak,
  focusBest,
  urgeCount,
  isUrgencyActive,
  urgencySeconds,
  onStartUrgency,
  onStopUrgency,
  onMarkFocusDay,
  onRegisterSlip,
}) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>MODO DISCRETO - DISCIPLINA</Text>

      <View style={styles.focusSummary}>
        <View style={styles.focusSummaryCard}>
          <Text style={styles.focusSummaryLabel}>Racha</Text>
          <Text style={styles.focusSummaryValue}>{focusStreak} dias</Text>
        </View>
        <View style={styles.focusSummaryCard}>
          <Text style={styles.focusSummaryLabel}>Record</Text>
          <Text style={styles.focusSummaryValue}>{focusBest} dias</Text>
        </View>
        <View style={styles.focusSummaryCard}>
          <Text style={styles.focusSummaryLabel}>Impulsos</Text>
          <Text style={styles.focusSummaryValue}>{urgeCount}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.urgeBtn} activeOpacity={0.9} onPress={onStartUrgency}>
        <Ionicons name="shield-checkmark" size={20} color={Colors.accent.green} />
        <Text style={styles.urgeBtnText}>Tengo impulso - Protocolo 90s</Text>
      </TouchableOpacity>

      {isUrgencyActive && (
        <View style={styles.urgencyCard}>
          <Text style={styles.urgencyTitle}>RESET EN CURSO</Text>
          <Text style={styles.urgencyTimer}>{urgencySeconds}s</Text>
          <Text style={styles.urgencyLead}>No negocies con el impulso. Sigue el bloque corto y vuelve al plan.</Text>
          <Text style={styles.urgencyStep}>1. Respira 4-4-6 por 90 segundos.</Text>
          <Text style={styles.urgencyStep}>2. Sal de la app y cambia de entorno.</Text>
          <Text style={styles.urgencyStep}>3. Agua fria + 20 sentadillas.</Text>
          <View style={styles.urgencyActions}>
            <TouchableOpacity style={styles.urgencyActionBtn} onPress={onStopUrgency}>
              <Text style={styles.urgencyActionText}>Se me paso</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.urgencyActionBtn} onPress={onStartUrgency}>
              <Text style={styles.urgencyActionText}>Sigo con impulso</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.focusActions}>
        <TouchableOpacity style={styles.focusActionPrimary} onPress={onMarkFocusDay}>
          <Text style={styles.focusActionPrimaryText}>Hoy me mantuve</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.focusActionGhost} onPress={onRegisterSlip}>
          <Text style={styles.focusActionGhostText}>Tuve recaida</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    gap: Spacing.md,
  },
  sectionTitle: {
    fontFamily: FontFamily.mono,
    fontSize: 12,
    color: Colors.text.muted,
    letterSpacing: 1.5,
  },
  focusSummary: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
  },
  focusSummaryCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  focusSummaryLabel: {
    fontFamily: FontFamily.mono,
    color: Colors.text.muted,
    fontSize: 10,
    marginBottom: 4,
  },
  focusSummaryValue: {
    fontFamily: FontFamily.techSemi,
    color: Colors.text.primary,
    fontSize: 14,
  },
  urgeBtn: {
    borderWidth: 1,
    borderColor: Colors.accent.green + '55',
    backgroundColor: 'rgba(0, 255, 157, 0.08)',
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: Spacing.md,
  },
  urgeBtnText: {
    fontFamily: FontFamily.techSemi,
    color: Colors.accent.green,
    fontSize: 13,
  },
  urgencyCard: {
    backgroundColor: 'rgba(18,18,20,0.9)',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRadius: BorderRadius.md,
    padding: 12,
    marginBottom: Spacing.md,
  },
  urgencyTitle: {
    fontFamily: FontFamily.mono,
    color: Colors.accent.cyan,
    fontSize: 11,
    letterSpacing: 1,
  },
  urgencyTimer: {
    fontFamily: FontFamily.tech,
    color: Colors.text.primary,
    fontSize: 24,
    marginVertical: 6,
  },
  urgencyLead: {
    fontFamily: FontFamily.mono,
    color: Colors.text.secondary,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 6,
  },
  urgencyStep: {
    fontFamily: FontFamily.mono,
    color: Colors.text.secondary,
    fontSize: 11,
    marginBottom: 4,
  },
  urgencyActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  urgencyActionBtn: {
    flex: 1,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
    paddingVertical: 10,
    alignItems: 'center',
  },
  urgencyActionText: {
    fontFamily: FontFamily.mono,
    color: Colors.text.secondary,
    fontSize: 11,
  },
  focusActions: {
    flexDirection: 'row',
    gap: 8,
  },
  focusActionPrimary: {
    flex: 1,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent.green,
    paddingVertical: 12,
    alignItems: 'center',
  },
  focusActionPrimaryText: {
    fontFamily: FontFamily.techSemi,
    color: '#000',
    fontSize: 12,
  },
  focusActionGhost: {
    flex: 1,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
    paddingVertical: 12,
    alignItems: 'center',
  },
  focusActionGhostText: {
    fontFamily: FontFamily.mono,
    color: Colors.text.muted,
    fontSize: 11,
  },
});

export default HealthFocusPanel;
