import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { ChallengeTemplate, ChallengeProgressEntry } from '../../types/api';
import { apiPost } from '../../api/requests';

interface ChallengeProgressModalProps {
  visible: boolean;
  challengeId: string;
  template?: ChallengeTemplate;
  myProgress?: ChallengeProgressEntry;
  onClose: () => void;
  onSuccess: (completed: boolean, status: string) => void;
}

const ChallengeProgressModal: React.FC<ChallengeProgressModalProps> = ({
  visible,
  challengeId,
  template,
  myProgress,
  onClose,
  onSuccess,
}) => {
  const [value, setValue] = useState(myProgress?.current_value.toString() || '0');
  const [loading, setLoading] = useState(false);

  const target = template?.target_value || 0;
  const progress = target > 0 ? Math.min(100, (parseInt(value) || 0) / target * 100) : 0;

  const handleSubmit = async () => {
    const numValue = parseInt(value);
    if (isNaN(numValue) || numValue < 0) {
      Alert.alert('Error', 'Ingresa un valor numérico válido.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiPost(`/api/v1/challenges/${challengeId}/progress`, {
        current_value: numValue,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.completed) {
          Alert.alert('¡Progreso completado!', 'Has alcanzado la meta del reto.');
        } else {
          Alert.alert('Progreso actualizado', `Tu avance: ${numValue}/${target}`);
        }
        onSuccess(data.completed, data.challenge_status);
        onClose();
      } else {
        const errData = await res.json().catch(() => null);
        Alert.alert('Error', errData?.detail || 'No se pudo actualizar el progreso.');
      }
    } catch (err) {
      console.error('Report progress error:', err);
      Alert.alert('Error', 'No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>REPORTAR PROGRESO</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.text.muted} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {template && (
              <View style={styles.targetInfo}>
                <Text style={styles.targetLabel}>META DEL RETO</Text>
                <Text style={styles.targetValue}>
                  {target} {template.target_unit || ''}
                </Text>
                <Text style={styles.targetName}>{template.name}</Text>
              </View>
            )}

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>TU AVANCE ACTUAL</Text>
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={setValue}
                placeholder="0"
                placeholderTextColor={Colors.text.muted}
                keyboardType="numeric"
                textAlign="center"
              />
            </View>

            {/* Progress bar */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Progreso</Text>
                <Text style={styles.progressPct}>{Math.round(progress)}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressValues}>
                {value} / {target}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.bg.primary} />
              ) : (
                <>
                  <Ionicons name="sync" size={16} color={Colors.bg.primary} />
                  <Text style={styles.submitText}>ACTUALIZAR</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.bg.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '85%',
    maxWidth: 360,
    backgroundColor: Colors.bg.modal,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border.default,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  title: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.base,
    color: Colors.text.primary,
    letterSpacing: 2,
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    padding: Spacing.base,
    gap: Spacing.lg,
  },
  targetInfo: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  targetLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.accent.cyan,
    letterSpacing: 1.5,
  },
  targetValue: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.xxl,
    color: Colors.accent.gold,
  },
  targetName: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  inputSection: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  inputLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    letterSpacing: 1,
  },
  input: {
    width: 120,
    backgroundColor: Colors.bg.input,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontFamily: FontFamily.tech,
    fontSize: FontSize.xxl,
    color: Colors.text.primary,
  },
  progressSection: {
    gap: Spacing.xs,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  progressPct: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.sm,
    color: Colors.accent.green,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.border.subtle,
    borderRadius: BorderRadius.xxs,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent.green,
    borderRadius: BorderRadius.xxs,
  },
  progressValues: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    textAlign: 'center',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent.green,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.base,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.base,
    color: Colors.bg.primary,
    letterSpacing: 1,
  },
});

export default ChallengeProgressModal;
