import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { PressableScale } from './PressableScale';

interface EmptyStateDashboardProps {
  onStart: () => void;
}

export const EmptyStateDashboard: React.FC<EmptyStateDashboardProps> = ({ onStart }) => {
  return (
    <View style={styles.container}>
      <Ionicons name="shield-checkmark" size={64} color={Colors.accent.green} />
      <Text style={styles.title}>CENTRO DE MANDO ACTIVO</Text>
      <Text style={styles.description}>
        Tu escudo está online. Comienza registrando tu primera acción para desbloquear el dashboard.
      </Text>
      <PressableScale style={styles.button} onPress={onStart}>
        <Text style={styles.buttonText}>INICIAR PRIMERA MISIÓN</Text>
      </PressableScale>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.bg.primary,
  },
  title: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.lg,
    color: Colors.text.primary,
    marginTop: Spacing.lg,
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  description: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    color: Colors.text.muted,
    marginTop: Spacing.base,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.accent.green,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  buttonText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.base,
    color: Colors.text.inverse,
    letterSpacing: 1,
  },
});
