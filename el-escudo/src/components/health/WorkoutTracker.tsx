import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { useAppStore } from '../../store';
import SetRow from './SetRow';

const WorkoutTracker: React.FC = () => {
  const { health, startWorkoutSession, addSetToExercise, finishAndLogSession } = useAppStore();
  const session = health.activeWorkoutSession;
  const today = new Date().getDay();
  const todaysRoutine = health.routine[today];
  const equipmentInventory = health.equipmentInventory || [];
  const equipmentSet = useMemo(
    () => new Set(equipmentInventory.map((item) => item.toLowerCase())),
    [equipmentInventory]
  );

  const sessionStats = useMemo(() => {
    if (!session) return null;
    const totalSets = session.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
    const completedSets = session.exercises.reduce((acc, ex) => acc + ex.sets.filter((s) => s.done).length, 0);
    const totalExercises = session.exercises.length;
    const completedExercises = session.exercises.filter((ex) => ex.sets.every((s) => s.done)).length;
    const completion = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
    const nextExercise = session.exercises.find((ex) => ex.sets.some((s) => !s.done)) || session.exercises[0] || null;
    return { totalSets, completedSets, totalExercises, completedExercises, completion, nextExercise };
  }, [session]);

  const getCompatibleVariants = (exerciseName: string) => {
    const name = exerciseName.toLowerCase();
    const hasDumbbells = equipmentSet.has('mancuernas convertibles');
    const hasBar = equipmentSet.has('barra conectora');
    const hasKettlebell = equipmentSet.has('peso ruso');

    if (name.includes('press militar')) {
      return [
        hasDumbbells ? 'Press militar con mancuernas' : null,
        hasBar ? 'Press militar con barra' : null,
      ].filter(Boolean) as string[];
    }
    if (name.includes('curl')) {
      return [
        hasDumbbells ? 'Curl alterno con mancuernas' : null,
        hasDumbbells ? 'Curl martillo' : null,
      ].filter(Boolean) as string[];
    }
    if (name.includes('press de pecho') || name.includes('press cerrado')) {
      return [
        hasDumbbells ? 'Press de pecho con mancuernas en el suelo' : null,
        hasBar ? 'Press con barra en el suelo' : null,
      ].filter(Boolean) as string[];
    }
    if (name.includes('remo')) {
      return [
        hasDumbbells ? 'Remo a una mano con mancuerna' : null,
        hasBar ? 'Remo inclinado con barra' : null,
      ].filter(Boolean) as string[];
    }
    if (name.includes('sentadilla')) {
      return [
        hasKettlebell ? 'Sentadilla goblet con peso ruso' : null,
        hasDumbbells ? 'Sentadilla goblet con mancuerna' : null,
        hasBar ? 'Sentadilla frontal con barra conectora' : null,
      ].filter(Boolean) as string[];
    }
    if (name.includes('peso muerto')) {
      return [
        hasBar ? 'Peso muerto rumano con barra' : null,
        hasDumbbells ? 'Peso muerto rumano con mancuernas' : null,
      ].filter(Boolean) as string[];
    }
    if (name.includes('hip thrust')) {
      return [
        hasBar ? 'Hip thrust con barra' : null,
        hasDumbbells ? 'Hip thrust con mancuerna' : null,
      ].filter(Boolean) as string[];
    }
    return [
      hasDumbbells ? 'Variante con mancuernas' : null,
      hasBar ? 'Variante con barra' : null,
    ].filter(Boolean) as string[];
  };

  const inferMuscles = (exerciseName: string) => {
    const name = exerciseName.toLowerCase();
    const tags = new Set<string>();
    if (/(press|pecho|apertura|fly|flexion)/.test(name)) {
      tags.add('Pecho');
      tags.add('Hombros');
      tags.add('Triceps');
    }
    if (/(curl|martillo|biceps|bíceps)/.test(name)) {
      tags.add('Biceps');
      tags.add('Antebrazo');
    }
    if (/(remo|jalon|jalón|espalda|pull)/.test(name)) {
      tags.add('Espalda');
      tags.add('Biceps');
    }
    if (/(sentadilla|zancada|lunge|cuadriceps|cuádriceps)/.test(name)) {
      tags.add('Cuadriceps');
      tags.add('Gluteos');
    }
    if (/(peso muerto|rumano|deadlift|hip thrust)/.test(name)) {
      tags.add('Femorales');
      tags.add('Gluteos');
      tags.add('Core');
    }
    return Array.from(tags).slice(0, 3);
  };

  if (!session) {
    return (
      <View style={styles.emptyContainer}>
        {todaysRoutine ? (
          <>
            <View style={styles.routinePreview}>
              <View style={styles.previewTopRow}>
                <View style={styles.previewBadge}>
                  <Text style={styles.previewBadgeText}>HOY</Text>
                </View>
                <Text style={styles.previewCount}>{todaysRoutine.exercises.length} EJERCICIOS</Text>
              </View>
              <Text style={styles.routineTitle}>{todaysRoutine.name}</Text>
              {todaysRoutine.objective ? <Text style={styles.routineObjective}>{todaysRoutine.objective}</Text> : null}
              <View style={styles.previewMetaRow}>
                {typeof todaysRoutine.estimatedMinutes === 'number' ? (
                  <View style={styles.previewMetaChip}>
                    <Text style={styles.previewMetaLabel}>DURACION</Text>
                    <Text style={styles.previewMetaValue}>{todaysRoutine.estimatedMinutes} min</Text>
                  </View>
                ) : null}
                <View style={styles.previewMetaChip}>
                  <Text style={styles.previewMetaLabel}>TIPO</Text>
                  <Text style={styles.previewMetaValue}>{todaysRoutine.name}</Text>
                </View>
              </View>
              <Text style={styles.routineSubtitle}>{todaysRoutine.exercises.length} ejercicios programados</Text>
              {todaysRoutine.notes?.length ? (
                <View style={styles.noteList}>
                  {todaysRoutine.notes.slice(0, 3).map((note) => (
                    <View key={note} style={styles.noteItem}>
                      <Text style={styles.noteBullet}>•</Text>
                      <Text style={styles.noteText}>{note}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={styles.previewList}>
                {todaysRoutine.exercises.slice(0, 4).map((exercise) => (
                  <View key={exercise.id} style={styles.previewChip}>
                    <Text style={styles.previewChipText}>{exercise.name}</Text>
                  </View>
                ))}
              </View>
            </View>
            <TouchableOpacity style={styles.startBtn} onPress={() => startWorkoutSession(today)}>
              <Text style={styles.startBtnText}>INICIAR ENTRENAMIENTO</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.restDay}>
            <Ionicons name="bed-outline" size={48} color={Colors.text.muted} />
            <Text style={styles.restText}>Dia de descanso.</Text>
            <Text style={styles.restSubText}>Hoy no hay rutina programada. Aprovecha para recuperar y registrar peso si toca.</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {sessionStats ? (
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>PROGRESO DE SESION</Text>
            <Text style={styles.summaryPercent}>{sessionStats.completion}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${sessionStats.completion}%` }]} />
          </View>
          <View style={styles.summaryMeta}>
            <Text style={styles.summaryMetaText}>{sessionStats.completedSets}/{sessionStats.totalSets} series</Text>
            <Text style={styles.summaryMetaText}>{sessionStats.completedExercises}/{sessionStats.totalExercises} ejercicios</Text>
          </View>
          {sessionStats.nextExercise ? (
            <Text style={styles.nextExercise}>Siguiente foco: {sessionStats.nextExercise.name}</Text>
          ) : null}
        </View>
      ) : null}

      {session.exercises.map((ex, exIndex) => {
        const variants = getCompatibleVariants(ex.name);
        const muscles = inferMuscles(ex.name);

        return (
          <View key={ex.id} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <View>
                <Text style={styles.exerciseTitle}>{ex.name}</Text>
                <Text style={styles.exerciseSubtitle}>{ex.sets.filter((s) => s.done).length}/{ex.sets.length} series completas</Text>
              </View>
              <View style={styles.exerciseBadge}>
                <Text style={styles.exerciseBadgeText}>#{exIndex + 1}</Text>
              </View>
            </View>

            {muscles.length > 0 ? (
              <View style={styles.exerciseMetaRow}>
                <View style={styles.exerciseMetaBlock}>
                  <Text style={styles.exerciseMetaLabel}>MUSCULOS</Text>
                  <View style={styles.exerciseMetaChips}>
                    {muscles.map((muscle) => (
                      <View key={muscle} style={styles.exerciseMetaChip}>
                        <Text style={styles.exerciseMetaChipText}>{muscle}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ) : null}

            <View style={styles.seriesBoard}>
              <View style={styles.tableHeader}>
                <Text style={styles.thSet}>SET</Text>
                <Text style={styles.thVal}>KG</Text>
                <Text style={styles.thVal}>REPS</Text>
                <Text style={styles.thCheck}>✓</Text>
              </View>
              {ex.sets.map((set, setIndex) => (
                <SetRow key={set.id} exerciseId={ex.id} setIndex={setIndex} setData={set} />
              ))}
            </View>

            {variants.length > 0 ? (
              <View style={styles.variantBox}>
                <Text style={styles.variantLabel}>VARIANTES</Text>
                <View style={styles.variantList}>
                  {variants.slice(0, 2).map((variant) => (
                    <View key={variant} style={styles.variantChip}>
                      <Text style={styles.variantChipText}>{variant}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <TouchableOpacity style={styles.addSetBtn} onPress={() => addSetToExercise(ex.id)}>
              <Text style={styles.addSetText}>+ Anadir Serie</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      <TouchableOpacity
        style={styles.finishBtn}
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          finishAndLogSession();
        }}
      >
        <Ionicons name="flag" size={18} color={Colors.bg.primary} />
        <Text style={styles.finishBtnText}>FINALIZAR RUTINA</Text>
      </TouchableOpacity>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  emptyContainer: { flex: 1, padding: Spacing.xl, justifyContent: 'center', backgroundColor: 'rgba(3, 7, 16, 0.98)', borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  routinePreview: {
    backgroundColor: 'rgba(4, 8, 18, 0.96)',
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: Spacing.xl,
    gap: Spacing.md,
    overflow: 'hidden',
  },
  previewTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  previewBadge: { backgroundColor: 'rgba(0, 255, 157, 0.12)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(0, 255, 157, 0.28)' },
  previewBadgeText: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.accent.green, letterSpacing: 1 },
  previewCount: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.muted, letterSpacing: 1 },
  routineTitle: { fontFamily: FontFamily.tech, fontSize: FontSize.lg, color: Colors.text.primary },
  routineObjective: { fontFamily: FontFamily.mono, fontSize: 11, color: Colors.text.secondary, marginTop: 8, lineHeight: 16 },
  previewMetaRow: { flexDirection: 'row', gap: 8, marginTop: Spacing.md },
  previewMetaChip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  previewMetaLabel: { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.text.muted, letterSpacing: 0.8 },
  previewMetaValue: { fontFamily: FontFamily.techSemi, fontSize: 12, color: Colors.text.primary, marginTop: 3 },
  routineSubtitle: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.text.muted, marginTop: 4 },
  noteList: { marginTop: Spacing.sm, gap: 6 },
  noteItem: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  noteBullet: { fontFamily: FontFamily.techSemi, color: Colors.accent.green, fontSize: 12, lineHeight: 16 },
  noteText: { flex: 1, fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.secondary, lineHeight: 14 },
  previewList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.lg },
  previewChip: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  previewChipText: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.secondary },
  startBtn: {
    backgroundColor: Colors.accent.green,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    shadowColor: Colors.accent.green,
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  startBtnText: { fontFamily: FontFamily.tech, color: Colors.bg.primary, fontSize: FontSize.md },
  restDay: { alignItems: 'center', opacity: 0.78, paddingVertical: 18 },
  restText: { fontFamily: FontFamily.techSemi, color: Colors.text.secondary, marginTop: Spacing.md, fontSize: FontSize.lg },
  restSubText: { fontFamily: FontFamily.mono, color: Colors.text.muted, marginTop: 10, fontSize: 11, textAlign: 'center', lineHeight: 16 },
  scroll: { padding: Spacing.base, gap: Spacing.lg },
  summaryCard: {
    backgroundColor: 'rgba(4, 8, 18, 0.96)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryTitle: { fontFamily: FontFamily.mono, fontSize: 11, color: Colors.text.muted, letterSpacing: 1.2 },
  summaryPercent: { fontFamily: FontFamily.techSemi, fontSize: 18, color: Colors.accent.green },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden', marginTop: 12 },
  progressFill: { height: '100%', backgroundColor: Colors.accent.green, borderRadius: 999 },
  summaryMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  summaryMetaText: { fontFamily: FontFamily.mono, fontSize: 11, color: Colors.text.secondary },
  nextExercise: { fontFamily: FontFamily.techSemi, fontSize: 12, color: Colors.text.primary, marginTop: 10 },
  exerciseCard: {
    backgroundColor: 'rgba(4, 8, 18, 0.96)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  exerciseTitle: { fontFamily: FontFamily.techSemi, fontSize: FontSize.md, color: Colors.accent.orange },
  exerciseSubtitle: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.muted, marginTop: 4 },
  exerciseBadge: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  exerciseBadgeText: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.secondary },
  exerciseMetaRow: { gap: 8, marginBottom: Spacing.sm },
  exerciseMetaBlock: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.md,
    padding: 10,
  },
  exerciseMetaLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.text.muted,
    letterSpacing: 1,
    marginBottom: 6,
  },
  exerciseMetaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  exerciseMetaChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,255,157,0.18)',
    backgroundColor: 'rgba(0,255,157,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  exerciseMetaGhost: {
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  exerciseMetaChipText: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.text.secondary,
  },
  seriesBoard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  variantBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  variantLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.text.muted,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  variantList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  variantChip: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  variantChipText: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.text.primary,
  },
  tableHeader: { flexDirection: 'row', paddingBottom: 8, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', gap: 12 },
  thSet: { width: 24, textAlign: 'center', fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.muted },
  thVal: { flex: 1, textAlign: 'center', fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.muted },
  thCheck: { width: 32, textAlign: 'center', fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.muted },
  addSetBtn: { marginTop: Spacing.md, alignSelf: 'center', padding: Spacing.sm },
  addSetText: { fontFamily: FontFamily.techSemi, fontSize: FontSize.sm, color: Colors.text.muted },
  finishBtn: { flexDirection: 'row', backgroundColor: Colors.accent.green, padding: Spacing.md, borderRadius: BorderRadius.xl, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.xl, shadowColor: Colors.accent.green, shadowOpacity: 0.24, shadowRadius: 16 },
  finishBtnText: { fontFamily: FontFamily.tech, color: Colors.bg.primary, fontSize: FontSize.md },
});

export default WorkoutTracker;
