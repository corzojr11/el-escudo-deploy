import { apiPost } from '../../api/requests';
import { ExerciseLog, PersonalRecord } from '../../types/api';

export interface WeightEntry {
  id: string;
  weight: number;
  timestamp: Date;
}

export interface WorkoutSet {
  id: string;
  kg: string;
  reps: string;
  done: boolean;
}

export interface ActiveExercise {
  id: string;
  name: string;
  sets: WorkoutSet[];
}

export interface ActiveWorkoutSession {
  dayIndex: number;
  startTime: Date;
  exercises: ActiveExercise[];
}

export interface RoutineExercise {
  id: string;
  name: string;
  suggestedSets: number;
  suggestedReps: string;
  equipment?: string[];
  muscles?: string[];
}

export interface RoutineDay {
  name: string;
  objective?: string;
  estimatedMinutes?: number;
  notes?: string[];
  exercises: RoutineExercise[];
}

export interface HealthSlice {
  focusStatus: {
    focusStreak: number;
    focusBest: number;
    urgeCount: number;
    lastCheckDate: string | null;
  };
  // -- State ----------------------------------------------------------------
  health: {
    current: number;
    max: number;
    weight: number;
    userProfileCompleted: boolean;
    height: number;
    measures: { chest: number; arms: number; waist: number; legs: number };
    equipmentInventory: string[];
    objectives: string[];
    routine: Record<number, RoutineDay | null>;
    activeWorkoutSession: ActiveWorkoutSession | null;
    restTimer: { duration: number; current: number; isRunning: boolean };
    lastWorkoutDate: string | null;
  };
  weightHistory: WeightEntry[];
  exerciseLogs: ExerciseLog[];
  personalRecords: PersonalRecord[];

  // -- Actions --------------------------------------------------------------
  logWeight: (weight: number) => Promise<void>;
  logExercise: (data: any) => Promise<void>;
  fetchHealthData: () => Promise<void>;
  setFocusStatus: (status: {
    focusStreak?: number;
    focusBest?: number;
    urgeCount?: number;
    lastCheckDate?: string | null;
  }) => void;
  completeHealthOnboarding: (data: {
    height: number;
    weight: number;
    measures: { chest: number; arms: number; waist: number; legs: number };
    objectives: string[];
  }) => void;
  setEquipmentInventory: (items: string[]) => void;

  startWorkoutSession: (dayIndex: number) => void;
  updateSetData: (exerciseId: string, setId: string, field: 'kg' | 'reps', value: string) => void;
  toggleSetDone: (exerciseId: string, setId: string) => void;
  addSetToExercise: (exerciseId: string) => void;
  finishAndLogSession: () => Promise<void>;
  tickRestTimer: () => void;
  stopRestTimer: () => void;
  updateRoutineExercise: (dayIndex: number, oldName: string, newName: string) => void;
  setRoutineDay: (dayIndex: number, dayName: string, exercises: Omit<RoutineExercise, 'id'>[], meta?: { objective?: string; estimatedMinutes?: number; notes?: string[] }) => void;
  setWeeklyRoutinePlan: (days: Array<{
    dayIndex: number;
    dayName: string;
    exercises: Omit<RoutineExercise, 'id'>[];
    meta?: { objective?: string; estimatedMinutes?: number; notes?: string[] };
  }>) => void;
  addRoutineExercise: (dayIndex: number, exercise: Omit<RoutineExercise, 'id'>) => void;
  removeRoutineExercise: (dayIndex: number, exerciseName: string) => void;
  markRoutineCompleted: (dayIndex: number) => void;
}

const genId = () => Math.random().toString(36).substring(7);

const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const pickExerciseName = (logData: any, fallback = 'Ejercicio') => {
  return String(
    logData?.exercise_name ??
    logData?.name ??
    logData?.extracted_data?.exercise_name ??
    logData?.extracted_data?.name ??
    fallback
  ).trim() || fallback;
};

const buildLocalExerciseLog = (logData: any, userId: string, responseData: any = {}) => {
  const createdAt = new Date().toISOString();
  return {
    id: String(responseData.id || logData?.id || genId()),
    user_id: userId,
    exercise_name: pickExerciseName({ ...logData, ...responseData }),
    weight: asNumber(responseData.weight ?? logData?.weight ?? logData?.extracted_data?.weight ?? 0),
    reps: Math.trunc(asNumber(responseData.reps ?? logData?.reps ?? logData?.extracted_data?.reps ?? 0)),
    sets: Math.trunc(asNumber(responseData.sets ?? logData?.sets ?? logData?.extracted_data?.sets ?? 0)),
    rpe: Math.trunc(asNumber(responseData.rpe ?? logData?.rpe ?? logData?.extracted_data?.rpe ?? 8, 8)),
    date: String(responseData.date || logData?.date || createdAt),
    created_at: String(responseData.created_at || createdAt),
  } satisfies ExerciseLog;
};

const upsertPersonalRecord = (records: PersonalRecord[], log: ExerciseLog) => {
  if (!log.exercise_name) return records;
  const existingIndex = records.findIndex((record) => record.exercise_name === log.exercise_name);
  if (existingIndex === -1) {
    if (log.weight <= 0) return records;
    return [...records, {
      id: genId(),
      user_id: log.user_id,
      exercise_name: log.exercise_name,
      max_weight: log.weight,
      date: log.date,
    }];
  }

  const existing = records[existingIndex];
  if (log.weight > existing.max_weight) {
    const next = [...records];
    next[existingIndex] = {
      ...existing,
      max_weight: log.weight,
      date: log.date,
    };
    return next;
  }

  return records;
};

const createRoutineDay = (
  name: string,
  objective: string,
  estimatedMinutes: number,
  notes: string[],
  exercises: Array<Omit<RoutineExercise, 'id'>>
): RoutineDay => ({
  name,
  objective,
  estimatedMinutes,
  notes,
  exercises: exercises.map((exercise, index) => ({
    id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index + 1}-${genId()}`,
    name: exercise.name,
    suggestedSets: exercise.suggestedSets,
    suggestedReps: exercise.suggestedReps,
    equipment: exercise.equipment || [],
    muscles: exercise.muscles || [],
  })),
});

const DEFAULT_EQUIPMENT = [
  'Mancuernas convertibles',
  'Barra conectora',
  'Peso ruso',
  'Discos ajustables',
  'Banco o superficie plana',
  'Espacio para zancadas',
];

const ROUTINE_BRAZO: RoutineDay = createRoutineDay(
  'Brazo completo A',
  'Hombro, biceps, triceps y antebrazo con progresion por volumen.',
  55,
  [
    'Mantener tecnica limpia en todos los presses y curls.',
    'Si el peso se queda corto, bajar lento y pausar al final del recorrido.',
    'En la segunda vuelta de la semana, intenta sumar 1 repeticion por serie en los dos primeros ejercicios.',
  ],
  [
    { name: 'Press militar con mancuernas o barra', suggestedSets: 4, suggestedReps: '8-12' },
    { name: 'Curl alterno con mancuernas', suggestedSets: 4, suggestedReps: '10-12' },
    { name: 'Press cerrado en el suelo con barra o mancuernas', suggestedSets: 4, suggestedReps: '8-12' },
    { name: 'Elevaciones laterales', suggestedSets: 3, suggestedReps: '15-20' },
    { name: 'Curl martillo', suggestedSets: 3, suggestedReps: '10-14' },
    { name: 'Extension de triceps por encima de la cabeza', suggestedSets: 3, suggestedReps: '10-15' },
    { name: 'Curl de muneca + curl inverso de muneca', suggestedSets: 2, suggestedReps: '15-20' },
  ]
);

const ROUTINE_TORSO: RoutineDay = createRoutineDay(
  'Pecho y espalda A',
  'Empuje y jalon para un torso equilibrado y fuerte.',
  60,
  [
    'El press de pecho y el remo inclinado son los anclajes del dia.',
    'Controla la bajada y evita rebotar en el suelo.',
    'En la segunda sesion de la semana, recorta un poco el descanso si el peso ya te queda ligero.',
  ],
  [
    { name: 'Press de pecho en el suelo con barra o mancuernas', suggestedSets: 4, suggestedReps: '8-12' },
    { name: 'Remo inclinado con barra', suggestedSets: 4, suggestedReps: '8-12' },
    { name: 'Aperturas en el suelo con mancuernas', suggestedSets: 3, suggestedReps: '12-15' },
    { name: 'Remo a una mano con mancuerna', suggestedSets: 3, suggestedReps: '10-12 por lado' },
    { name: 'Pullover con mancuerna', suggestedSets: 3, suggestedReps: '12-15' },
    { name: 'Flexiones controladas', suggestedSets: 2, suggestedReps: 'Al fallo tecnico' },
  ]
);

const ROUTINE_LEGS: RoutineDay = createRoutineDay(
  'Pierna A',
  'Cuadriceps, gluteo, femoral, pantorrilla y core con foco en control y estabilidad.',
  65,
  [
    'La sentadilla bulgara y el peso muerto rumano son los ejercicios mas valiosos del kit.',
    'Si el peso te queda corto, usa tempo lento y pausas de 1-2 segundos.',
    'Mantener el torso estable y la rodilla alineada durante todo el movimiento.',
  ],
  [
    { name: 'Sentadilla goblet con mancuerna o peso ruso', suggestedSets: 4, suggestedReps: '12-15' },
    { name: 'Peso muerto rumano con barra o mancuernas', suggestedSets: 4, suggestedReps: '10-12' },
    { name: 'Sentadilla bulgara', suggestedSets: 3, suggestedReps: '10-12 por pierna' },
    { name: 'Zancadas hacia atras o caminando', suggestedSets: 3, suggestedReps: '12 por pierna' },
    { name: 'Hip thrust con barra o mancuerna', suggestedSets: 4, suggestedReps: '12-15' },
    { name: 'Elevacion de talones para pantorrilla', suggestedSets: 4, suggestedReps: '20-25' },
    { name: 'Russian twist con peso + plancha', suggestedSets: 3, suggestedReps: '20 twists + 30-45 s plancha' },
  ]
);

const DEFAULT_ROUTINE: Record<number, RoutineDay | null> = {
  1: ROUTINE_BRAZO,
  2: ROUTINE_TORSO,
  3: ROUTINE_LEGS,
  4: ROUTINE_BRAZO,
  5: ROUTINE_TORSO,
  6: ROUTINE_LEGS,
  0: null,
};

export const createHealthSlice = (set: any, get: any): HealthSlice => ({
  focusStatus: {
    focusStreak: 0,
    focusBest: 0,
    urgeCount: 0,
    lastCheckDate: null,
  },
  // ── Initial State ────────────────────────────────────────
  health: {
    current: 50,
    max: 100,
    weight: 55,
    userProfileCompleted: false,
    height: 1.74,
    measures: { chest: 0, arms: 0, waist: 0, legs: 0 },
    equipmentInventory: DEFAULT_EQUIPMENT,
    objectives: [],
    routine: DEFAULT_ROUTINE,
    activeWorkoutSession: null,
    restTimer: { duration: 90, current: 0, isRunning: false },
    lastWorkoutDate: null,
  },
  weightHistory: [],
  exerciseLogs: [],
  personalRecords: [],

  // ── Actions ──────────────────────────────────────────────
  logWeight: async (weight) => {
    const session = get().session;
    if (!session) {
      console.warn('logWeight: sesión no autenticada, omitiendo petición');
      return;
    }
    try {
      const res = await apiPost('/api/v1/weight', { weight });
      if (res.ok) {
        const data = await res.json();
        set((state: any) => {
          const newEntry = { id: data.id, weight, timestamp: new Date(data.timestamp) };
          const newHistory = [...state.weightHistory, newEntry];
          if (newHistory.length > 1) {
            const last = newHistory[newHistory.length - 2].weight;
            const diff = weight - last;
            if (diff > 0) get().addLog({ text: 'Misión cumplida: El peso está subiendo. ¡Sigue así!', category: 'SISTEMA' });
            else if (diff < 0) get().addLog({ text: 'Misión cumplida: El peso está bajando. ¡Sigue así!', category: 'SISTEMA' });
            get().addXP(50);
          }
          return { weightHistory: newHistory, health: { ...state.health, weight } };
        });
        get().markDataDirty('health');
      }
    } catch (e) {
      console.error(e);
    }
  },

  logExercise: async (logData) => {
    const session = get().session;
    if (!session) return;
    set({ isProcessing: true });
    try {
      const res = await apiPost('/api/v1/log-exercise', logData);
      const payload = await res.json().catch(() => ({}));
      const queued = res.status === 202 || payload?.queued === true || payload?.queued_request === true;

      if (!res.ok && !queued) {
        throw new Error('No se pudo registrar el ejercicio.');
      }

      const localEntry = buildLocalExerciseLog(logData, session.user?.id || 'local', payload);
      set((state: any) => ({
        exerciseLogs: [localEntry, ...state.exerciseLogs].slice(0, 250),
        personalRecords: upsertPersonalRecord(state.personalRecords, localEntry),
      }));
      get().addLog({
        text: queued
          ? `Ejercicio guardado en cola local: ${localEntry.exercise_name}.`
          : `Ejercicio registrado: ${localEntry.exercise_name}.`,
        category: 'SISTEMA',
      });
      get().markDataDirty('health');

      if (!queued) {
        await get().hydrateStore();
      }
    } catch (e) {
      console.error('Error logging exercise:', e);
      const localEntry = buildLocalExerciseLog(logData, session.user?.id || 'local');
      set((state: any) => ({
        exerciseLogs: [localEntry, ...state.exerciseLogs].slice(0, 250),
        personalRecords: upsertPersonalRecord(state.personalRecords, localEntry),
      }));
      get().addLog({
        text: `Ejercicio guardado localmente por error de red: ${localEntry.exercise_name}.`,
        category: 'ERROR',
      });
      get().markDataDirty('health');
    } finally {
      set({ isProcessing: false });
    }
  },

  fetchHealthData: async () => {
    await get().hydrateStore();
  },

  setFocusStatus: (status) => {
    set((state: any) => ({
      focusStatus: {
        ...state.focusStatus,
        ...Object.fromEntries(Object.entries(status).filter(([, value]) => typeof value !== 'undefined')),
      },
    }));
  },

  completeHealthOnboarding: (data) => {
    set((state: any) => ({
      health: { ...state.health, height: data.height, weight: data.weight, measures: data.measures, objectives: data.objectives, userProfileCompleted: true },
    }));
    get().addLog({ text: 'Perfil físico completado. Calibrando rutinas de hipertrofia.', category: 'SISTEMA' });
    get().addXP(100);
    get().markDataDirty('health');
  },

  setEquipmentInventory: (items) => {
    const cleaned = Array.from(new Set((items || []).map((item) => String(item || '').trim()).filter(Boolean)));
    set((state: any) => ({
      health: {
        ...state.health,
        equipmentInventory: cleaned.length ? cleaned : DEFAULT_EQUIPMENT,
      },
    }));
    get().markDataDirty('health');
  },

  startWorkoutSession: (dayIndex) => {
    const routine = get().health.routine[dayIndex];
    if (!routine) return;
    const activeExercises: ActiveExercise[] = routine.exercises.map((ex: RoutineExercise) => ({
      id: ex.id,
      name: ex.name,
      sets: Array.from({ length: ex.suggestedSets }).map(() => ({ id: genId(), kg: '', reps: '', done: false })),
    }));
    set((state: any) => ({
      health: { ...state.health, activeWorkoutSession: { dayIndex, startTime: new Date(), exercises: activeExercises } },
    }));
    get().markDataDirty('health');
  },

  updateSetData: (exerciseId, setId, field, value) => {
    set((state: any) => {
      const session = state.health.activeWorkoutSession;
      if (!session) return state;
      const exercises = session.exercises.map((ex: ActiveExercise) =>
        ex.id !== exerciseId ? ex : { ...ex, sets: ex.sets.map((s) => (s.id !== setId ? s : { ...s, [field]: value })) }
      );
      return { health: { ...state.health, activeWorkoutSession: { ...session, exercises } } };
    });
  },

  toggleSetDone: (exerciseId, setId) => {
    set((state: any) => {
      const session = state.health.activeWorkoutSession;
      if (!session) return state;
      let justFinished = false;
      const exercises = session.exercises.map((ex: ActiveExercise) =>
        ex.id !== exerciseId
          ? ex
          : { ...ex, sets: ex.sets.map((s) => { if (s.id === setId && !s.done) justFinished = true; return { ...s, done: !s.done }; }) }
      );
      let restTimer = state.health.restTimer;
      if (justFinished) restTimer = { ...restTimer, current: restTimer.duration, isRunning: true };
      return { health: { ...state.health, restTimer, activeWorkoutSession: { ...session, exercises } } };
    });
  },

  addSetToExercise: (exerciseId) => {
    set((state: any) => {
      const session = state.health.activeWorkoutSession;
      if (!session) return state;
      const exercises = session.exercises.map((ex: ActiveExercise) =>
        ex.id !== exerciseId ? ex : { ...ex, sets: [...ex.sets, { id: genId(), kg: '', reps: '', done: false }] }
      );
      return { health: { ...state.health, activeWorkoutSession: { ...session, exercises } } };
    });
  },

  finishAndLogSession: async () => {
    set((state: any) => ({
      health: {
        ...state.health,
        current: Math.min(state.health.max, state.health.current + 20),
        activeWorkoutSession: null,
        lastWorkoutDate: new Date().toDateString(),
        restTimer: { ...state.health.restTimer, isRunning: false, current: 0 },
      },
    }));
    get().addLog({ text: 'Entrenamiento registrado correctamente en Hevy-Tracker local.', category: 'SISTEMA' });
    get().addXP(150);
    get().markDataDirty('health');
  },

  tickRestTimer: () => {
    set((state: any) => {
      const current = state.health.restTimer.current;
      if (current <= 0) return { health: { ...state.health, restTimer: { ...state.health.restTimer, isRunning: false, current: 0 } } };
      return { health: { ...state.health, restTimer: { ...state.health.restTimer, current: current - 1 } } };
    });
  },

  stopRestTimer: () => {
    set((state: any) => ({
      health: { ...state.health, restTimer: { ...state.health.restTimer, isRunning: false, current: 0 } },
    }));
  },

  updateRoutineExercise: (dayIndex, oldName, newName) => {
    set((state: any) => {
      const routine = { ...state.health.routine };
      const day = routine[dayIndex];
      if (!day) return state;
      const newExercises = day.exercises.map((ex: RoutineExercise) =>
        ex.name.toLowerCase().includes(oldName.toLowerCase()) ? { ...ex, name: newName } : ex
      );
      return { health: { ...state.health, routine: { ...routine, [dayIndex]: { ...day, exercises: newExercises } } } };
    });
    get().addLog({ text: `Protocolo de Salud actualizado: ${oldName} -> ${newName}.`, category: 'HABITO' });
    get().markDataDirty('health');
  },

  setRoutineDay: (dayIndex, dayName, exercises, meta) => {
    set((state: any) => ({
      health: {
        ...state.health,
        routine: {
          ...state.health.routine,
          [dayIndex]: {
            name: dayName,
            objective: meta?.objective,
            estimatedMinutes: meta?.estimatedMinutes,
            notes: meta?.notes || [],
            exercises: exercises.map((exercise) => ({
              id: genId(),
              name: exercise.name,
              suggestedSets: exercise.suggestedSets || 3,
              suggestedReps: exercise.suggestedReps || '8-12',
              equipment: exercise.equipment || [],
              muscles: exercise.muscles || [],
            })),
          },
        },
      },
    }));
    get().addLog({ text: `Rutina configurada para ${dayName}.`, category: 'SISTEMA' });
    get().addXP(40);
    get().markDataDirty('health');
  },

  setWeeklyRoutinePlan: (days) => {
    const normalizedDays = Array.isArray(days)
      ? days
          .map((day) => ({
            dayIndex: Number(day.dayIndex),
            dayName: String(day.dayName || '').trim(),
            exercises: Array.isArray(day.exercises) ? day.exercises : [],
            meta: day.meta || {},
          }))
          .filter((day) => Number.isInteger(day.dayIndex) && day.dayName)
      : [];

    if (!normalizedDays.length) return;

    set((state: any) => {
      const nextRoutine = { ...state.health.routine };

      normalizedDays.forEach((day) => {
        nextRoutine[day.dayIndex] = {
          name: day.dayName,
          objective: day.meta?.objective,
          estimatedMinutes: day.meta?.estimatedMinutes,
          notes: day.meta?.notes || [],
          exercises: day.exercises.map((exercise) => ({
            id: genId(),
            name: exercise.name,
            suggestedSets: exercise.suggestedSets || 3,
            suggestedReps: exercise.suggestedReps || '8-12',
            equipment: exercise.equipment || [],
            muscles: exercise.muscles || [],
          })),
        };
      });

      return {
        health: {
          ...state.health,
          routine: nextRoutine,
        },
      };
    });

    get().addLog({ text: `Plan semanal de gimnasio actualizado (${normalizedDays.length} dias).`, category: 'SISTEMA' });
    get().addXP(80);
    get().markDataDirty('health');
  },

  addRoutineExercise: (dayIndex, exercise) => {
    set((state: any) => {
      const routine = { ...state.health.routine };
      const day = routine[dayIndex];
      if (!day) {
        return {
          health: {
            ...state.health,
            routine: {
              ...routine,
              [dayIndex]: {
                name: `Día ${dayIndex}`,
                exercises: [{
                  id: genId(),
                  name: exercise.name,
                  suggestedSets: exercise.suggestedSets || 3,
                  suggestedReps: exercise.suggestedReps || '8-12',
                  equipment: exercise.equipment || [],
                  muscles: exercise.muscles || [],
                }],
              },
            },
          },
        };
      }
      return {
        health: {
          ...state.health,
          routine: {
            ...routine,
            [dayIndex]: {
              ...day,
              exercises: [...day.exercises, {
                id: genId(),
                name: exercise.name,
                suggestedSets: exercise.suggestedSets || 3,
                suggestedReps: exercise.suggestedReps || '8-12',
                equipment: exercise.equipment || [],
                muscles: exercise.muscles || [],
              }],
            },
          },
        },
      };
    });
    get().addLog({ text: `Ejercicio agregado a la rutina: ${exercise.name}.`, category: 'SISTEMA' });
    get().markDataDirty('health');
  },

  removeRoutineExercise: (dayIndex, exerciseName) => {
    set((state: any) => {
      const routine = { ...state.health.routine };
      const day = routine[dayIndex];
      if (!day) return state;
      const exercises = day.exercises.filter((ex: RoutineExercise) => !ex.name.toLowerCase().includes(exerciseName.toLowerCase()));
      return { health: { ...state.health, routine: { ...routine, [dayIndex]: { ...day, exercises } } } };
    });
    get().addLog({ text: `Ejercicio retirado de la rutina: ${exerciseName}.`, category: 'SISTEMA' });
    get().markDataDirty('health');
  },

  markRoutineCompleted: (dayIndex) => {
    const todayDate = new Date().toDateString();
    set((state: any) => ({
      health: {
        ...state.health,
        current: Math.min(state.health.max, state.health.current + 15),
        lastWorkoutDate: todayDate,
      },
    }));
    get().addLog({ text: `Rutina del día ${dayIndex} marcada como completada.`, category: 'SISTEMA' });
    get().addXP(80);
    get().markDataDirty('health');
  },
});



