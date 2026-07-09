import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { apiPost } from '../../api/requests';

interface ClanMissionCreateModalProps {
  visible: boolean;
  clanId: string;
  clanColor: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ClanMissionCreateModal: React.FC<ClanMissionCreateModalProps> = ({ visible, clanId, clanColor, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetValue, setTargetValue] = useState('100');
  const [unit, setUnit] = useState('xp');
  const [xpReward, setXpReward] = useState('200');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Ingresa un nombre para la misión.');
      return;
    }
    const target = parseInt(targetValue);
    if (isNaN(target) || target < 1) {
      Alert.alert('Error', 'El valor objetivo debe ser al menos 1.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiPost(`/api/v1/clans/${clanId}/missions`, {
        name: name.trim(),
        description: description.trim() || undefined,
        target_value: target,
        unit: unit.trim() || 'xp',
        xp_reward: parseInt(xpReward) || 200,
      });

      if (res.ok) {
        Alert.alert('Misión creada', `"${name.trim()}" ha sido añadida al clan.`);
        setName('');
        setDescription('');
        setTargetValue('100');
        onSuccess();
        onClose();
      } else {
        const data = await res.json().catch(() => null);
        Alert.alert('Error', data?.detail || 'No se pudo crear la misión.');
      }
    } catch (err) {
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
            <Text style={styles.title}>CREAR MISIÓN</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.text.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>NOMBRE</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ej: Acumular 1000 XP"
                placeholderTextColor={Colors.text.muted}
              />
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>DESCRIPCIÓN (OPCIONAL)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe la misión..."
                placeholderTextColor={Colors.text.muted}
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputSection, { flex: 2 }]}>
                <Text style={styles.inputLabel}>OBJETIVO</Text>
                <TextInput
                  style={styles.input}
                  value={targetValue}
                  onChangeText={setTargetValue}
                  placeholder="100"
                  placeholderTextColor={Colors.text.muted}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputSection, { flex: 1, marginLeft: Spacing.sm }]}>
                <Text style={styles.inputLabel}>UNIDAD</Text>
                <TextInput
                  style={styles.input}
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="xp"
                  placeholderTextColor={Colors.text.muted}
                />
              </View>
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>XP REWARD</Text>
              <TextInput
                style={styles.input}
                value={xpReward}
                onChangeText={setXpReward}
                placeholder="200"
                placeholderTextColor={Colors.text.muted}
                keyboardType="numeric"
              />
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: clanColor }, loading && styles.submitBtnDisabled]}
            onPress={handleCreate}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator size="small" color={Colors.bg.primary} />
            ) : (
              <>
                <Ionicons name="flag" size={16} color={Colors.bg.primary} />
                <Text style={styles.submitText}>CREAR MISIÓN</Text>
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
  closeBtn: { padding: 4 },
  scrollContent: { padding: Spacing.base, gap: Spacing.lg },
  inputSection: { gap: Spacing.xs },
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
  textArea: { minHeight: 60, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.base,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.md,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.base,
    color: Colors.bg.primary,
    letterSpacing: 1,
  },
});

export default ClanMissionCreateModal;
