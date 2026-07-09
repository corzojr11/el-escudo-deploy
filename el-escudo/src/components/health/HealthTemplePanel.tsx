import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { useAppStore } from '../../store';
import { PersonalRecord } from '../../types/api';
import RestTimer from './RestTimer';
import WorkoutTracker from './WorkoutTracker';
import GymOverview from './GymOverview';
import BioTimeline from '../BioTimeline';

interface HealthTemplePanelProps {
  onEditEquipment: () => void;
  onOpenQuickLog: () => void;
}

const PRCard = React.memo(({ pr }: { pr: PersonalRecord }) => (
  <BlurView intensity={20} tint="dark" style={styles.prCard}>
    <View style={styles.prIconContainer}>
      <Ionicons name="barbell" size={24} color={Colors.accent.gold} />
    </View>
    <View style={styles.prInfo}>
      <Text style={styles.prName}>{pr.exercise_name.toUpperCase()}</Text>
      <Text style={styles.prWeight}>{pr.max_weight} KG</Text>
    </View>
    <Text style={styles.prDate}>{new Date(pr.date).toLocaleDateString()}</Text>
  </BlurView>
));

const HealthTemplePanel: React.FC<HealthTemplePanelProps> = ({ onEditEquipment, onOpenQuickLog }) => {
  const navigation = useNavigation<any>();
  const {
    personalRecords,
    weightHistory,
    health,
    targetWakeTime,
    targetSleepTime,
    calculateSleepCycles,
    brainFog,
    lastWakeTimestamp,
    workShifts,
    setTargetSleepTime,
  } = useAppStore();
  const [sleepTimeDraft, setSleepTimeDraft] = useState(targetSleepTime);

  useEffect(() => {
    setSleepTimeDraft(targetSleepTime);
  }, [targetSleepTime]);

  const sortedWeightHistory = useMemo(
    () => [...weightHistory].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    [weightHistory]
  );

  const latestWeightEntry = sortedWeightHistory.at(-1) || null;
  const previousWeightEntry = sortedWeightHistory.length > 1 ? sortedWeightHistory[sortedWeightHistory.length - 2] : null;
  const weightDelta = latestWeightEntry && previousWeightEntry ? latestWeightEntry.weight - previousWeightEntry.weight : 0;
  const weightTrendLabel = latestWeightEntry && previousWeightEntry
    ? `${weightDelta >= 0 ? '+' : ''}${weightDelta.toFixed(1)} kg`
    : 'Sin tendencia';

  const bestRecord = useMemo(
    () => [...personalRecords].sort((a, b) => b.max_weight - a.max_weight)[0] || null,
    [personalRecords]
  );

  const lastWorkoutLabel = health.lastWorkoutDate
    ? new Date(health.lastWorkoutDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
    : 'Pendiente';

  const sleepWindows = useMemo(() => calculateSleepCycles(targetWakeTime), [calculateSleepCycles, targetWakeTime]);
  const optimalSleepWindow = sleepWindows[0] || null;
  const wakeHoursAgo = useMemo(() => {
    if (!lastWakeTimestamp) return null;
    const delta = Date.now() - new Date(lastWakeTimestamp).getTime();
    if (!Number.isFinite(delta) || delta < 0) return null;
    return Math.floor(delta / (1000 * 60 * 60));
  }, [lastWakeTimestamp]);
  const nextShift = useMemo(() => {
    const today = new Date();
    const todayIndex = today.getDay();
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return (
      workShifts.find((shift) => days.findIndex((day) => shift.day.toLowerCase().includes(day.toLowerCase())) >= todayIndex) ||
      workShifts[0] ||
      null
    );
  }, [workShifts]);

  const openEquipmentEditor = onEditEquipment;

  const sortedPersonalRecords = useMemo(
    () => [...personalRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [personalRecords]
  );

  const latestRecord = sortedPersonalRecords[0] || null;
  const sleepCoach = useMemo(() => {
    const recommendedSleep = optimalSleepWindow?.sleepTime || targetSleepTime;
    const recommendedWake = optimalSleepWindow?.wakeTime || targetWakeTime;
    const cycleCount = optimalSleepWindow?.cycles || 0;

    return {
      headline: optimalSleepWindow
        ? `${cycleCount} ciclos para despertar a las ${recommendedWake}`
        : 'Ajusta tu descanso para mañana',
      body: nextShift
        ? `Si mañana tienes turno a las ${nextShift.start}, deja tiempo para bajar revoluciones y dormir con calma.`
        : `Tu mejor ventana ahora mismo es ${recommendedSleep} a ${recommendedWake}.`,
    };
  }, [nextShift, optimalSleepWindow, targetSleepTime, targetWakeTime]);

  return (
    <View style={styles.sectionWrap}>
      <View style={styles.snapshotRow}>
        <View style={styles.snapshotCard}>
          <Text style={styles.snapshotLabel}>PESO ACTUAL</Text>
          <Text style={styles.snapshotValue}>
            {(latestWeightEntry?.weight ?? health.weight).toFixed(1)} <Text style={styles.snapshotUnit}>kg</Text>
          </Text>
          <Text style={styles.snapshotHint}>Tendencia {weightTrendLabel}</Text>
        </View>
        <View style={styles.snapshotCard}>
          <Text style={styles.snapshotLabel}>MEJOR MARCA</Text>
          <Text style={styles.snapshotValue}>{bestRecord ? `${bestRecord.max_weight.toFixed(1)} kg` : '--'}</Text>
          <Text style={styles.snapshotHint}>{bestRecord ? bestRecord.exercise_name : 'Aun sin marcas'}</Text>
        </View>
        <View style={styles.snapshotCard}>
          <Text style={styles.snapshotLabel}>ÚLTIMO ENTRENO</Text>
          <Text style={styles.snapshotValue}>{lastWorkoutLabel}</Text>
          <Text style={styles.snapshotHint}>{health.activeWorkoutSession ? 'Sesion activa' : 'Sin sesión activa'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>DESCANSO Y SUEÑO</Text>
          <TouchableOpacity style={styles.editMiniBtn} onPress={() => navigation.navigate('Turnos')}>
            <Text style={styles.editMiniBtnText}>AJUSTAR</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sleepHeroCard}>
          <View style={styles.sleepHeroTop}>
            <View style={styles.sleepIconBadge}>
              <Ionicons name="moon" size={18} color={Colors.accent.indigo} />
            </View>
            <View style={styles.sleepHeroText}>
              <Text style={styles.sleepHeroLabel}>META DE SUEÑO</Text>
              <Text style={styles.sleepHeroTitle}>
                {targetSleepTime} - {targetWakeTime}
              </Text>
              <Text style={styles.sleepHeroHint}>
                {optimalSleepWindow ? `${optimalSleepWindow.cycles} ciclos | ${optimalSleepWindow.hours}h sugeridas` : 'Ventana no disponible'}
              </Text>
            </View>
          </View>

          <View style={styles.sleepCoachCard}>
            <Text style={styles.sleepCoachLabel}>LECTURA RÁPIDA</Text>
            <Text style={styles.sleepCoachTitle}>{sleepCoach.headline}</Text>
            <Text style={styles.sleepCoachBody}>{sleepCoach.body}</Text>
            <View style={styles.sleepCoachTip}>
              <Text style={styles.sleepCoachTipText}>
                {optimalSleepWindow ? `Ventana: ${optimalSleepWindow.sleepTime} · ${optimalSleepWindow.wakeTime}` : 'Sin ventana recomendada todavía'}
              </Text>
            </View>
          </View>

          <View style={styles.sleepMetricsRow}>
            <View style={styles.sleepMetricCard}>
              <Text style={styles.sleepMetricLabel}>Neblina</Text>
              <Text style={styles.sleepMetricValue}>{brainFog}/10</Text>
            </View>
            <View style={styles.sleepMetricCard}>
              <Text style={styles.sleepMetricLabel}>Turno</Text>
              <Text style={styles.sleepMetricValue}>{nextShift ? nextShift.start : '--'}</Text>
            </View>
            <View style={styles.sleepMetricCard}>
              <Text style={styles.sleepMetricLabel}>Despertar</Text>
              <Text style={styles.sleepMetricValue}>{wakeHoursAgo !== null ? `${wakeHoursAgo}h` : '--'}</Text>
            </View>
          </View>

          <View style={styles.sleepEditBox}>
            <Text style={styles.sleepProtocolLabel}>AJUSTE RÁPIDO</Text>
            <View style={styles.sleepEditRow}>
              <TextInput
                style={styles.sleepInput}
                value={sleepTimeDraft}
                onChangeText={setSleepTimeDraft}
                placeholder="22:00"
                placeholderTextColor={Colors.text.muted}
              />
              <TouchableOpacity
                style={styles.sleepSaveBtn}
                onPress={() => setTargetSleepTime(sleepTimeDraft.trim() || targetSleepTime)}
              >
                <Text style={styles.sleepSaveBtnText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <BioTimeline />
      </View>

      <GymOverview onEditEquipment={openEquipmentEditor} />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>RUTINA DE HOY</Text>
          <Ionicons name="barbell-outline" size={16} color={Colors.accent.green} />
        </View>
        <WorkoutTracker />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>MARCAS PERSONALES</Text>
          <Ionicons name="trophy" size={16} color={Colors.accent.gold} />
        </View>
        <View style={styles.prSummaryRow}>
          <View style={styles.prSummaryCard}>
            <Text style={styles.prSummaryLabel}>TOTAL</Text>
            <Text style={styles.prSummaryValue}>{personalRecords.length}</Text>
            <Text style={styles.prSummaryHint}>ejercicios con PR</Text>
          </View>
          <View style={styles.prSummaryCard}>
            <Text style={styles.prSummaryLabel}>MAS FUERTE</Text>
            <Text style={styles.prSummaryValue}>{bestRecord ? `${bestRecord.max_weight.toFixed(1)} kg` : '--'}</Text>
            <Text style={styles.prSummaryHint}>{bestRecord ? bestRecord.exercise_name : 'sin datos'}</Text>
          </View>
          <View style={styles.prSummaryCard}>
            <Text style={styles.prSummaryLabel}>ULTIMO</Text>
            <Text style={styles.prSummaryValue}>{latestRecord ? `${latestRecord.max_weight.toFixed(1)} kg` : '--'}</Text>
            <Text style={styles.prSummaryHint}>{latestRecord ? latestRecord.exercise_name : 'sin registros'}</Text>
          </View>
        </View>
        <FlatList
          data={sortedPersonalRecords}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => <PRCard pr={item} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No hay records registrados aun.</Text>}
          ItemSeparatorComponent={() => <View style={styles.prSeparator} />}
        />
      </View>

      <TouchableOpacity style={styles.quickLogBtn} activeOpacity={0.9} onPress={onOpenQuickLog}>
        <LinearGradient colors={[Colors.accent.cyan, '#0891B2']} style={styles.gradientBtn}>
          <Ionicons name="add-circle" size={24} color="#000" />
          <Text style={styles.quickLogText}>REGISTRO RÁPIDO DE ENTRENAMIENTO</Text>
        </LinearGradient>
      </TouchableOpacity>

      <RestTimer />
    </View>
  );
};

const styles = StyleSheet.create({
  sectionWrap: {
    gap: Spacing.md,
  },
  snapshotRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  snapshotCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  snapshotLabel: {
    fontFamily: FontFamily.mono,
    color: Colors.text.muted,
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  snapshotValue: {
    fontFamily: FontFamily.techSemi,
    color: Colors.text.primary,
    fontSize: 15,
  },
  snapshotUnit: {
    fontFamily: FontFamily.mono,
    color: Colors.text.secondary,
    fontSize: 11,
  },
  snapshotHint: {
    fontFamily: FontFamily.mono,
    color: Colors.text.secondary,
    fontSize: 10,
    marginTop: 4,
    lineHeight: 14,
  },
  section: {
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  editMiniBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  editMiniBtnText: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.text.secondary,
    letterSpacing: 0.8,
  },
  sectionTitle: {
    fontFamily: FontFamily.mono,
    fontSize: 12,
    color: Colors.text.muted,
    letterSpacing: 1.5,
  },
  sleepHeroCard: {
    backgroundColor: 'rgba(4, 8, 18, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.18)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    overflow: 'hidden',
  },
  sleepHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sleepIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(124, 58, 237, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepHeroText: {
    flex: 1,
  },
  sleepHeroLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.text.muted,
    letterSpacing: 1,
  },
  sleepHeroTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: 18,
    color: Colors.text.primary,
    marginTop: 3,
  },
  sleepHeroHint: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.text.secondary,
    marginTop: 3,
  },
  sleepCoachCard: {
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.md,
    padding: 12,
    gap: 6,
  },
  sleepCoachLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.text.muted,
    letterSpacing: 1,
  },
  sleepCoachTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: 14,
    color: Colors.text.primary,
  },
  sleepCoachBody: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.text.secondary,
    lineHeight: 14,
  },
  sleepCoachTipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  sleepCoachTip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(124, 58, 237, 0.14)',
  },
  sleepCoachTipText: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.accent.indigo,
  },
  sleepMetricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sleepMetricCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 10,
  },
  sleepMetricLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.text.muted,
    letterSpacing: 0.8,
  },
  sleepMetricValue: {
    fontFamily: FontFamily.techSemi,
    fontSize: 14,
    color: Colors.text.primary,
    marginTop: 4,
  },
  sleepProtocolLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.text.muted,
    letterSpacing: 1,
    marginBottom: 2,
  },
  sleepEditBox: {
    gap: 8,
  },
  sleepEditRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sleepInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: Colors.text.primary,
    fontFamily: FontFamily.techSemi,
  },
  sleepSaveBtn: {
    backgroundColor: Colors.accent.indigo,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepSaveBtnText: {
    fontFamily: FontFamily.techSemi,
    fontSize: 12,
    color: '#000',
  },
  prSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
  },
  prSummaryCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.10)',
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  prSummaryLabel: {
    fontFamily: FontFamily.mono,
    color: Colors.text.muted,
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  prSummaryValue: {
    fontFamily: FontFamily.techSemi,
    color: Colors.accent.gold,
    fontSize: 15,
  },
  prSummaryHint: {
    fontFamily: FontFamily.mono,
    color: Colors.text.secondary,
    fontSize: 10,
    marginTop: 4,
    lineHeight: 14,
  },
  prGrid: { gap: 12 },
  prSeparator: { height: 12 },
  prCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.10)',
    boxShadow: '0 8px 18px rgba(0,0,0,0.26)',
  },
  prIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  prInfo: { flex: 1 },
  prName: {
    fontFamily: FontFamily.techSemi,
    fontSize: 14,
    color: '#FFF',
  },
  prWeight: {
    fontFamily: FontFamily.mono,
    fontSize: 18,
    color: Colors.accent.gold,
    fontWeight: '800',
  },
  prDate: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.text.muted,
  },
  quickLogBtn: {
    marginTop: 20,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    boxShadow: '0 10px 26px rgba(34, 211, 238, 0.24)',
  },
  gradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  quickLogText: {
    fontFamily: FontFamily.tech,
    fontSize: 14,
    color: '#000',
    letterSpacing: 1,
  },
  emptyText: {
    color: Colors.text.muted,
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
});

export default HealthTemplePanel;
