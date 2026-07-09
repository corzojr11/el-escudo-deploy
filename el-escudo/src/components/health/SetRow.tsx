import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../theme/colors';
import { FontFamily } from '../../theme/typography';
import { BorderRadius } from '../../theme/spacing';
import { useAppStore, WorkoutSet } from '../../store';

/**
 * Props for the SetRow component.
 */
interface SetRowProps {
  /** ID of the parent exercise this set belongs to. */
  exerciseId: string;
  /** Zero-based index of this set within the exercise. */
  setIndex: number;
  /** The workout set data object containing kg, reps, and done status. */
  setData: WorkoutSet;
}

/**
 * SetRow — Single workout set input row within an exercise.
 *
 * Displays a numbered row with:
 * - Set index number
 * - Weight (kg) text input
 * - Reps text input
 * - Completion checkbox with haptic feedback
 *
 * When marked as done, inputs become read-only and the row dims visually.
 * Triggers `Haptics.impactAsync` on checkbox toggle for tactile feedback.
 *
 * @component
 * @param {SetRowProps} props - Component props
 * @param {string} props.exerciseId - Parent exercise ID
 * @param {number} props.setIndex - Set index (0-based)
 * @param {WorkoutSet} props.setData - Set data (kg, reps, done)
 * @example
 * ```tsx
 * <SetRow exerciseId="p1" setIndex={0} setData={{ id: 's1', kg: '60', reps: '10', done: false }} />
 * ```
 */
const SetRow: React.FC<SetRowProps> = ({ exerciseId, setIndex, setData }) => {
  const { updateSetData, toggleSetDone } = useAppStore();

  const isDone = setData.done;

  return (
    <View style={[styles.row, isDone && styles.rowDone]}>
      <Text style={styles.index}>{setIndex + 1}</Text>
      
      <TextInput
        style={[styles.input, isDone && styles.inputDone]}
        keyboardType="decimal-pad"
        placeholder="-"
        placeholderTextColor={Colors.text.muted}
        value={setData.kg}
        onChangeText={(v) => updateSetData(exerciseId, setData.id, 'kg', v)}
        editable={!isDone}
      />

      <TextInput
        style={[styles.input, isDone && styles.inputDone]}
        keyboardType="number-pad"
        placeholder="-"
        placeholderTextColor={Colors.text.muted}
        value={setData.reps}
        onChangeText={(v) => updateSetData(exerciseId, setData.id, 'reps', v)}
        editable={!isDone}
      />

      <TouchableOpacity 
        style={[styles.checkbox, isDone && styles.checkboxDone]} 
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          toggleSetDone(exerciseId, setData.id);
        }}
        activeOpacity={0.8}
      >
        {isDone && <Ionicons name="checkmark" size={16} color={Colors.bg.primary} />}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 12,
    marginBottom: 6,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  rowDone: { opacity: 0.62, backgroundColor: 'rgba(255,255,255,0.01)' },
  index: {
    width: 28,
    textAlign: 'center',
    fontFamily: FontFamily.techSemi,
    fontSize: 12,
    color: Colors.text.secondary,
    backgroundColor: Colors.bg.input,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRadius: 999,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.bg.input,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRadius: 10,
    color: Colors.text.primary,
    textAlign: 'center',
    paddingVertical: 10,
    fontFamily: FontFamily.techSemi,
  },
  inputDone: { backgroundColor: 'transparent', borderColor: 'transparent' },
  checkbox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.bg.input,
    borderWidth: 1,
    borderColor: Colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: Colors.accent.green, borderColor: Colors.accent.green },
});

export default SetRow;
