import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import type { WorkShift } from '../../store';

type DailyBlock = {
  key: string;
  title: string;
  detail: string;
  tone: string;
};

type TimeBar = {
  sleep: number;
  work: number;
  transition: number;
  free: number;
  total: number;
};

type NavirDecision = {
  overlap: boolean;
  window: {
    cycles: number;
    hours: number;
    sleepTime: string;
    wakeTime: string;
  };
  shift: WorkShift | null;
};

interface SchedulePlannerPanelProps {
  workShifts: WorkShift[];
  isScanning: boolean;
  showManualForm: boolean;
  editingShift: WorkShift | null;
  selectedDay: string;
  startTime: string;
  endTime: string;
  isSubmitting: boolean;
  wakeInput: string;
  commuteInput: string;
  dailyBlocks: DailyBlock[];
  timeBar: TimeBar | null;
  navirDecision: NavirDecision | null;
  days: string[];
  dayShort: string[];
  onScanSchedule: () => void;
  onToggleManualForm: () => void;
  onCancelEditing: () => void;
  onSelectedDayChange: (day: string) => void;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onSubmitManualShift: () => void;
  onWakeInputChange: (value: string) => void;
  onWakeSubmit: () => void;
  onCommuteInputChange: (value: string) => void;
  onCommuteSubmit: () => void;
  onEditShift: (shift: WorkShift) => void;
  onDeleteShift: (shift: WorkShift) => void;
}

const SchedulePlannerPanel: React.FC<SchedulePlannerPanelProps> = ({
  workShifts,
  isScanning,
  showManualForm,
  editingShift,
  selectedDay,
  startTime,
  endTime,
  isSubmitting,
  wakeInput,
  commuteInput,
  dailyBlocks,
  timeBar,
  navirDecision,
  days,
  dayShort,
  onScanSchedule,
  onToggleManualForm,
  onCancelEditing,
  onSelectedDayChange,
  onStartTimeChange,
  onEndTimeChange,
  onSubmitManualShift,
  onWakeInputChange,
  onWakeSubmit,
  onCommuteInputChange,
  onCommuteSubmit,
  onEditShift,
  onDeleteShift,
}) => {
  return (
    <View>
      <TouchableOpacity style={styles.scanButton} onPress={onScanSchedule} disabled={isScanning}>
        {isScanning ? (
          <ActivityIndicator color={Colors.accent.cyan} />
        ) : (
          <>
            <Ionicons name="scan" size={22} color={Colors.accent.cyan} />
            <Text style={styles.scanButtonText}>Leer horario desde cámara o galería</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.manualButton}
        onPress={() => (editingShift ? onCancelEditing() : onToggleManualForm())}
        disabled={isScanning}
      >
        <Ionicons name={showManualForm ? 'close' : 'add'} size={18} color={Colors.text.muted} />
        <Text style={styles.manualButtonText}>
          {showManualForm ? (editingShift ? 'CANCELAR EDICIÓN' : 'CANCELAR') : 'AÑADIR A MANO'}
        </Text>
      </TouchableOpacity>

      {showManualForm && (
        <View style={styles.manualForm}>
          <Text style={styles.formTitle}>{editingShift ? 'EDITANDO TURNO' : 'AÑADIR TURNO'}</Text>
          <Text style={styles.formLabel}>DÍA</Text>
          <View style={styles.daySelector}>
            {days.map((day, idx) => (
              <TouchableOpacity
                key={day}
                style={[styles.dayButton, selectedDay === day && styles.dayButtonActive]}
                onPress={() => onSelectedDayChange(day)}
              >
                <Text style={[styles.dayButtonText, selectedDay === day && styles.dayButtonTextActive]}>
                  {dayShort[idx]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.timeRow}>
            <View style={styles.timeInputContainer}>
              <Text style={styles.formLabel}>INICIO</Text>
              <TextInput
                style={styles.timeInput}
                value={startTime}
                onChangeText={onStartTimeChange}
                placeholder="08:00"
                placeholderTextColor={Colors.text.muted}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
            <View style={styles.timeInputContainer}>
              <Text style={styles.formLabel}>FIN</Text>
              <TextInput
                style={styles.timeInput}
                value={endTime}
                onChangeText={onEndTimeChange}
                placeholder="17:00"
                placeholderTextColor={Colors.text.muted}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
          </View>

          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancelEditing} disabled={isSubmitting}>
              <Text style={styles.cancelButtonText}>CANCELAR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.saveButton,
                editingShift && styles.updateButton,
                isSubmitting && styles.saveButtonDisabled,
              ]}
              onPress={onSubmitManualShift}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={Colors.text.inverse} />
              ) : (
                <>
                  <Ionicons name={editingShift ? 'save' : 'checkmark'} size={18} color={Colors.text.inverse} />
                  <Text style={[styles.saveButtonText, editingShift && styles.updateButtonText]}>
                    {editingShift ? 'ACTUALIZAR TURNO' : 'GUARDAR TURNO'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.wakeInputCard}>
        <Text style={styles.wakeInputLabel}>Hora objetivo para despertar</Text>
        <View style={styles.wakeInputRow}>
          <TextInput
            style={styles.wakeInput}
            value={wakeInput}
            onChangeText={onWakeInputChange}
            onBlur={onWakeSubmit}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            placeholder="06:00"
            placeholderTextColor={Colors.text.muted}
          />
          <Ionicons name="alarm" size={20} color={Colors.text.muted} />
        </View>
      </View>

      {navirDecision && (
        <View style={[styles.decisionCard, navirDecision.overlap && styles.decisionCardWarning]}>
          <View style={styles.decisionHeader}>
            <Ionicons
              name="bulb"
              size={18}
              color={navirDecision.overlap ? Colors.accent.orange : Colors.accent.green}
            />
            <Text style={[styles.decisionTitle, navirDecision.overlap && styles.decisionTitleWarning]}>
              SUEÑO SUGERIDO
            </Text>
            {navirDecision.overlap && (
              <View style={styles.warningBadge}>
                <Ionicons name="warning" size={10} color={Colors.accent.orange} />
                <Text style={styles.warningBadgeText}>CONFLICTO</Text>
              </View>
            )}
          </View>
          <Text style={styles.decisionText}>
            Navir sugiere:{' '}
            <Text style={styles.decisionHighlight}>
              {navirDecision.window.cycles} Ciclos ({navirDecision.window.hours}h)
            </Text>
          </Text>
          <Text style={styles.decisionSubtext}>
            Dormir a las {navirDecision.window.sleepTime} → Despertar a las {navirDecision.window.wakeTime}
          </Text>
          <Text style={styles.decisionAction}>
            {navirDecision.overlap
              ? 'Hay conflicto con el turno: ajusta la hora para no romper el descanso.'
              : 'Este bloque ya ordena tu noche: NAVIR lo usará como base del resto del día.'}
          </Text>
          {navirDecision.shift && (
            <Text style={styles.decisionShiftRef}>
              Turno hoy: {navirDecision.shift.day} {navirDecision.shift.start} - {navirDecision.shift.end}
            </Text>
          )}
        </View>
      )}

      <View style={styles.commuteCard}>
        <View style={styles.commuteHeader}>
          <Ionicons name="car-outline" size={16} color={Colors.accent.cyan} />
          <Text style={styles.commuteTitle}>TRASLADO ESTIMADO</Text>
        </View>
        <View style={styles.commuteRow}>
          <TextInput
            style={styles.commuteInput}
            value={commuteInput}
            onChangeText={onCommuteInputChange}
            onBlur={onCommuteSubmit}
            keyboardType="number-pad"
            maxLength={3}
            placeholder="35"
            placeholderTextColor={Colors.text.muted}
          />
          <Text style={styles.commuteHint}>min</Text>
        </View>
        <Text style={styles.commuteSub}>Se usa para calcular llegada a casa, almuerzo, foco y sueño.</Text>
      </View>

      <View style={styles.timelineCard}>
        <View style={styles.timelineHeader}>
          <Ionicons name="hourglass-outline" size={16} color={Colors.accent.indigo} />
          <Text style={styles.timelineTitle}>TU DÍA EN BLOQUES</Text>
        </View>
        <View style={styles.timelineList}>
          {dailyBlocks.map((block) => (
            <View key={block.key} style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: block.tone }]} />
              <View style={styles.timelineItemBody}>
                <Text style={styles.timelineItemTitle}>{block.title}</Text>
                <Text style={styles.timelineItemDetail}>{block.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {timeBar && (
        <View style={styles.timeBarCard}>
          <View style={styles.timeBarHeader}>
            <Ionicons name="bar-chart" size={16} color={Colors.accent.cyan} />
            <Text style={styles.timeBarTitle}>DISTRIBUCIÓN DEL DÍA</Text>
          </View>

          <View style={styles.barContainer}>
            {timeBar.sleep > 0 && (
              <View style={[styles.barSegment, { width: `${(timeBar.sleep / timeBar.total) * 100}%` }, styles.barSleep]}>
                <Text style={styles.barSegmentLabel}>
                  {timeBar.sleep >= 60 ? `${(timeBar.sleep / 60).toFixed(1)}h` : `${timeBar.sleep}m`}
                </Text>
              </View>
            )}
            {timeBar.work > 0 && (
              <View style={[styles.barSegment, { width: `${(timeBar.work / timeBar.total) * 100}%` }, styles.barWork]}>
                <Text style={styles.barSegmentLabel}>
                  {timeBar.work >= 60 ? `${(timeBar.work / 60).toFixed(1)}h` : `${timeBar.work}m`}
                </Text>
              </View>
            )}
            {timeBar.transition > 0 && (
              <View
                style={[styles.barSegment, { width: `${(timeBar.transition / timeBar.total) * 100}%` }, styles.barTransition]}
              >
                <Text style={styles.barSegmentLabel}>
                  {timeBar.transition >= 60 ? `${(timeBar.transition / 60).toFixed(1)}h` : `${timeBar.transition}m`}
                </Text>
              </View>
            )}
            {timeBar.free > 0 && (
              <View style={[styles.barSegment, { width: `${(timeBar.free / timeBar.total) * 100}%` }, styles.barFree]}>
                <Text style={styles.barSegmentLabel}>
                  {timeBar.free >= 60 ? `${(timeBar.free / 60).toFixed(1)}h` : `${timeBar.free}m`}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.barLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#7C3AED' }]} />
              <Text style={styles.legendText}>Sueño</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#6366F1' }]} />
              <Text style={styles.legendText}>Trabajo</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#D97706' }]} />
              <Text style={styles.legendText}>Transición</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#00FF9D' }]} />
              <Text style={styles.legendText}>Tiempo Libre</Text>
            </View>
          </View>
        </View>
      )}

      {workShifts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar" size={20} color={Colors.accent.purple} />
            <Text style={styles.sectionTitle}>Turnos de la Semana</Text>
          </View>
          <View style={styles.shiftsContainer}>
            {workShifts.map((shift, idx) => (
              <View key={shift.id || idx} style={styles.shiftCard}>
                <Text style={styles.shiftDay}>{shift.day}</Text>
                <View style={styles.shiftTimeWrap}>
                  <Ionicons name="time" size={14} color={Colors.text.muted} />
                  <Text style={styles.shiftTime}>
                    {shift.start} - {shift.end}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => onEditShift(shift)} style={styles.editButton} activeOpacity={0.7}>
                  <Ionicons name="pencil" size={18} color={Colors.accent.cyan} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onDeleteShift(shift)} style={styles.deleteButton} activeOpacity={0.7}>
                  <Ionicons name="close-circle" size={20} color={Colors.accent.red} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
    borderWidth: 1,
    borderColor: Colors.accent.cyan + '40',
    borderStyle: 'dashed',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  scanButtonText: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.base,
    color: Colors.accent.cyan,
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  manualButtonText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    letterSpacing: 1,
  },
  manualForm: {
    backgroundColor: Colors.bg.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  formTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.sm,
    color: Colors.accent.cyan,
    letterSpacing: 1.5,
    marginBottom: Spacing.xs,
  },
  formLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  daySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  dayButton: {
    backgroundColor: Colors.bg.input,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  dayButtonActive: {
    backgroundColor: Colors.accent.purple + '30',
    borderColor: Colors.accent.purple,
  },
  dayButtonText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  dayButtonTextActive: {
    color: Colors.text.primary,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  timeInputContainer: {
    flex: 1,
  },
  timeInput: {
    backgroundColor: Colors.bg.input,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.text.primary,
    fontFamily: FontFamily.tech,
    fontSize: FontSize.lg,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent.green,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.base,
    color: Colors.text.inverse,
    fontWeight: '700',
    letterSpacing: 1,
  },
  formActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
  },
  cancelButtonText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.base,
    color: Colors.text.muted,
    fontWeight: '700',
    letterSpacing: 1,
  },
  updateButton: {
    flex: 1,
    backgroundColor: Colors.accent.cyan,
  },
  updateButtonText: {
    color: '#000',
  },
  wakeInputCard: {
    backgroundColor: Colors.bg.card,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: Spacing.lg,
  },
  wakeInputLabel: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.sm,
    color: Colors.text.muted,
    marginBottom: Spacing.sm,
  },
  wakeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bg.canvas,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  wakeInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    color: Colors.text.primary,
    fontFamily: FontFamily.tech,
    fontSize: FontSize.xl,
  },
  decisionCard: {
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.accent.green + '40',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  decisionCardWarning: {
    borderColor: Colors.accent.orange + '60',
    backgroundColor: 'rgba(217, 119, 6, 0.08)',
  },
  decisionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  decisionTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.xs,
    color: Colors.accent.green,
    letterSpacing: 1.5,
  },
  decisionTitleWarning: {
    color: Colors.accent.orange,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 49, 49, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    marginLeft: 'auto',
  },
  warningBadgeText: {
    fontFamily: FontFamily.mono,
    fontSize: 8,
    color: Colors.accent.red,
    letterSpacing: 1,
  },
  decisionText: {
    fontFamily: FontFamily.techRegular,
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  decisionHighlight: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.lg,
    color: Colors.accent.green,
  },
  decisionSubtext: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    color: Colors.text.muted,
  },
  decisionAction: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    lineHeight: 16,
  },
  decisionShiftRef: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    paddingTop: Spacing.xs,
  },
  commuteCard: {
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  commuteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  commuteTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.xs,
    color: Colors.accent.cyan,
    letterSpacing: 1.5,
  },
  commuteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  commuteInput: {
    width: 72,
    backgroundColor: Colors.bg.input,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text.primary,
    fontFamily: FontFamily.techSemi,
    textAlign: 'center',
  },
  commuteHint: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
  },
  commuteSub: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    lineHeight: 16,
  },
  timelineCard: {
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  timelineTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.xs,
    color: Colors.accent.indigo,
    letterSpacing: 1.5,
  },
  timelineList: {
    gap: 10,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 5,
  },
  timelineItemBody: {
    flex: 1,
    backgroundColor: Colors.bg.input,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  timelineItemTitle: {
    fontFamily: FontFamily.techSemi,
    color: Colors.text.primary,
    fontSize: FontSize.sm,
  },
  timelineItemDetail: {
    fontFamily: FontFamily.mono,
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    lineHeight: 16,
    marginTop: 3,
  },
  timeBarCard: {
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  timeBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  timeBarTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.xs,
    color: Colors.accent.cyan,
    letterSpacing: 1.5,
  },
  barContainer: {
    flexDirection: 'row',
    height: 32,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  barSegment: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 32,
  },
  barSleep: { backgroundColor: '#7C3AED' },
  barWork: { backgroundColor: '#6366F1' },
  barTransition: { backgroundColor: '#D97706' },
  barFree: { backgroundColor: '#00FF9D' },
  barSegmentLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: '#000',
    fontWeight: '700',
  },
  barLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  section: {
    marginBottom: Spacing.xxxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.lg,
    color: Colors.text.primary,
  },
  shiftsContainer: {
    gap: Spacing.sm,
  },
  shiftCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent.purple,
  },
  shiftDay: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  shiftTimeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  shiftTime: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  editButton: {
    padding: Spacing.xs,
  },
  deleteButton: {
    padding: Spacing.xs,
  },
});

export default SchedulePlannerPanel;
