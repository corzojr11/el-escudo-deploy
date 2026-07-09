import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { useAppStore } from '../../store';
import type { RoutineDay, RoutineExercise } from '../../store/slices/healthSlice';

type MuscleKey =
  | 'pecho'
  | 'espalda'
  | 'hombros'
  | 'biceps'
  | 'triceps'
  | 'antebrazo'
  | 'core'
  | 'cuadriceps'
  | 'femorales'
  | 'gluteos'
  | 'pantorrillas'
  | 'trapecio';

type MuscleMeta = {
  key: MuscleKey;
  label: string;
  side: 'front' | 'back';
  color: string;
  aliases: string[];
};

const MUSCLES: MuscleMeta[] = [
  { key: 'pecho', label: 'Pecho', side: 'front', color: Colors.accent.cyan, aliases: ['pecho', 'pectoral', 'press de pecho', 'fly'] },
  { key: 'hombros', label: 'Hombros', side: 'front', color: Colors.accent.green, aliases: ['hombros', 'deltoides', 'militar', 'elevaciones laterales'] },
  { key: 'biceps', label: 'Bíceps', side: 'front', color: Colors.accent.orange, aliases: ['biceps', 'bíceps', 'curl', 'martillo'] },
  { key: 'antebrazo', label: 'Antebrazo', side: 'front', color: Colors.accent.purple, aliases: ['antebrazo', 'muñeca', 'muñecas', 'forearm'] },
  { key: 'core', label: 'Core', side: 'front', color: Colors.accent.gold, aliases: ['core', 'abdomen', 'abdominal', 'abs'] },
  { key: 'cuadriceps', label: 'Cuádriceps', side: 'front', color: Colors.accent.green, aliases: ['cuadriceps', 'cuádriceps', 'sentadilla', 'zancada', 'split squat'] },
  { key: 'espalda', label: 'Espalda', side: 'back', color: Colors.accent.cyan, aliases: ['espalda', 'remo', 'jalon', 'jalón', 'pull', 'lat'] },
  { key: 'trapecio', label: 'Trapecio', side: 'back', color: Colors.accent.orange, aliases: ['trapecio', 'shrug'] },
  { key: 'triceps', label: 'Tríceps', side: 'back', color: Colors.accent.green, aliases: ['triceps', 'tríceps', 'extension', 'press cerrado'] },
  { key: 'gluteos', label: 'Glúteos', side: 'back', color: Colors.accent.gold, aliases: ['gluteos', 'glúteos', 'hip thrust'] },
  { key: 'femorales', label: 'Femorales', side: 'back', color: Colors.accent.purple, aliases: ['femorales', 'isquios', 'peso muerto', 'rumano'] },
  { key: 'pantorrillas', label: 'Pantorrillas', side: 'back', color: Colors.accent.indigo, aliases: ['pantorrillas', 'gemelos', 'calf'] },
];

const MUSCLE_META_BY_KEY = new Map<MuscleKey, MuscleMeta>(MUSCLES.map((meta) => [meta.key, meta]));
const MUSCLE_LOOKUP = new Map<string, MuscleKey>();

MUSCLES.forEach((meta) => {
  MUSCLE_LOOKUP.set(meta.key, meta.key);
  meta.aliases.forEach((alias) => {
    MUSCLE_LOOKUP.set(normalizeText(alias), meta.key);
  });
});

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const inferMusclesFromExercise = (exerciseName: string): MuscleKey[] => {
  const name = normalizeText(exerciseName);
  const matches: MuscleKey[] = [];

  if (/(press|pecho|flexion|apertura|fly)/.test(name)) {
    matches.push('pecho', 'triceps', 'hombros');
  }
  if (/(curl|martillo|biceps|bíceps)/.test(name)) {
    matches.push('biceps', 'antebrazo');
  }
  if (/(remo|jalon|jalón|espalda|pull)/.test(name)) {
    matches.push('espalda', 'biceps');
  }
  if (/(sentadilla|zancada|lunge|quad|cuadriceps|cuádriceps)/.test(name)) {
    matches.push('cuadriceps', 'gluteos', 'core');
  }
  if (/(peso muerto|rumano|deadlift)/.test(name)) {
    matches.push('femorales', 'gluteos', 'espalda', 'core');
  }
  if (/(hip thrust|puente)/.test(name)) {
    matches.push('gluteos', 'femorales');
  }
  if (/(militar|elevacion lateral|elevaciones laterales|hombro)/.test(name)) {
    matches.push('hombros', 'triceps');
  }
  if (/(triceps|tríceps|extension|extensión|fondos|press cerrado)/.test(name)) {
    matches.push('triceps');
  }
  if (/(muñeca|muneca|wrist|reverse curl)/.test(name)) {
    matches.push('antebrazo');
  }
  if (/(gemelo|pantorrilla|calf)/.test(name)) {
    matches.push('pantorrillas');
  }

  return Array.from(new Set(matches));
};

const resolveMuscles = (exerciseName: string, declared: string[] = []) => {
  const tags = [...declared, ...inferMusclesFromExercise(exerciseName)];
  return Array.from(
    new Set(
      tags
        .map((tag) => MUSCLE_LOOKUP.get(normalizeText(String(tag))))
        .filter((tag): tag is MuscleKey => Boolean(tag))
    )
  );
};

interface GymOverviewProps {
  onEditEquipment?: () => void;
}

const GymOverview: React.FC<GymOverviewProps> = ({ onEditEquipment }) => {
  const { health } = useAppStore();
  const routineEntries = useMemo(
    () =>
      Object.entries(health.routine || {})
        .map(([dayIndex, day]) => ({ dayIndex: Number(dayIndex), day }))
        .filter((entry) => !!entry.day)
        .sort((a, b) => a.dayIndex - b.dayIndex),
    [health.routine]
  );

  const muscleVolume = useMemo(() => {
    const map = new Map<MuscleKey, number>();
    routineEntries.forEach(({ day }) => {
      day?.exercises.forEach((exercise) => {
        const muscles = resolveMuscles(exercise.name, exercise.muscles || []);
        const load = Math.max(1, Number(exercise.suggestedSets || 1));
        muscles.forEach((muscle) => {
          map.set(muscle, (map.get(muscle) || 0) + load);
        });
      });
    });
    return map;
  }, [routineEntries]);

  const [selectedMuscle, setSelectedMuscle] = useState<MuscleKey | null>(null);
  const muscleEntries = useMemo(
    () =>
      Array.from(muscleVolume.entries())
        .map(([key, volume]) => ({
          key,
          volume,
          meta: MUSCLE_META_BY_KEY.get(key) || null,
        }))
        .filter((entry): entry is { key: MuscleKey; volume: number; meta: MuscleMeta } => Boolean(entry.meta)),
    [muscleVolume]
  );
  const selectedMuscleMeta = selectedMuscle ? MUSCLE_META_BY_KEY.get(selectedMuscle) || null : null;
  const selectedMuscleVolume = selectedMuscle ? muscleVolume.get(selectedMuscle) || 0 : 0;
  const weeklyRoutineCards = useMemo(
    () =>
      DAY_LABELS.map((label, dayIndex) => {
        const routine = health.routine[dayIndex];
        const isToday = new Date().getDay() === dayIndex;
        return {
          dayIndex,
          label,
          name: routine?.name || 'Descanso',
          exercises: routine?.exercises?.length || 0,
          estimatedMinutes: routine?.estimatedMinutes || 0,
          active: Boolean(routine),
          isToday,
        };
      }),
    [health.routine]
  );

  const splitSummary = useMemo(() => {
    const tags = weeklyRoutineCards
      .filter((day) => day.active)
      .map((day) => {
        const name = normalizeText(day.name);
        if (name.includes('brazo')) return 'Brazo';
        if (name.includes('torso') || name.includes('pecho') || name.includes('espalda')) return 'Torso';
        if (name.includes('pierna')) return 'Pierna';
        return day.name.split(' ')[0];
      });
    return Array.from(new Set(tags)).slice(0, 3).join(' / ') || 'Sin split cargado';
  }, [weeklyRoutineCards]);

  const maxVolume = useMemo(() => Math.max(1, ...muscleEntries.map((entry) => entry.volume)), [muscleEntries]);

  const totals = useMemo(() => {
    const totalDays = routineEntries.length;
    const totalExercises = routineEntries.reduce((acc, { day }) => acc + (day?.exercises.length || 0), 0);
    const totalSets = routineEntries.reduce((acc, { day }) => {
      return acc + (day?.exercises.reduce((setsAcc, exercise) => setsAcc + Number(exercise.suggestedSets || 0), 0) || 0);
    }, 0);
    return { totalDays, totalExercises, totalSets };
  }, [routineEntries]);

  const topMuscles = useMemo(
    () =>
      [...muscleEntries]
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 4)
        .map((entry) => ({ ...(entry.meta as MuscleMeta), volume: entry.volume })) as Array<MuscleMeta & { volume: number }>,
    [muscleEntries]
  );

  const renderLimbBar = (muscle: MuscleKey) => {
    const volume = muscleVolume.get(muscle) || 0;
    const intensity = Math.max(0.12, volume / maxVolume);
    const meta = MUSCLE_META_BY_KEY.get(muscle);
    return (
      <TouchableOpacity key={muscle} activeOpacity={0.85} onPress={() => setSelectedMuscle(muscle)} style={styles.limbStat}>
        <View style={styles.limbHeader}>
          <Text style={styles.limbLabel}>{meta?.label || muscle}</Text>
          <Text style={styles.limbValue}>{volume}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${intensity * 100}%`, backgroundColor: meta?.color || Colors.accent.green }]} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>ESTADISTICAS DE GYM</Text>
          <Text style={styles.subtitle}>Distribucion corporal, volumen y equipo disponible.</Text>
        </View>
        <View style={styles.badge}>
          <Ionicons name="barbell-outline" size={14} color={Colors.accent.green} />
          <Text style={styles.badgeText}>{totals.totalDays} dias activos</Text>
        </View>
      </View>

      <View style={styles.pulseCard}>
        <View style={styles.pulseHeader}>
          <Ionicons name="flash" size={14} color={Colors.accent.green} />
          <Text style={styles.pulseTitle}>Lectura rápida</Text>
        </View>
        <Text style={styles.pulseHeadline}>
          {totals.totalDays > 0 ? `${totals.totalExercises} ejercicios · ${totals.totalSets} series` : 'Aún no hay rutina cargada'}
        </Text>
        <Text style={styles.pulseBody}>
          {totals.totalDays > 0
            ? `Hoy toca ${weeklyRoutineCards.find((day) => day.isToday)?.name || 'descanso'} y la mayor carga está en ${topMuscles[0]?.label || 'espera'}.`
            : 'Carga tu equipo y rutina para que Navir pueda proponerte mejores sesiones.'}
        </Text>
        <View style={styles.pulseChips}>
          <View style={styles.pulseChip}><Text style={styles.pulseChipText}>{totals.totalDays} días activos</Text></View>
          <View style={styles.pulseChip}><Text style={styles.pulseChipText}>{totals.totalExercises} ejercicios</Text></View>
          <View style={styles.pulseChip}><Text style={styles.pulseChipText}>{health.equipmentInventory.length} equipos</Text></View>
        </View>
      </View>

      <View style={styles.dayStrip}>
        {DAY_LABELS.map((label, index) => {
          const routine = health.routine[index];
          const count = routine?.exercises.length || 0;
          const active = !!routine;
          const today = new Date().getDay() === index;
          return (
            <View key={label} style={[styles.dayChip, active && styles.dayChipActive, today && styles.dayChipToday]}>
              <Text style={[styles.dayChipLabel, active && styles.dayChipLabelActive]}>{label}</Text>
              <Text style={[styles.dayChipValue, active && styles.dayChipValueActive]}>{count || '-'}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>SERIES</Text>
          <Text style={styles.statValue}>{totals.totalSets}</Text>
          <Text style={styles.statHint}>programadas por semana</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>EJERCICIOS</Text>
          <Text style={styles.statValue}>{totals.totalExercises}</Text>
          <Text style={styles.statHint}>incluidos en la rutina</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>EQUIPO</Text>
          <Text style={styles.statValue}>{health.equipmentInventory.length}</Text>
          <Text style={styles.statHint}>elementos detectados</Text>
        </View>
      </View>

      <View style={styles.routineBoard}>
        <View style={styles.routineBoardHeader}>
          <View>
            <Text style={styles.sectionLabel}>PLAN SEMANAL DEL GIMNASIO</Text>
            <Text style={styles.routineBoardSub}>{splitSummary} · {health.equipmentInventory.length} equipos listos.</Text>
          </View>
          <View style={styles.routineBoardBadge}>
            <Ionicons name="flash" size={12} color={Colors.accent.green} />
            <Text style={styles.routineBoardBadgeText}>NAVIR lo puede regenerar por voz</Text>
          </View>
        </View>
        <View style={styles.routineBoardGrid}>
          {weeklyRoutineCards.map((item) => (
            <View
              key={item.dayIndex}
              style={[
                styles.routineDayCard,
                item.active && styles.routineDayCardActive,
                item.isToday && styles.routineDayCardToday,
              ]}
            >
              <View style={styles.routineDayTop}>
                <Text style={styles.routineDayLabel}>{item.label}</Text>
                <Text style={styles.routineDayCount}>{item.exercises || "-"}</Text>
              </View>
              <Text style={styles.routineDayName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.routineDayMetaText}>{item.active ? `${item.estimatedMinutes || "--"} min` : "descanso"}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.volumeCard}>
        <View style={styles.volumeHeader}>
          <View>
            <Text style={styles.sectionLabel}>VOLUMEN POR GRUPO</Text>
          </View>
          <Text style={styles.weekLegendText}>{selectedMuscleMeta ? selectedMuscleVolume : topMuscles.length} series</Text>
        </View>
        <Text style={styles.weekSub}>{selectedMuscleMeta ? `${selectedMuscleMeta.label} tiene ${selectedMuscleVolume} series.` : "Toca una barra para revisar el detalle."}</Text>
        <View style={styles.limbList}>
          {topMuscles.slice(0, 5).map((muscle) => renderLimbBar(muscle.key))}
        </View>
      </View>

      <View style={styles.equipmentCard}>
        <View style={styles.equipmentHeader}>
          <Text style={styles.sectionLabel}>EQUIPO LISTO PARA USAR</Text>
          <TouchableOpacity onPress={onEditEquipment} disabled={!onEditEquipment}>
            <Text style={styles.equipmentAction}>EDITAR</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.equipmentList}>
          {health.equipmentInventory.length > 0 ? health.equipmentInventory.map((item) => (
            <View key={item} style={styles.equipmentChip}>
              <Text style={styles.equipmentChipText}>{item}</Text>
            </View>
          )) : (
            <Text style={styles.emptyText}>No hay equipo cargado.</Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(3, 7, 16, 0.98)',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: Spacing.lg,
    gap: Spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    fontFamily: FontFamily.techSemi,
    color: Colors.text.primary,
    fontSize: FontSize.md,
    letterSpacing: 0.9,
  },
  subtitle: {
    fontFamily: FontFamily.mono,
    color: Colors.text.muted,
    fontSize: 10,
    marginTop: 4,
    lineHeight: 14,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: `${Colors.accent.green}44`,
    backgroundColor: 'rgba(0,255,157,0.08)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontFamily: FontFamily.mono,
    color: Colors.accent.green,
    fontSize: 10,
  },
  dayStrip: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  dayChip: {
    width: 42,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
  },
  dayChipActive: {
    borderColor: `${Colors.accent.green}55`,
    backgroundColor: 'rgba(0,255,157,0.06)',
  },
  dayChipToday: {
    shadowColor: Colors.accent.cyan,
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  dayChipLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.text.muted,
  },
  dayChipLabelActive: {
    color: Colors.text.secondary,
  },
  dayChipValue: {
    fontFamily: FontFamily.techSemi,
    fontSize: 14,
    color: Colors.text.secondary,
  },
  dayChipValueActive: {
    color: Colors.text.primary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  routineBoard: {
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  routineBoardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  routineBoardSub: {
    fontFamily: FontFamily.mono,
    color: Colors.text.secondary,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4,
  },
  routineBoardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${Colors.accent.green}33`,
    backgroundColor: 'rgba(0,255,157,0.08)',
  },
  routineBoardBadgeText: {
    fontFamily: FontFamily.mono,
    color: Colors.accent.green,
    fontSize: 9,
    letterSpacing: 0.4,
  },
  routineBoardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  routineDayCard: {
    width: '31%',
    minWidth: 96,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 10,
    gap: 4,
  },
  routineDayCardActive: {
    borderColor: `${Colors.accent.green}44`,
    backgroundColor: 'rgba(0,255,157,0.05)',
  },
  routineDayCardToday: {
    shadowColor: Colors.accent.cyan,
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 3,
  },
  routineDayTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routineDayLabel: {
    fontFamily: FontFamily.mono,
    color: Colors.text.muted,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  routineDayCount: {
    fontFamily: FontFamily.techSemi,
    color: Colors.accent.green,
    fontSize: 12,
  },
  routineDayName: {
    fontFamily: FontFamily.techSemi,
    color: Colors.text.primary,
    fontSize: 12,
    lineHeight: 15,
  },
  routineDayObjective: {
    fontFamily: FontFamily.mono,
    color: Colors.text.secondary,
    fontSize: 9,
    lineHeight: 12,
    minHeight: 24,
  },
  routineDayMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  routineDayMetaText: {
    fontFamily: FontFamily.mono,
    color: Colors.text.muted,
    fontSize: 8,
    letterSpacing: 0.2,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
  },
  statLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.text.muted,
    letterSpacing: 1,
  },
  statValue: {
    fontFamily: FontFamily.techSemi,
    fontSize: 18,
    color: Colors.text.primary,
    marginTop: 4,
  },
  statHint: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  figureGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  figureCard: {
    flex: 1,
    backgroundColor: 'rgba(4, 8, 18, 0.96)',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    overflow: 'hidden',
    boxShadow: '0 18px 40px rgba(0,0,0,0.38)',
    gap: 10,
  },
  figureHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  figureTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: 12,
    color: Colors.text.primary,
    letterSpacing: 0.6,
  },
  figureSubtitle: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.text.secondary,
    marginTop: 4,
    lineHeight: 13,
  },
  figureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  figureBadgeText: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.text.muted,
  },
  figureHint: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    textAlign: 'center',
    fontFamily: FontFamily.mono,
    fontSize: 8,
    color: Colors.text.muted,
    letterSpacing: 0.7,
  },
  figureLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  figure: {
    width: 128,
    height: 244,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  figureFrame: {
    position: 'absolute',
    top: 0,
    left: 30,
    width: 68,
    height: 236,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.015)',
  },
  head: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(250,250,250,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    marginTop: 4,
  },
  neck: {
    width: 12,
    height: 10,
    backgroundColor: 'rgba(250,250,250,0.14)',
    borderRadius: 999,
    marginTop: 2,
  },
  shoulders: {
    width: 78,
    height: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(250,250,250,0.12)',
    marginTop: 4,
  },
  torso: {
    width: 58,
    height: 82,
    borderRadius: 28,
    backgroundColor: 'rgba(250,250,250,0.09)',
    marginTop: -2,
  },
  spine: {
    position: 'absolute',
    top: 64,
    width: 4,
    height: 116,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  armLeft: {
    position: 'absolute',
    left: 10,
    top: 54,
    width: 12,
    height: 90,
    borderRadius: 999,
    backgroundColor: 'rgba(250,250,250,0.10)',
    transform: [{ rotate: '8deg' }],
  },
  armRight: {
    position: 'absolute',
    right: 10,
    top: 54,
    width: 12,
    height: 90,
    borderRadius: 999,
    backgroundColor: 'rgba(250,250,250,0.10)',
    transform: [{ rotate: '-8deg' }],
  },
  legLeft: {
    position: 'absolute',
    left: 38,
    bottom: 12,
    width: 14,
    height: 88,
    borderRadius: 999,
    backgroundColor: 'rgba(250,250,250,0.10)',
  },
  legRight: {
    position: 'absolute',
    right: 38,
    bottom: 12,
    width: 14,
    height: 88,
    borderRadius: 999,
    backgroundColor: 'rgba(250,250,250,0.10)',
  },
  zone: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  zoneSelected: {
    borderColor: Colors.accent.white,
    shadowColor: Colors.accent.green,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    transform: [{ scale: 1.03 }],
  },
  zoneChest: {
    top: 55,
    width: 38,
    height: 18,
  },
  zoneChestUpper: {
    top: 48,
    width: 30,
    height: 10,
  },
  zoneFrontCore: {
    top: 80,
    width: 30,
    height: 34,
  },
  zoneFrontShoulders: {
    top: 44,
    width: 66,
    height: 14,
  },
  zoneFrontBiceps: {
    top: 66,
    left: 0,
    width: 16,
    height: 38,
  },
  zoneFrontForearms: {
    top: 108,
    left: 0,
    width: 14,
    height: 30,
  },
  zoneFrontQuads: {
    bottom: 24,
    width: 34,
    height: 56,
  },
  zoneFrontCalves: {
    bottom: 12,
    width: 12,
    height: 28,
  },
  zoneBackUpper: {
    top: 52,
    width: 42,
    height: 24,
  },
  zoneBackLats: {
    top: 64,
    width: 58,
    height: 34,
  },
  zoneBackTraps: {
    top: 42,
    width: 58,
    height: 14,
  },
  zoneBackTriceps: {
    top: 68,
    left: 0,
    width: 16,
    height: 38,
  },
  zoneBackLower: {
    top: 94,
    width: 34,
    height: 28,
  },
  zoneBackGlutes: {
    top: 108,
    width: 30,
    height: 24,
  },
  zoneBackHamstrings: {
    bottom: 34,
    width: 32,
    height: 50,
  },
  zoneBackCalves: {
    bottom: 18,
    width: 12,
    height: 32,
  },
  weekSub: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.text.secondary,
    marginTop: 4,
    lineHeight: 14,
  },
  weekLegendText: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.text.secondary,
  },
  volumeCard: {
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.lg,
    padding: 12,
    gap: 10,
  },
  volumeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  sectionLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.text.muted,
    letterSpacing: 1.1,
    marginBottom: 10,
  },
  pulseCard: {
    backgroundColor: 'rgba(0, 255, 157, 0.045)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 157, 0.18)',
    borderRadius: BorderRadius.lg,
    padding: 12,
    gap: 10,
  },
  pulseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.xs,
    color: Colors.text.primary,
    letterSpacing: 0.8,
  },
  pulseHeadline: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
  },
  pulseBody: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.text.secondary,
    lineHeight: 14,
  },
  pulseChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pulseChip: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pulseChipText: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.text.muted,
    letterSpacing: 0.4,
  },
  limbList: {
    gap: 10,
  },
  limbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  limbDotWrap: {
    width: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limbDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  limbStat: {
    flex: 1,
  },
  limbHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  limbLabel: {
    fontFamily: FontFamily.techSemi,
    fontSize: 12,
    color: Colors.text.primary,
  },
  limbValue: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.text.secondary,
  },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  equipmentCard: {
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.lg,
    padding: 12,
    gap: 10,
  },
  equipmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  equipmentAction: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.accent.green,
    letterSpacing: 1,
  },
  equipmentList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  equipmentChip: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  equipmentChipText: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.text.primary,
  },
  emptyText: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    color: Colors.text.muted,
  },
});

export default GymOverview;
