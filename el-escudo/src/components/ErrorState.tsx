import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { PressableScale } from './PressableScale';

interface ErrorStateProps {
  message?: string;
  onRetry: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => {
  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle-outline" size={48} color={Colors.accent.red} />
      <Text style={styles.title}>ERROR DE CONEXIÓN</Text>
      <Text style={styles.message}>
        {message || 'No se pudieron cargar los datos. Verifica tu conexión e intenta nuevamente.'}
      </Text>
      <PressableScale onPress={onRetry} style={styles.retryButton}>
        <Text style={styles.retryText}>REINTENTAR</Text>
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
  },
  message: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    color: Colors.text.muted,
    marginTop: Spacing.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.accent.green,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  retryText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.base,
    color: Colors.text.inverse,
  },
});
