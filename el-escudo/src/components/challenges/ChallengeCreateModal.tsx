import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { ChallengeTemplate } from '../../types/api';
import { apiPost } from '../../api/requests';

interface ChallengeCreateModalProps {
  visible: boolean;
  template: ChallengeTemplate | null;
  onClose: () => void;
  onSuccess: () => void;
}

const ChallengeCreateModal: React.FC<ChallengeCreateModalProps> = ({ visible, template, onClose, onSuccess }) => {
  const [opponentId, setOpponentId] = useState('');
  const [loading, setLoading] = useState(false);

  if (!template) return null;

  const handleCreate = async () => {
    if (!opponentId.trim()) {
      Alert.alert('Error', 'Ingresa el player_id del jugador que quieres retar.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiPost('/api/v1/challenges', {
        template_id: template.id,
        challenged_player_id: opponentId.trim(),
      });

      if (res.ok) {
        Alert.alert('Reto enviado', `Has retado a un jugador con "${template.name}".`);
        setOpponentId('');
        onSuccess();
        onClose();
      } else {
        const data = await res.json().catch(() => null);
        const detail = data?.detail || 'No se pudo crear el reto. Verifica el player_id.';
        Alert.alert('Error', detail);
      }
    } catch (err) {
      console.error('Create challenge error:', err);
      Alert.alert('Error', 'No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>CREAR RETO</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.text.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Template info */}
            <View style={styles.templateCard}>
              <Text style={styles.templateName}>{template.name}</Text>
              {template.description && (
                <Text style={styles.templateDesc}>{template.description}</Text>
              )}
              <View style={styles.templateMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={14} color={Colors.text.muted} />
                  <Text style={styles.metaText}>{template.duration_days} días</Text>
                </View>
                {template.target_value && template.target_unit && (
                  <View style={styles.metaItem}>
                    <Ionicons name="flag-outline" size={14} color={Colors.text.muted} />
                    <Text style={styles.metaText}>{template.target_value} {template.target_unit}</Text>
                  </View>
                )}
                <View style={styles.metaItem}>
                  <Ionicons name="diamond-outline" size={14} color={Colors.accent.gold} />
                  <Text style={[styles.metaText, styles.metaXP]}>+{template.xp_reward} XP</Text>
                </View>
              </View>
            </View>

            {/* Opponent input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>PLAYER_ID DEL OPONENTE</Text>
              <TextInput
                style={styles.input}
                value={opponentId}
                onChangeText={setOpponentId}
                placeholder="Ej: abc123def"
                placeholderTextColor={Colors.text.muted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.inputHint}>
                El player_id se puede encontrar en el perfil del jugador o en el leaderboard.
              </Text>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleCreate}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator size="small" color={Colors.accent.green} />
            ) : (
              <>
                <Ionicons name="flash" size={16} color={Colors.bg.primary} />
                <Text style={styles.submitText}>ENVIAR RETO</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.bg.overlay,
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: Colors.bg.modal,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '80%',
    paddingBottom: 32,
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
    fontSize: FontSize.lg,
    color: Colors.text.primary,
    letterSpacing: 2,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    padding: Spacing.base,
    gap: Spacing.lg,
  },
  templateCard: {
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  templateName: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.md,
    color: Colors.text.primary,
  },
  templateDesc: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: Colors.text.muted,
    lineHeight: 20,
  },
  templateMeta: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  metaXP: {
    color: Colors.accent.gold,
    fontWeight: '700',
  },
  inputSection: {
    gap: Spacing.xs,
  },
  inputLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.accent.cyan,
    letterSpacing: 1.5,
  },
  input: {
    backgroundColor: Colors.bg.input,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontFamily: FontFamily.mono,
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  inputHint: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    lineHeight: 16,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent.green,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.base,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.md,
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

export default ChallengeCreateModal;
