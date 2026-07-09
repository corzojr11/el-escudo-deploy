import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { apiPost } from '../../api/requests';

const PRESET_COLORS = [
  '#00D4FF', '#00FF9D', '#FFD700', '#FF3131',
  '#7C3AED', '#6366F1', '#FF8C00', '#E5E5E7',
];

interface ClanCreateModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ClanCreateModal: React.FC<ClanCreateModalProps> = ({ visible, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('#00D4FF');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (trimmedName.length < 3) {
      Alert.alert('Error', 'El nombre debe tener al menos 3 caracteres.');
      return;
    }
    if (trimmedName.length > 30) {
      Alert.alert('Error', 'El nombre debe tener máximo 30 caracteres.');
      return;
    }
    if (tag && !/^[A-Za-z0-9]{3,4}$/.test(tag.trim())) {
      Alert.alert('Error', 'El tag debe tener 3-4 caracteres alfanuméricos.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiPost('/api/v1/clans', {
        name: trimmedName,
        tag: tag.trim().toUpperCase() || undefined,
        description: description.trim() || undefined,
        color: selectedColor,
      });

      if (res.ok) {
        Alert.alert('Clan creado', `Has creado el clan "${trimmedName}".`);
        setName('');
        setTag('');
        setDescription('');
        onSuccess();
        onClose();
      } else {
        const data = await res.json().catch(() => null);
        Alert.alert('Error', data?.detail || 'No se pudo crear el clan.');
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
            <Text style={styles.title}>CREAR CLAN</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.text.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>NOMBRE DEL CLAN</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ej: Los Guardianes"
                placeholderTextColor={Colors.text.muted}
                maxLength={30}
              />
              <Text style={styles.inputHint}>{name.length}/30 caracteres</Text>
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>TAG (OPCIONAL)</Text>
              <TextInput
                style={styles.input}
                value={tag}
                onChangeText={(t) => setTag(t.toUpperCase())}
                placeholder="Ej: GDN"
                placeholderTextColor={Colors.text.muted}
                maxLength={4}
                autoCapitalize="characters"
              />
              <Text style={styles.inputHint}>3-4 caracteres alfanuméricos</Text>
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>DESCRIPCIÓN (OPCIONAL)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe tu clan..."
                placeholderTextColor={Colors.text.muted}
                multiline
                numberOfLines={3}
                maxLength={200}
              />
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>COLOR DEL CLAN</Text>
              <View style={styles.colorGrid}>
                {PRESET_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: color },
                      selectedColor === color && styles.colorSwatchSelected,
                    ]}
                    onPress={() => setSelectedColor(color)}
                    activeOpacity={0.7}
                  >
                    {selectedColor === color && (
                      <Ionicons name="checkmark" size={16} color="#0A0A0B" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleCreate}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator size="small" color={Colors.bg.primary} />
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={16} color={Colors.bg.primary} />
                <Text style={styles.submitText}>CREAR CLAN</Text>
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
    maxHeight: '85%',
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
  scrollContent: {
    padding: Spacing.base,
    gap: Spacing.lg,
  },
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputHint: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: Colors.bg.primary,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.3)',
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
  submitBtnDisabled: { opacity: 0.6 },
  submitText: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.base,
    color: Colors.bg.primary,
    letterSpacing: 1,
  },
});

export default ClanCreateModal;
