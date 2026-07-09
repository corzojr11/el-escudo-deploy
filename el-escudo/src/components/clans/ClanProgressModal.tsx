import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { ClanMission } from '../../types/api';
import { apiPost } from '../../api/requests';

interface ClanProgressModalProps {
  visible: boolean;
  clanId: string;
  mission: ClanMission;
  clanColor: string;
  onClose: () => void;
  onSuccess: (completed: boolean) => void;
}

const ClanProgressModal: React.FC<ClanProgressModalProps> = ({
  visible,
  clanId,
  mission,
  clanColor,
  onClose,
  onSuccess,
}) => {
  const [value, setValue] = useState('1');
  const [loading, setLoading] = useState(false);

  const newTotal = mission.current_value + (parseInt(value) || 0);
  const progress = mission.target_value > 0 ? Math.min(100, (newTotal / mission.target_value) * 100) : 0;
  const willComplete = newTotal >= mission.target_value;

  const handleSubmit = async () => {
    const numValue = parseInt(value);
    if (isNaN(numValue) || numValue < 1) {
      Alert.alert('Error', 'Ingresa un valor numérico válido (mínimo 1).');
      return;
    }

    setLoading(true);
    try {
      const res = await apiPost(`/api/v1/clans/${clanId}/missions/${mission.id}/progress`, {
        value: numValue,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'completed') {
          Alert.alert('¡Misión completada!', `El clan recibió +${data.xp_distributed || 0} XP por miembro.`);
        } else {
          Alert.alert('Progreso reportado', `+${numValue} ${mission.unit} añadido.`);
        }
        onSuccess(data.status === 'completed');
        onClose();
      } else {
        const errData = await res.json().catch(() => null);
        Alert.alert('Error', errData?.detail || 'No se pudo reportar progreso.');
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={[styles.modal, { borderColor: clanColor + '40' }]}>
          <View style={styles.header}>
            <Text style={styles.title}>REPORTAR PROGRESO</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.text.muted} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.missionInfo}>
              <Text style={styles.missionName}>{mission.name}</Text>
              <Text style={styles.missionTarget}>
                {mission.current_value} → {newTotal} / {mission.target_value} {mission.unit}
              </Text>
              {willComplete && (
                <View style={styles.completeBadge}>
                  <Ionicons name="trophy" size={12} color={Colors.accent.gold} />
                  <Text style={styles.completeText}>¡SE COMPLETA!</Text>
                </View>
              )}
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>VALOR A AÑADIR</Text>
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={setValue}
                placeholder="1"
                placeholderTextColor={Colors.text.muted}
                keyboardType="numeric"
                textAlign="center"
              />
            </View>

            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Nuevo progreso</Text>
                <Text style={[styles.progressPct, { color: clanColor }]}>{Math.round(progress)}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(100, progress)}%`, backgroundColor: clanColor }]} />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: clanColor }, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.bg.primary} />
              ) : (
                <>
                  <Ionicons name="sync" size={16} color={Colors.bg.primary} />
                  <Text style={styles.submitText}>REPORTAR</Text>
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
  closeBtn: { padding: 4 },
  content: { padding: Spacing.base, gap: Spacing.lg },
  missionInfo: { alignItems: 'center', gap: Spacing.xs },
  missionName: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.md,
    color: Colors.text.primary,
  },
  missionTarget: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    color: Colors.text.muted,
  },
  completeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent.gold + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  completeText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.accent.gold,
    fontWeight: '700',
  },
  inputSection: { alignItems: 'center', gap: Spacing.xs },
  inputLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    letterSpacing: 1,
  },
  input: {
    width: 100,
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
  progressSection: { gap: Spacing.xs },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.text.muted },
  progressPct: { fontFamily: FontFamily.tech, fontSize: FontSize.sm },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.border.subtle,
    borderRadius: BorderRadius.xxs,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: BorderRadius.xxs },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.base,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.base,
    color: Colors.bg.primary,
    letterSpacing: 1,
  },
});

export default ClanProgressModal;
