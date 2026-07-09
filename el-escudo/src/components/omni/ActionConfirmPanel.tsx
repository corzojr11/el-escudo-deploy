import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { PressableScale } from '../PressableScale';

interface OMNIAction {
  type: string;
  description: string;
  command?: string;
}

interface ActionConfirmPanelProps {
  action?: {
    type: string;
    data: Record<string, unknown>;
    summary: string;
  };
  actions?: OMNIAction[];
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

const ActionRow = ({ description }: { description: string }) => (
  <View style={styles.actionRow}>
    <Ionicons name="checkmark-circle-outline" size={18} color={Colors.accent.green} />
    <Text style={styles.actionDesc}>{description}</Text>
  </View>
);

const ActionConfirmPanel: React.FC<ActionConfirmPanelProps> = ({
  action,
  actions,
  onConfirm,
  onCancel,
  isProcessing = false,
}) => {
  const actionList = actions ?? [];
  const isMulti = actionList.length > 0;
  const label = isMulti ? 'LO QUE ENTENDÍ' : 'TE ENTENDÍ';
  const confirmLabel = isMulti ? 'SÍ, HAZLO' : 'SÍ, HAZLO';

  return (
    <View style={styles.pendingContainer}>
      <Text style={styles.pendingLabel}>{label}</Text>

      {isMulti ? (
        <View style={styles.actionsList}>
          {actionList.map((a, i) => (
            <ActionRow key={`${a.type}-${a.command || a.description}-${i}`} description={a.description} />
          ))}
        </View>
      ) : (
        <Text style={styles.pendingSummary}>{action?.summary}</Text>
      )}

      <View style={styles.actionButtons}>
        <PressableScale style={[styles.actionBtn, styles.cancelBtn]} onPress={onCancel}>
          <Text style={styles.cancelText}>ATRÁS</Text>
        </PressableScale>
        <PressableScale
          style={[styles.actionBtn, styles.confirmBtn, isProcessing && styles.confirmBtnDisabled]}
          onPress={isProcessing ? undefined : onConfirm}
        >
          <Text style={styles.confirmText}>{confirmLabel}</Text>
        </PressableScale>
      </View>
    </View>
  );
};

export { ActionConfirmPanel };

const styles = StyleSheet.create({
  pendingContainer: { backgroundColor: 'rgba(0, 255, 157, 0.05)', borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.accent.green + '20', alignItems: 'center', marginHorizontal: Spacing.base, marginBottom: Spacing.sm },
  pendingLabel: { fontFamily: FontFamily.mono, color: Colors.accent.green, fontSize: 10, letterSpacing: 2, marginBottom: 8 },
  pendingSummary: { color: '#FFF', fontSize: FontSize.sm, fontWeight: '700', textAlign: 'center', marginBottom: Spacing.md },
  actionsList: { width: '100%', gap: Spacing.sm, marginBottom: Spacing.md },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: BorderRadius.sm, padding: Spacing.sm },
  actionDesc: { flex: 1, color: Colors.text.primary, fontFamily: FontFamily.techRegular, fontSize: FontSize.sm },
  actionButtons: { flexDirection: 'row', gap: Spacing.md },
  actionBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: 10, minWidth: 100, alignItems: 'center' },
  cancelBtn: { backgroundColor: 'rgba(255,255,255,0.05)' },
  confirmBtn: { backgroundColor: Colors.accent.green },
  confirmBtnDisabled: { opacity: 0.6 },
  cancelText: { color: Colors.text.muted, fontWeight: '700', fontFamily: FontFamily.mono, fontSize: 11 },
  confirmText: { color: '#000', fontWeight: '800', fontFamily: FontFamily.mono, fontSize: 11 },
});
