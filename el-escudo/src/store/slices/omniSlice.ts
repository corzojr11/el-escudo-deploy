import { apiPost, apiGet, apiPut, apiDelete } from '../../api/requests';
import { ActionLog } from '../types';
import { ProcessCommandResponse, OmniMessageListResponse, OmniMessage, OmniSuggestion, AgentCheckResponse } from '../../types/api';

export interface OmniSlice {
  logs: ActionLog[];
  isProcessing: boolean;
  toast: { visible: boolean; message: string };
  pendingAction: {
    type: 'DEBT' | 'FIXED_EXPENSE' | 'PAY_FIXED_EXPENSE' | 'GASTO' | 'REGISTER_INCOME' | 'LOG_WEIGHT' | 'LOG_EXERCISE' | 'LOG_SLEEP' | 'CREATE_SHIFT' | 'UPDATE_SHIFT' | 'DELETE_SHIFT' | 'SET_WAKE_TIME' | 'CREATE_ROUTINE' | 'ADD_ROUTINE_EXERCISE' | 'REMOVE_ROUTINE_EXERCISE' | 'COMPLETE_ROUTINE' | 'UPDATE_ROUTINE' | 'ANALYZE_FINANCES' | 'CREATE_GOAL' | 'UPDATE_GOAL' | 'COMPLETE_GOAL' | 'LOG_METRIC' | 'REGISTER_FOCUS_DAY' | 'REGISTER_URGE' | 'REGISTER_RELAPSE' | 'RESET_FOCUS' | 'CREATE_TASK' | 'UPDATE_TASK' | 'COMPLETE_TASK' | 'DELETE_TASK';
    data: Record<string, unknown>;
    summary: string;
  } | {
    mode: 'multi';
    actions: Array<{ type: string; description: string; command: string }>;
  } | null;
  dailyQuote: string;
  sessionAICost: number;
  aiCostCop: number;
  lastOmniMessagesSyncAt: number;

  addLog: (log: Omit<ActionLog, 'id' | 'timestamp'>) => void;
  loadOmniMessages: (force?: boolean) => Promise<void>;
  processCommandWithAI: (commandText: string) => Promise<void>;
  confirmPendingAction: () => Promise<void>;
  cancelPendingAction: () => void;
  forceResetProcessing: () => void;
}

interface AIResponse extends ProcessCommandResponse {}

const genId = () => Math.random().toString(36).substring(7);

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

const stripAccents = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const normalizeCommand = (value: string) => stripAccents(String(value || '')).toLowerCase().trim();
const extractMoney = (text: string) => {
  const normalized = normalizeCommand(text);
  const match = normalized.match(/(?:\$|cop\s*)?(\d{1,3}(?:[.,]\d{3})*|\d+)(?:[.,](\d{1,2}))?/);
  if (!match) return null;
  const raw = match[0].replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const amount = Number(raw);
  return Number.isFinite(amount) ? amount : null;
};

const extractTimeCandidates = (text: string) => {
  const normalized = normalizeCommand(text);
  const matches = [...normalized.matchAll(/\b(\d{1,2})(?::|h)(\d{2})\b/g)];
  return matches
    .map((match) => {
      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    })
    .filter((value): value is string => Boolean(value));
};

const dayIndexFromText = (text: string) => {
  const normalized = normalizeCommand(text);
  if (normalized.includes('hoy')) return new Date().getDay();
  if (normalized.includes('manana')) return (new Date().getDay() + 1) % 7;
  if (normalized.includes('pasado manana')) return (new Date().getDay() + 2) % 7;
  const found = DAY_NAMES.findIndex((day) => normalized.includes(day));
  return found >= 0 ? found : null;
};

const dayNameFromIndex = (index: number) => {
  const names = ['Domingo', 'Lunes', 'Martes', 'MiÃ©rcoles', 'Jueves', 'Viernes', 'SÃ¡bado'];
  return names[((index % 7) + 7) % 7];
};

const formatMoney = (amount: number) => `$${Math.round(amount).toLocaleString('es-CO')}`;

const getNavirTimeMode = (state: any) => {
  const now = new Date();
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const todayName = dayNames[now.getDay()];
  const parseTime = (time: string) => {
    const [hours, minutes] = String(time || '').split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return hours * 60 + minutes;
  };
  const shifts = Array.isArray(state?.workShifts) ? state.workShifts : [];
  const todayShift = shifts.find((shift: any) => normalizeCommand(shift.day) === normalizeCommand(todayName));

  if (todayShift?.start && todayShift?.end) {
    const start = parseTime(todayShift.start);
    const end = parseTime(todayShift.end);
    if (start !== null && end !== null) {
      const inShift = minutesNow >= Math.max(0, start - 45) && minutesNow <= Math.min(24 * 60 - 1, end + 120);
      if (inShift) return 'journey';
    }
  }

  if (minutesNow >= 20 * 60 || minutesNow < 6 * 60) {
    return 'night';
  }

  const sleepTarget = parseTime(state?.targetSleepTime);
  if (sleepTarget !== null && minutesNow >= Math.max(0, sleepTarget - 120)) {
    return 'night';
  }

  return 'journey';
};

const buildRoutineTemplate = (kind: 'brazo' | 'torso' | 'pierna', equipment: string[]) => {
  const hasBar = equipment.some((item) => normalizeCommand(item).includes('barra'));
  const hasDumbbells = equipment.some((item) => normalizeCommand(item).includes('mancuerna'));
  const barOrDumbbells = hasBar ? 'barra o mancuernas' : hasDumbbells ? 'mancuernas' : 'mancuernas o peso disponible';

  if (kind === 'brazo') {
    return {
      dayName: 'Brazo completo',
      objective: 'Hombro, biceps, triceps y antebrazo con progresion por volumen.',
      estimatedMinutes: 55,
      notes: [
        'Mantener tecnica limpia en todos los presses y curls.',
        'Si el peso se queda corto, bajar lento y pausar al final del recorrido.',
      ],
      exercises: [
        { name: `Press militar con ${barOrDumbbells}`, suggestedSets: 4, suggestedReps: '8-12', equipment: equipment.slice(0, 3), muscles: ['hombro', 'triceps'] },
        { name: 'Curl alterno con mancuernas', suggestedSets: 4, suggestedReps: '10-12', equipment: equipment.slice(0, 2), muscles: ['biceps'] },
        { name: `Press cerrado en el suelo con ${barOrDumbbells}`, suggestedSets: 4, suggestedReps: '8-12', equipment: equipment.slice(0, 3), muscles: ['triceps', 'pecho'] },
        { name: 'Elevaciones laterales', suggestedSets: 3, suggestedReps: '15-20', equipment: equipment.slice(0, 2), muscles: ['hombro'] },
        { name: 'Curl martillo', suggestedSets: 3, suggestedReps: '10-14', equipment: equipment.slice(0, 2), muscles: ['biceps', 'antebrazo'] },
        { name: 'Extension de triceps por encima de la cabeza', suggestedSets: 3, suggestedReps: '10-15', equipment: equipment.slice(0, 2), muscles: ['triceps'] },
      ],
    };
  }

  if (kind === 'torso') {
    return {
      dayName: 'Pecho y espalda',
      objective: 'Empuje y jalon para un torso equilibrado y fuerte.',
      estimatedMinutes: 60,
      notes: [
        'El press y el remo son los anclajes del dia.',
        'Controla la bajada y evita rebotes.',
      ],
      exercises: [
        { name: `Press de pecho en el suelo con ${barOrDumbbells}`, suggestedSets: 4, suggestedReps: '8-12', equipment: equipment.slice(0, 3), muscles: ['pecho', 'triceps'] },
        { name: `Remo inclinado con ${barOrDumbbells}`, suggestedSets: 4, suggestedReps: '8-12', equipment: equipment.slice(0, 3), muscles: ['espalda', 'biceps'] },
        { name: 'Aperturas en el suelo con mancuernas', suggestedSets: 3, suggestedReps: '12-15', equipment: equipment.slice(0, 2), muscles: ['pecho'] },
        { name: 'Remo a una mano con mancuerna', suggestedSets: 3, suggestedReps: '10-12 por lado', equipment: equipment.slice(0, 2), muscles: ['espalda'] },
        { name: 'Pullover con mancuerna', suggestedSets: 3, suggestedReps: '12-15', equipment: equipment.slice(0, 2), muscles: ['pecho', 'espalda'] },
        { name: 'Flexiones controladas', suggestedSets: 2, suggestedReps: 'Al fallo tecnico', equipment: [], muscles: ['pecho', 'core'] },
      ],
    };
  }

  return {
    dayName: 'Pierna',
    objective: 'Cuadriceps, gluteo, femoral, pantorrilla y core con foco en control y estabilidad.',
    estimatedMinutes: 65,
    notes: [
      'La sentadilla bulgara y el peso muerto rumano son los ejercicios mas valiosos del kit.',
      'Si el peso te queda corto, usa tempo lento y pausas de 1-2 segundos.',
    ],
    exercises: [
      { name: `Sentadilla goblet con ${barOrDumbbells}`, suggestedSets: 4, suggestedReps: '12-15', equipment: equipment.slice(0, 3), muscles: ['pierna', 'gluteo'] },
      { name: `Peso muerto rumano con ${barOrDumbbells}`, suggestedSets: 4, suggestedReps: '10-12', equipment: equipment.slice(0, 3), muscles: ['femoral', 'gluteo'] },
      { name: 'Sentadilla bulgara', suggestedSets: 3, suggestedReps: '10-12 por pierna', equipment: equipment.slice(0, 2), muscles: ['pierna', 'gluteo'] },
      { name: 'Zancadas hacia atras o caminando', suggestedSets: 3, suggestedReps: '12 por pierna', equipment: equipment.slice(0, 2), muscles: ['pierna', 'gluteo'] },
      { name: `Hip thrust con ${barOrDumbbells}`, suggestedSets: 4, suggestedReps: '12-15', equipment: equipment.slice(0, 3), muscles: ['gluteo'] },
      { name: 'Elevacion de talones para pantorrilla', suggestedSets: 4, suggestedReps: '20-25', equipment: [], muscles: ['pantorrilla'] },
    ],
  };
};

const buildWeeklyRoutinePlan = (equipment: string[]) => {
  const split: Array<{ dayIndex: number; kind: 'brazo' | 'torso' | 'pierna'; tag: 'A' | 'B' }> = [
    { dayIndex: 1, kind: 'brazo', tag: 'A' },
    { dayIndex: 2, kind: 'torso', tag: 'A' },
    { dayIndex: 3, kind: 'pierna', tag: 'A' },
    { dayIndex: 4, kind: 'brazo', tag: 'B' },
    { dayIndex: 5, kind: 'torso', tag: 'B' },
    { dayIndex: 6, kind: 'pierna', tag: 'B' },
  ];

  return split.map(({ dayIndex, kind, tag }) => {
    const template = buildRoutineTemplate(kind, equipment);
    const dayLabel = dayNameFromIndex(dayIndex);
    const notes = [...template.notes];

    if (tag === 'B') {
      notes.push('Segunda pasada de la semana: busca un poco mas de control o una repeticion extra por serie.');
    }

    return {
      dayIndex,
      dayName: `${dayLabel} - ${template.dayName} ${tag}`,
      exercises: template.exercises,
      meta: {
        objective: template.objective,
        estimatedMinutes: template.estimatedMinutes,
        notes,
      },
    };
  });
};
const buildExerciseSuggestion = (targetText: string, equipment: string[]) => {
  const text = normalizeCommand(targetText);
  const hasBar = equipment.some((item) => normalizeCommand(item).includes('barra'));
  const hasDumbbells = equipment.some((item) => normalizeCommand(item).includes('mancuerna'));
  const hasKettlebell = equipment.some((item) => normalizeCommand(item).includes('peso ruso'));
  const barOrDumbbells = hasBar ? 'barra o mancuernas' : hasDumbbells ? 'mancuernas' : 'mancuernas o peso disponible';

  if (/(espalda|remo|jalon|jalón|pull)/.test(text)) {
    return {
      name: `Remo a una mano con ${hasDumbbells ? 'mancuerna' : barOrDumbbells}`,
      suggestedSets: 3,
      suggestedReps: '10-12 por lado',
      equipment: equipment.slice(0, 3),
      muscles: ['espalda', 'biceps'],
    };
  }

  if (/(pecho|press|flexion|flexión|apertura|fly)/.test(text)) {
    return {
      name: `Press de pecho en el suelo con ${barOrDumbbells}`,
      suggestedSets: 4,
      suggestedReps: '8-12',
      equipment: equipment.slice(0, 3),
      muscles: ['pecho', 'triceps'],
    };
  }

  if (/(hombro|hombros|militar|deltoides|laterales)/.test(text)) {
    return {
      name: `Press militar con ${barOrDumbbells}`,
      suggestedSets: 4,
      suggestedReps: '8-12',
      equipment: equipment.slice(0, 3),
      muscles: ['hombro', 'triceps'],
    };
  }

  if (/(biceps|bíceps|curl|martillo|brazo)/.test(text)) {
    return {
      name: 'Curl martillo',
      suggestedSets: 3,
      suggestedReps: '10-14',
      equipment: equipment.slice(0, 2),
      muscles: ['biceps', 'antebrazo'],
    };
  }

  if (/(triceps|tríceps|extension|extensión|fondos|press cerrado)/.test(text)) {
    return {
      name: 'Extension de triceps por encima de la cabeza',
      suggestedSets: 3,
      suggestedReps: '10-15',
      equipment: equipment.slice(0, 2),
      muscles: ['triceps'],
    };
  }

  if (/(pierna|gluteo|glúteo|cuadriceps|cuádriceps|sentadilla|zancada|lunge|hip thrust)/.test(text)) {
    return {
      name: `Sentadilla goblet con ${hasKettlebell ? 'peso ruso' : barOrDumbbells}`,
      suggestedSets: 4,
      suggestedReps: '12-15',
      equipment: equipment.slice(0, 3),
      muscles: ['pierna', 'gluteo'],
    };
  }

  return {
    name: 'Flexiones controladas',
    suggestedSets: 3,
    suggestedReps: '10-15',
    equipment: equipment.slice(0, 2),
    muscles: ['pecho', 'core'],
  };
};

const buildAccessoryExercise = (targetText: string, equipment: string[]) => {
  const text = normalizeCommand(targetText);
  const hasBar = equipment.some((item) => normalizeCommand(item).includes('barra'));
  const hasDumbbells = equipment.some((item) => normalizeCommand(item).includes('mancuerna'));
  const hasKettlebell = equipment.some((item) => normalizeCommand(item).includes('peso ruso'));
  const barOrDumbbells = hasBar ? 'barra o mancuernas' : hasDumbbells ? 'mancuernas' : 'mancuernas o peso disponible';

  if (/(abdomen|abdominal|abs|core|estabilidad)/.test(text)) {
    return {
      name: 'Plancha frontal con toque de hombros',
      suggestedSets: 3,
      suggestedReps: '20 toques o 30-45 s',
      equipment: [],
      muscles: ['core', 'hombros'],
    };
  }

  if (/(espalda|remo|jalon|jalón|pull|trapecio)/.test(text)) {
    return {
      name: `Remo a una mano con ${hasDumbbells ? 'mancuerna' : barOrDumbbells}`,
      suggestedSets: 3,
      suggestedReps: '10-12 por lado',
      equipment: equipment.slice(0, 3),
      muscles: ['espalda', 'biceps'],
    };
  }

  if (/(pecho|press|flexion|flexión|apertura|fly)/.test(text)) {
    return {
      name: `Press de pecho en el suelo con ${barOrDumbbells}`,
      suggestedSets: 3,
      suggestedReps: '8-12',
      equipment: equipment.slice(0, 3),
      muscles: ['pecho', 'triceps'],
    };
  }

  if (/(pierna|gluteo|glúteo|cuadriceps|cuádriceps|sentadilla|zancada|lunge|hip thrust|femoral)/.test(text)) {
    return {
      name: `Sentadilla goblet con ${hasKettlebell ? 'peso ruso' : barOrDumbbells}`,
      suggestedSets: 3,
      suggestedReps: '12-15',
      equipment: equipment.slice(0, 3),
      muscles: ['pierna', 'gluteo'],
    };
  }

  if (/(hombro|hombros|militar|deltoides|laterales)/.test(text)) {
    return {
      name: `Elevaciones laterales con ${hasDumbbells ? 'mancuernas' : barOrDumbbells}`,
      suggestedSets: 3,
      suggestedReps: '12-20',
      equipment: equipment.slice(0, 2),
      muscles: ['hombro'],
    };
  }

  return {
    name: 'Flexiones controladas',
    suggestedSets: 2,
    suggestedReps: '10-15',
    equipment: equipment.slice(0, 2),
    muscles: ['pecho', 'core'],
  };
};

const applyIntensityToRoutine = (routineDay: any, mode: 'shorter' | 'harder') => {
  if (!routineDay) return null;
  const baseExercises = Array.isArray(routineDay.exercises) ? routineDay.exercises : [];
  const nextExercises = mode === 'shorter'
    ? baseExercises.slice(0, Math.max(2, baseExercises.length - 1))
    : baseExercises.map((exercise: any) => ({
        ...exercise,
        suggestedSets: Math.min(Number(exercise.suggestedSets || 3) + 1, 6),
      }));

  const estimatedMinutes = Number(routineDay.estimatedMinutes || nextExercises.length * 10);
  return {
    name: routineDay.name,
    objective: routineDay.objective,
    estimatedMinutes: mode === 'shorter' ? Math.max(20, estimatedMinutes - 10) : estimatedMinutes + 10,
    notes: [
      ...(routineDay.notes || []),
      mode === 'shorter'
        ? 'Sesion acortada por instruccion del usuario.'
        : 'Sesion intensificada por instruccion del usuario.',
    ],
    exercises: nextExercises,
  };
};
const buildCommandFromPendingAction = (pendingAction: any) => {
  if (!pendingAction) return '';
  if ('mode' in pendingAction && pendingAction.mode === 'multi') {
    return '';
  }

  const type = String((pendingAction as any).type || '');
  const data = (pendingAction as any).data || {};

  switch (type) {
    case 'DEBT':
      return `registrar deuda de ${(data.amount ?? '')} con ${data.entity || data.name || 'prestamo'}`;
    case 'FIXED_EXPENSE':
      return `registrar factura fija ${data.name || data.description || 'gasto fijo'} por ${(data.amount ?? '')} con vencimiento ${data.dueDate || data.due_date || ''}`;
    case 'PAY_FIXED_EXPENSE':
      return `ya pague la factura ${data.name || data.description || 'seleccionada'}`;
    case 'REGISTER_INCOME':
      return `registrar ingreso de ${(data.amount ?? '')} ${data.description ? `por ${data.description}` : ''}`;
    case 'GASTO':
      return `registrar gasto de ${(data.amount ?? '')} ${data.description ? `en ${data.description}` : ''}`;
    case 'LOG_WEIGHT':
      return `registrar peso de ${(data.weight ?? '')} kg`;
    case 'LOG_EXERCISE':
      return `registrar ejercicio ${data.exercise_name || data.name || 'sin nombre'}`;
    case 'LOG_SLEEP':
      return `registrar sueno de ${data.bed_time || data.sleep_time || ''} a ${data.wake_time || ''}`;
    case 'CREATE_SHIFT':
      return `crear turno ${data.day || ''} de ${data.start || ''} a ${data.end || ''}`;
    case 'UPDATE_SHIFT':
      return `actualizar turno ${data.day || data.shift_id || 'seleccionado'}`;
    case 'DELETE_SHIFT':
      return `eliminar turno ${data.day || data.shift_id || 'seleccionado'}`;
    case 'SET_WAKE_TIME':
      return `cambiar hora de despertar a ${data.t_wake_target || data.wake_time || data.time || ''}`;
    case 'CREATE_ROUTINE':
      return `crear rutina para ${data.day || data.day_name || 'el dia indicado'}`;
    case 'UPDATE_ROUTINE':
      return `cambiar rutina ${data.old_exercise || ''} por ${data.new_exercise || ''}`;
    case 'ADD_ROUTINE_EXERCISE':
      return `agregar ejercicio ${data.exercise_name || data.name || ''} a la rutina`;
    case 'REMOVE_ROUTINE_EXERCISE':
      return `quitar ejercicio ${data.exercise_name || data.name || ''} de la rutina`;
    case 'COMPLETE_ROUTINE':
      return `marcar rutina como completada`;
    case 'ANALYZE_FINANCES':
      return `ejecutar analisis financiero profundo`;
    case 'CREATE_GOAL':
      return `crear meta ${data.name || data.title || 'nueva'}`;
    case 'UPDATE_GOAL':
      return `actualizar meta ${data.goal_name || data.name || data.goal_id || 'seleccionada'}`;
    case 'COMPLETE_GOAL':
      return `marcar meta como completada`;
    case 'LOG_METRIC':
      return `registrar avance ${data.value || 0} ${data.unit || ''}`;
    case 'REGISTER_FOCUS_DAY':
      return `registrar dia limpio`;
    case 'REGISTER_URGE':
      return `registrar impulso`;
    case 'REGISTER_RELAPSE':
      return `registrar recaida`;
    case 'RESET_FOCUS':
      return `reiniciar racha de enfoque`;
    case 'CREATE_TASK':
      return `crear tarea ${data.name || data.title || 'nueva'}`;
    case 'UPDATE_TASK':
      return `actualizar tarea ${data.task_id || data.mission_id || data.name || data.title || 'seleccionada'}`;
    case 'COMPLETE_TASK':
      return `completar tarea ${data.task_id || data.mission_id || data.name || data.title || 'seleccionada'}`;
    case 'DELETE_TASK':
      return `eliminar tarea ${data.task_id || data.mission_id || data.name || data.title || 'seleccionada'}`;
    default:
      return String((pendingAction as any).summary || type || '').trim();
  }
};

const executePendingActionLocally = async (pendingAction: any, get: any): Promise<boolean> => {
  if (!pendingAction || ('mode' in pendingAction && pendingAction.mode === 'multi')) return false;

  const state = get();
  const type = String((pendingAction as any).type || '');
  const data = (pendingAction as any).data || {};
  const asText = (...keys: string[]) => String(keys.map((key) => data?.[key]).find((value) => value !== undefined && value !== null) || '').trim();
  const amount = Number(data.amount ?? data.value ?? data.weight ?? 0);
  const dayIndex = dayIndexFromText(`${data.day || data.day_name || data.dayName || ''}`);
  const goalRef = asText('goal_id', 'goal_name', 'name', 'title');
  const taskRef = asText('task_id', 'mission_id', 'name', 'title');
  const exerciseRef = asText('exercise_name', 'name');

  switch (type) {
    case 'DEBT':
      if (!Number.isFinite(amount) || amount <= 0) return false;
      await state.addDebt({
        lender: asText('entity', 'name') || 'Prestamo',
        total: amount,
        monthly: Number(data.monthly ?? data.monthly_payment ?? Math.max(1, Math.round(amount / 12))) || 1,
        remaining: Number(data.remaining ?? data.installments ?? 1) || 1,
        dueDate: Number(data.dueDate ?? data.due_date ?? 1) || 1,
      });
      return true;
    case 'FIXED_EXPENSE':
      if (!Number.isFinite(amount) || amount <= 0) return false;
      await state.addFixedExpense({
        name: asText('name', 'description') || 'Factura',
        amount,
        category: (String(data.category || 'service').toLowerCase() as any),
        dueDate: Number(data.dueDate ?? data.due_date ?? 1) || 1,
        status: 'pending',
        paidAt: null,
      });
      return true;
    case 'PAY_FIXED_EXPENSE':
      await state.markFixedExpensePaid(asText('name', 'description', 'expenseIdOrName') || String(data.expenseIdOrName || ''));
      return true;
    case 'REGISTER_INCOME':
      if (!Number.isFinite(amount) || amount <= 0) return false;
      await state.addIncome(amount, asText('description', 'name') || 'Ingreso', asText('category') || 'Ingreso');
      return true;
    case 'GASTO':
      if (!Number.isFinite(amount) || amount <= 0) return false;
      await state.addExpense(amount, asText('description', 'name') || 'Gasto', asText('category') || 'General');
      return true;
    case 'LOG_WEIGHT':
      if (!Number.isFinite(amount) || amount <= 0) return false;
      await state.logWeight(amount);
      return true;
    case 'LOG_EXERCISE':
      await state.logExercise({
        exercise_name: asText('exercise_name', 'name') || 'Ejercicio',
        weight: Number(data.weight ?? 0) || 0,
        reps: Number(data.reps ?? 0) || 0,
        sets: Number(data.sets ?? 0) || 0,
        rpe: Number(data.rpe ?? 8) || 8,
        date: data.date,
      });
      return true;
    case 'CREATE_SHIFT':
      if (!data.day || !data.start || !data.end) return false;
      state.setWorkShifts([
        ...(state.workShifts || []).filter((shift: any) => String(shift.day || '').toLowerCase() !== String(data.day).toLowerCase()),
        { day: String(data.day), start: String(data.start), end: String(data.end) },
      ]);
      return true;
    case 'UPDATE_SHIFT': {
      const shiftRef = asText('shift_id', 'day');
      const nextDay = String(data.day || shiftRef || '').trim();
      const nextStart = String(data.start || '').trim();
      const nextEnd = String(data.end || '').trim();
      const current = Array.isArray(state.workShifts) ? state.workShifts : [];
      const index = current.findIndex((shift: any) => String(shift.id || shift.day || '').toLowerCase() === String(shiftRef || nextDay).toLowerCase());
      if (index === -1 && !nextDay) return false;
      const next = [...current];
      if (index >= 0) {
        next[index] = {
          ...next[index],
          day: nextDay || next[index].day,
          start: nextStart || next[index].start,
          end: nextEnd || next[index].end,
        };
      } else {
        next.push({ day: nextDay, start: nextStart, end: nextEnd });
      }
      state.setWorkShifts(next.map((shift: any) => ({ day: shift.day, start: shift.start, end: shift.end })));
      return true;
    }
    case 'DELETE_SHIFT': {
      const shiftRef = asText('shift_id', 'day');
      if (!shiftRef) return false;
      const current = Array.isArray(state.workShifts) ? state.workShifts : [];
      state.setWorkShifts(current.filter((shift: any) => String(shift.id || shift.day || '').toLowerCase() !== shiftRef.toLowerCase()).map((shift: any) => ({ day: shift.day, start: shift.start, end: shift.end })));
      return true;
    }
    case 'SET_WAKE_TIME':
      if (!data.t_wake_target && !data.wake_time && !data.time) return false;
      state.setTargetWakeTime(String(data.t_wake_target || data.wake_time || data.time));
      return true;
    case 'LOG_SLEEP':
      if (data.sleep_time || data.bed_time) state.setTargetSleepTime(String(data.sleep_time || data.bed_time));
      if (data.wake_time || data.t_wake_target) state.setTargetWakeTime(String(data.wake_time || data.t_wake_target));
      return true;
    case 'CREATE_ROUTINE': {
      const routineDayIndex = dayIndex ?? Number(data.day_index ?? data.dayIndex ?? new Date().getDay());
      const exercises = Array.isArray(data.exercises) ? data.exercises : Array.isArray(data.items) ? data.items : [];
      if (!exercises.length) return false;
      state.setRoutineDay(
        routineDayIndex,
        String(data.day_name || data.dayName || data.day || `Dia ${routineDayIndex}`),
        exercises.map((exercise: any) => ({
          name: String(exercise.name || 'Ejercicio'),
          suggestedSets: Number(exercise.suggestedSets || exercise.sets || 3) || 3,
          suggestedReps: String(exercise.suggestedReps || exercise.reps || '8-12'),
          equipment: Array.isArray(exercise.equipment) ? exercise.equipment : [],
          muscles: Array.isArray(exercise.muscles) ? exercise.muscles : [],
        })),
        {
          objective: String(data.objective || '').trim() || undefined,
          estimatedMinutes: Number(data.estimatedMinutes ?? data.estimated_minutes ?? 0) || undefined,
          notes: Array.isArray(data.notes) ? data.notes.map((note: any) => String(note || '').trim()).filter(Boolean) : [],
        }
      );
      return true;
    }
    case 'ADD_ROUTINE_EXERCISE': {
      const routineDayIndex = resolveRoutineDayIndex(String(data.day || data.day_name || data.dayName || ''), state, exerciseRef);
      if (routineDayIndex === null) return false;
      state.addRoutineExercise(routineDayIndex, {
        name: exerciseRef || 'Ejercicio',
        suggestedSets: Number(data.suggestedSets || data.sets || 3) || 3,
        suggestedReps: String(data.suggestedReps || data.reps || '8-12'),
        equipment: Array.isArray(data.equipment) ? data.equipment : [],
        muscles: Array.isArray(data.muscles) ? data.muscles : [],
      });
      return true;
    }
    case 'REMOVE_ROUTINE_EXERCISE': {
      const routineDayIndex = resolveRoutineDayIndex(String(data.day || data.day_name || data.dayName || ''), state, exerciseRef);
      if (routineDayIndex === null) return false;
      state.removeRoutineExercise(routineDayIndex, exerciseRef);
      return true;
    }
    case 'COMPLETE_ROUTINE': {
      const routineDayIndex = resolveRoutineDayIndex(String(data.day || data.day_name || data.dayName || ''), state, exerciseRef);
      if (routineDayIndex === null) return false;
      state.markRoutineCompleted(routineDayIndex);
      return true;
    }
    case 'UPDATE_ROUTINE': {
      const routineDayIndex = resolveRoutineDayIndex(String(data.day || data.day_name || data.dayName || ''), state, asText('old_exercise', 'exercise_name', 'name'));
      const oldName = asText('old_exercise', 'exercise_name', 'name');
      const newName = asText('new_exercise', 'new_name', 'replacement');
      if (routineDayIndex === null || !oldName || !newName) return false;
      state.updateRoutineExercise(routineDayIndex, oldName, newName);
      return true;
    }
    case 'ANALYZE_FINANCES':
      state.addLog({ text: state.analyzeFinancialStrategy(), category: 'SISTEMA' });
      return true;
    case 'CREATE_GOAL':
      state.addGoal({
        name: asText('name', 'title') || 'Nueva meta',
        target_value: Number(data.target_value ?? data.target ?? data.value ?? 1) || 1,
        unit: String(data.unit || ''),
        description: String(data.description || ''),
        status: 'active',
      } as any);
      return true;
    case 'UPDATE_GOAL': {
      const goal = (Array.isArray(state.goals) ? state.goals : []).find((item: any) =>
        String(item.id || '').toLowerCase() === goalRef.toLowerCase() || String(item.name || '').toLowerCase() === goalRef.toLowerCase()
      );
      if (!goal) return false;
      state.updateGoal(goal.id, {
        name: asText('name', 'title') || goal.name,
        description: data.description !== undefined ? String(data.description || '') : goal.description,
        unit: data.unit !== undefined ? String(data.unit || '') : goal.unit,
        target_value: Number(data.target_value ?? data.target ?? goal.target_value) || goal.target_value,
        current_value: Number(data.current_value ?? goal.current_value) || goal.current_value,
        status: String(data.status || goal.status) as any,
      } as any);
      return true;
    }
    case 'COMPLETE_GOAL': {
      const goal = (Array.isArray(state.goals) ? state.goals : []).find((item: any) =>
        String(item.id || '').toLowerCase() === goalRef.toLowerCase() || String(item.name || '').toLowerCase() === goalRef.toLowerCase()
      );
      if (!goal) return false;
      state.completeGoal(goal.id);
      return true;
    }
    case 'LOG_METRIC':
      if (Number.isFinite(amount) && amount > 0) {
        const goal = (Array.isArray(state.goals) ? state.goals : []).find((item: any) =>
          String(item.id || '').toLowerCase() === goalRef.toLowerCase() || String(item.name || '').toLowerCase() === goalRef.toLowerCase()
        );
        if (goal) {
          state.updateGoalProgress(goal.id, amount);
          return true;
        }
      }
      return false;
    case 'REGISTER_FOCUS_DAY':
      state.setFocusStatus({
        focusStreak: Number(state.focusStatus?.focusStreak || 0) + 1,
        lastCheckDate: new Date().toISOString().slice(0, 10),
      });
      return true;
    case 'REGISTER_URGE':
      state.setFocusStatus({
        urgeCount: Number(state.focusStatus?.urgeCount || 0) + 1,
        lastCheckDate: new Date().toISOString().slice(0, 10),
      });
      return true;
    case 'REGISTER_RELAPSE':
      state.setFocusStatus({
        focusStreak: 0,
        urgeCount: Number(state.focusStatus?.urgeCount || 0) + 1,
        lastCheckDate: new Date().toISOString().slice(0, 10),
      });
      return true;
    case 'RESET_FOCUS':
      state.setFocusStatus({
        focusStreak: 0,
        urgeCount: 0,
        lastCheckDate: new Date().toISOString().slice(0, 10),
      });
      return true;
    case 'CREATE_TASK':
      await state.createTask({
        name: asText('name', 'title') || 'Nueva tarea',
        description: String(data.description || ''),
        category: String(data.category || 'general'),
        xp_reward: Number(data.xp_reward ?? data.xpReward ?? 50) || 50,
        priority: (String(data.priority || 'medium') as any),
        scheduledAt: String(data.scheduledAt || data.scheduled_at || ''),
      });
      return true;
    case 'UPDATE_TASK': {
      const task = (Array.isArray(state.projects?.tasks) ? state.projects.tasks : []).find((item: any) =>
        String(item.id || '').toLowerCase() === taskRef.toLowerCase() || String(item.title || '').toLowerCase() === taskRef.toLowerCase()
      );
      if (!task) return false;
      await state.updateTask(task.id, {
        name: asText('name', 'title') || task.title,
        description: data.description !== undefined ? String(data.description || '') : task.description,
        category: data.category !== undefined ? String(data.category || '') : task.category,
        xp_reward: Number(data.xp_reward ?? data.xpReward ?? task.xpReward) || task.xpReward,
        priority: String(data.priority || task.priority) as any,
        scheduledAt: String(data.scheduledAt || data.scheduled_at || task.scheduledAt || ''),
      });
      return true;
    }
    case 'COMPLETE_TASK': {
      const task = (Array.isArray(state.projects?.tasks) ? state.projects.tasks : []).find((item: any) =>
        String(item.id || '').toLowerCase() === taskRef.toLowerCase() || String(item.title || '').toLowerCase() === taskRef.toLowerCase()
      );
      if (!task) return false;
      await state.completeTask(task.id);
      return true;
    }
    case 'DELETE_TASK': {
      const task = (Array.isArray(state.projects?.tasks) ? state.projects.tasks : []).find((item: any) =>
        String(item.id || '').toLowerCase() === taskRef.toLowerCase() || String(item.title || '').toLowerCase() === taskRef.toLowerCase()
      );
      if (!task) return false;
      await state.deleteTask(task.id);
      return true;
    }
    default:
      return false;
  }
};
const extractRoutineSwap = (commandText: string) => {
  const source = stripAccents(commandText).trim();
  const patterns = [
    /(?:cambia|cambiar|reemplaza|sustituye)\s+(.+?)\s+(?:por|con)\s+(.+)$/i,
    /(?:quita|elimina|borra)\s+(.+?)\s+y\s+(?:pon|agrega|añade|anade|sustituye|reemplaza)\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1] && match?.[2]) {
      return {
        oldName: match[1].trim().replace(/[?.!]+$/, ''),
        newName: match[2].trim().replace(/[?.!]+$/, ''),
      };
    }
  }

  return null;
};

const findRoutineDayIndexByExercise = (state: any, exerciseName: string) => {
  const target = normalizeCommand(exerciseName);
  if (!target) return null;

  const entries = Object.entries(state?.health?.routine || {});
  for (const [dayIndex, day] of entries) {
    if (!day || !Array.isArray((day as any).exercises)) continue;
    if ((day as any).exercises.some((exercise: any) => {
      const name = normalizeCommand(exercise?.name || '');
      return name.includes(target) || target.includes(name);
    })) {
      return Number(dayIndex);
    }
  }

  return null;
};

const resolveRoutineDayIndex = (commandText: string, state: any, referenceName?: string | null) => {
  const explicit = dayIndexFromText(commandText);
  if (explicit !== null) return explicit;

  const matchedByExercise = referenceName ? findRoutineDayIndexByExercise(state, referenceName) : null;
  if (matchedByExercise !== null) return matchedByExercise;

  const text = normalizeCommand(commandText);
  const routineEntries = Object.entries(state?.health?.routine || {})
    .map(([dayIndex, day]) => ({ dayIndex: Number(dayIndex), day }))
    .filter(({ day }) => Boolean(day))
    .sort((a, b) => a.dayIndex - b.dayIndex);

  const findDayByKeyword = (keyword: RegExp, dayNameHint: string) => {
    const entry = routineEntries.find(({ day }) => normalizeCommand((day as any).name || '').includes(dayNameHint));
    return entry ? entry.dayIndex : null;
  };

  if (/(brazo|biceps|bíceps|triceps|tríceps|hombro|hombros)/.test(text)) {
    return findDayByKeyword(/.*/, 'brazo') ?? routineEntries.find(({ day }) => normalizeCommand((day as any).name || '').includes('brazo'))?.dayIndex ?? null;
  }
  if (/(pecho|espalda|torso)/.test(text)) {
    return findDayByKeyword(/.*/, 'pecho y espalda') ?? routineEntries.find(({ day }) => normalizeCommand((day as any).name || '').includes('pecho y espalda'))?.dayIndex ?? null;
  }
  if (/(pierna|gluteo|glúteo|cuadriceps|cuádriceps|femoral|femorales)/.test(text)) {
    return findDayByKeyword(/.*/, 'pierna') ?? routineEntries.find(({ day }) => normalizeCommand((day as any).name || '').includes('pierna'))?.dayIndex ?? null;
  }

  return new Date().getDay();
};
const buildLocalFollowUp = (commandText: string, get: any) => {
  const text = normalizeCommand(commandText);
  const state = get();
  const amount = extractMoney(commandText);
  const times = extractTimeCandidates(commandText);
  const currentSaldo = Number(state.finances?.saldo || 0);
  const commute = Math.max(0, Math.round(state.commuteMinutes || 35));
  const navirMode = getNavirTimeMode(state);
  const isFinance = /(ingreso|sueldo|nomina|gasto|gaste|gast[eé]|me gaste|compre|compr[eé]|pague|pagu[eé]|transferi|transfer[ií]re|factura|recibo|cuenta)/.test(text);
  const isHealth = /(peso|pesas|kg|kilos|rutina|entreno|gym|ejercicio)/.test(text);
  const isSleep = /(dorm|sueno|sueño|descans|despert|wake|alarm)/.test(text);
  const isTask = /(tarea|mis[ií]on)/.test(text);
  const isFocus = /(racha|enfoque|no fap|nofap|impulso|antojo|recaid|relapse)/.test(text);
  const isBusy = Boolean(state.isProcessing) || /(rapido|breve|solo|resumen|sin\s+detalle)/.test(text);
  const isTiredOrMessy = Number(state.brainFog || 0) <= 4 || /(cansad|agotad|desorden|caos|bloquead|lento)/.test(text);
  const tone = isSleep || isHealth || isFocus ? 'warm' : isTiredOrMessy ? 'firm' : isFinance || isTask || isBusy ? 'short' : 'short';
  const respond = (shortMsg: string, firmMsg?: string, warmMsg?: string, nightMsg?: string) => {
    if (navirMode === 'night' && nightMsg) return nightMsg;
    if (tone === 'warm' && warmMsg) return warmMsg;
    if (tone === 'firm' && firmMsg) return firmMsg;
    return shortMsg;
  };

  if (/(ingreso|sueldo|nomina|me pagaron|me consignaron|abono|deposito)/.test(text) && amount !== null) {
    return respond(
      `Listo. Saldo en ${formatMoney(currentSaldo)}.`,
      `Listo. Ingreso registrado. Tu saldo queda en ${formatMoney(currentSaldo)}.`,
      `Hecho, guardé el ingreso y tu saldo ahora queda en ${formatMoney(currentSaldo)}.`,
      `Ingreso listo.`
    );
  }

  if (/(gasto|gaste|gast[eé]|me gaste|compre|compr[eé]|pague|pagu[eé]|transferi|transfer[ií]re)/.test(text) && amount !== null) {
    return respond(
      `Hecho, quedó guardado y tu saldo estimado ahora es ${formatMoney(currentSaldo)}.`,
      `Hecho, quedó registrado y tu saldo estimado queda en ${formatMoney(currentSaldo)}.`,
      `Hecho, ese movimiento quedó guardado y ya te ajusté el saldo a ${formatMoney(currentSaldo)}.`,
      `Movimiento listo.`
    );
  }

  if (/(factura|recibo|cuenta)/.test(text) && /(ya\s+)?pague|pagu[eé]/.test(text)) {
    return respond(
      'Factura cerrada.',
      'Perfecto, la factura quedó pagada. Si quieres, reviso las pendientes.',
      'Perfecto, la factura ya quedó cerrada. Si quieres, te reviso las pendientes y te dejo el orden completo.',
      'Factura cerrada.'
    );
  }

  if (/(peso|pesas|kg|kilos)/.test(text) && amount !== null) {
    const weightHistory = Array.isArray(state.weightHistory) ? state.weightHistory : [];
    const previous = weightHistory.length > 1 ? Number(weightHistory[weightHistory.length - 2]?.weight || 0) : null;
    if (previous) {
      const diff = amount - previous;
      const direction = diff > 0 ? 'subiste' : diff < 0 ? 'bajaste' : 'te mantuviste';
      return respond(
        'Peso guardado.',
        `Listo. Vas ${direction} ${Math.abs(diff).toFixed(1)} kg frente al último registro.`,
        `Bien, ya guardé tu peso. Vas ${direction} ${Math.abs(diff).toFixed(1)} kg frente al último registro.`,
        'Peso guardado.'
      );
    }
    return respond(
      'Peso guardado.',
      'Listo, quedó guardado como tu punto de referencia.',
      'Listo, quedó guardado como tu primer registro de referencia.',
      'Peso guardado.'
    );
  }

  if (/(traslado|demoro|demora|camino|viaje)/.test(text) && amount !== null) {
    return respond(
      `Traslado en ${Math.round(amount)} min.`,
      `Listo, traslado en ${Math.round(amount)} minutos. Ya puedo ajustar mejor tu jornada.`,
      `Hecho, con ${Math.round(amount)} minutos de traslado ya te dejo mejor alineado el descanso y la energía del día.`,
      'Traslado guardado.'
    );
  }
  if (/(rutina|entreno|gym|gimnasio|ejercicio)/.test(text) && /(semanal|semana|lunes a sabado|lunes a sábado|completa|toda la semana|aplicar mi kit|usa mi kit|reorganiza|reconstruye)/.test(text)) {
    return respond(
      'Plan semanal listo.',
      'Listo, ya te armé el plan semanal con lo que tienes en casa.',
      'Perfecto, ya te ordené el plan semanal completo usando lo que tienes en casa.',
      'Plan semanal listo.'
    );
  }

  if (isSleep && times.length > 0) {
    const wakeRef = /(despert|wake|alarm)/.test(text) ? `Despertar a las ${times[0]}` : `Dormir a las ${times[0]}`;
    return respond(
      `${wakeRef}.`,
      `Listo. ${wakeRef}. Ya lo alineé con ${commute} minutos de traslado.`,
      `Hecho. ${wakeRef}. Con ${commute} minutos de traslado ya te lo dejo alineado para descansar mejor.`,
      `${wakeRef}.`
    );
  }

  if (/(dorm|sueno|sueÃ±o|descans)/.test(text)) {
    const nextShift = Array.isArray(state.workShifts)
      ? state.workShifts
          .map((shift: any) => ({ shift, idx: DAY_NAMES.findIndex((d) => normalizeCommand(d) === normalizeCommand(shift?.day || '')) }))
          .filter((item: any) => item.idx >= 0)
          .sort((a: any, b: any) => a.idx - b.idx)[0]
      : null;
    if (nextShift?.shift?.start && typeof state.calculateSleepCycles === 'function') {
      const commute = Math.max(0, Math.round(state.commuteMinutes || 35));
      const [h, m] = String(nextShift.shift.start).split(':').map(Number);
      if (Number.isFinite(h) && Number.isFinite(m)) {
        const wakeMinutes = h * 60 + m - commute - 45;
        const wrappedWakeMinutes = ((wakeMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
        const wakeHour = `${String(Math.floor(wrappedWakeMinutes / 60)).padStart(2, '0')}:${String(wrappedWakeMinutes % 60).padStart(2, '0')}`;
        const windows = state.calculateSleepCycles(wakeHour);
        const preferred = windows.find((window: any) => window.recommended) || windows[0];
        if (preferred) {
          return respond(
            `Tu mejor ventana es ${preferred.sleepTime}.`,
            `Tu mejor ventana para el siguiente turno es ${preferred.sleepTime} y despiertas ${preferred.wakeTime}.`,
            `Tu mejor ventana para el siguiente turno es ${preferred.sleepTime}. Despiertas ${preferred.wakeTime} y completas ${preferred.cycles} ciclos.`,
            `Tu mejor ventana es ${preferred.sleepTime}.`
          );
        }
      }
    }
    return respond(
      'Sueño registrado.',
      'Dormir bien pesa más que alargar el día. Si quieres, te calculo la mejor ventana según tu siguiente turno.',
      'Dormir bien pesa más que alargar el día. Si quieres, te calculo la ventana exacta según tu siguiente turno y tu traslado.',
      'Sueño registrado.'
    );
  }
  if (/(turno|horario)/.test(text) && times.length >= 2) {
    return respond(
      'Turno guardado.',
      'Listo, guardé el turno y ya te acomodo llegada, comida y descanso.',
      'Perfecto, ya quedó guardado y con eso te organizo el resto del día.',
      'Turno guardado.'
    );
  }

  if (isHealth) {
    const equipment = Array.isArray(state.health?.equipmentInventory) ? state.health.equipmentInventory.slice(0, 4).join(', ') : '';
    const routineToday = state.health?.routine?.[new Date().getDay()];
    return respond(
      'Rutina lista.',
      routineToday
        ? `Rutina lista para ${routineToday.name}. Si quieres, te la desgloso por ejercicios, series y descansos.`
        : 'Rutina lista. Si quieres, después te la desgloso por ejercicios, series y descansos.',
      routineToday
        ? `Perfecto, ya te dejé lista la rutina de ${routineToday.name}. Si quieres, la afino por tiempo, intensidad o equipo disponible (${equipment || 'tu kit'}).`
        : 'Listo, rutina preparada. Si quieres, luego te la desgloso por ejercicios, series y descansos con más detalle.',
      'Rutina lista.'
    );
  }

  if (isFocus) {
    const focusStatus = state.focusStatus || {};
    const focusStreak = Number(focusStatus.focusStreak || 0);
    if (/(recaid|relapse)/.test(text)) {
      return respond(
        'Racha reiniciada.',
        'Listo, racha reiniciada. Si quieres, armamos un plan para esos momentos.',
        'Listo, racha reiniciada. Si quieres, te ayudo a armar un plan para esos momentos difíciles.',
        'Racha reiniciada.'
      );
    }
    if (/(impulso|antojo)/.test(text)) {
      return respond(
        'Impulso registrado.',
        'Quedó registrado ese impulso. Bien por no dejarlo pasar.',
        'Quedó registrado ese impulso. Bien hecho por no dejarlo pasar; eso ya suma.',
        'Impulso registrado.'
      );
    }
    return respond(
      `Vas en ${focusStreak} días de racha.`,
      `Vas bien. Tu racha de enfoque va en ${focusStreak} días.`,
      `Vas muy bien. Tu racha de enfoque va en ${focusStreak} días y ya se nota el orden que estás construyendo.`,
      `Vas en ${focusStreak} días de racha.`
    );
  }

  if (isTask && /(crear|agrega|añade|anade|nueva)/.test(text)) {
    return respond(
      'Tarea creada.',
      'Listo, tarea creada. Si quieres luego la amarro a una fecha o prioridad.',
      'Perfecto, la tarea quedó creada. Si quieres luego la amarramos a fecha o prioridad.',
      'Tarea creada.'
    );
  }

  if (isTask && /(completa|hecha|termina|finaliza)/.test(text)) {
    return respond(
      'Tarea completada.',
      'Perfecto, tarea completada. Vamos con la siguiente cuando quieras.',
      'Perfecto, tarea completada. Vamos con la siguiente cuando quieras.',
      'Tarea completada.'
    );
  }

  return null;
};
const handleLocalCommand = async (commandText: string, get: any): Promise<boolean | void> => {
  const text = normalizeCommand(commandText);
  const amount = extractMoney(commandText);
  const times = extractTimeCandidates(commandText);
  const dayIndex = dayIndexFromText(commandText);
  const currentState = get();

  const updateWorkShifts = (shift: { day: string; start: string; end: string }) => {
    const existing = Array.isArray(currentState.workShifts) ? currentState.workShifts : [];
    const next = existing
      .filter((item: any) => normalizeCommand(item.day) !== normalizeCommand(shift.day))
      .map((item: any) => ({ day: item.day, start: item.start, end: item.end }));
    next.push({ day: shift.day, start: shift.start, end: shift.end });
    next.sort((a: { day: string }, b: { day: string }) => DAY_NAMES.indexOf(normalizeCommand(a.day)) - DAY_NAMES.indexOf(normalizeCommand(b.day)));
    get().setWorkShifts(next);
  };

  const extractNamedTarget = (keywords: string[]) => {
    const source = stripAccents(commandText);
    for (const keyword of keywords) {
      const regex = new RegExp(`${keyword}\\s+(?:de\\s+|del\\s+|la\\s+|el\\s+)?(.+)$`, 'i');
      const match = source.match(regex);
      if (match?.[1]) {
        return match[1].trim().replace(/[?.!]+$/, '');
      }
    }
    return '';
  };

  if (/(ingreso|sueldo|nomina|me pagaron|me consignaron|abono|deposito)/.test(text) && amount !== null) {
    const category = /sueldo|nomina/.test(text) ? 'Sueldo' : /abono|deposito/.test(text) ? 'Ingreso' : 'Ingreso';
    const description =
      extractNamedTarget(['ingreso', 'sueldo', 'nomina', 'abono', 'deposito']) ||
      (category === 'Sueldo' ? 'Sueldo' : 'Ingreso registrado');
    await currentState.addIncome(amount, description, category);
    currentState.addLog({
      text: `Hecho, registré el ingreso de ${description} por ${formatMoney(amount)}.`,
      category: 'SISTEMA',
    });
    return true;
  }

  if (/(gasto|gaste|gast[eÃ©]|me gaste|compre|compr[eÃ©]|pague|pagu[eÃ©]|transferi|transfer[iÃ­]re|gaste|gaste)/.test(text) && amount !== null) {
    const description =
      extractNamedTarget(['comprando', 'comiendo', 'en', 'por', 'para']) ||
      (text.includes('comida') ? 'Comida' : text.includes('transporte') ? 'Transporte' : 'Gasto registrado');
    const category = text.includes('comida') ? 'Comida' : text.includes('transporte') ? 'Transporte' : 'General';
    await currentState.addExpense(amount, description, category);
    currentState.addLog({
      text: `Hecho, registré el gasto de ${description} por ${formatMoney(amount)}.`,
      category: 'GASTO',
    });
    return true;
  }

  if (/(factura|recibo|cuenta)/.test(text) && /(ya\s+)?pague|pagu[eÃ©]/.test(text)) {
    const targetName =
      extractNamedTarget(['factura', 'recibo', 'cuenta']) ||
      (Array.isArray(currentState.fixedExpenses) && currentState.fixedExpenses.find((expense: any) => expense.status !== 'paid')?.name) ||
      '';
    if (!targetName) {
      currentState.addLog({ text: 'Me falta el nombre de la factura para marcarla como pagada.', category: 'LOGISTICA' });
      return true;
    }
    await currentState.markFixedExpensePaid(targetName);
    currentState.addLog({ text: `Hecho, marqué ${targetName} como pagada.`, category: 'SISTEMA' });
    return true;
  }

  if (/(peso|pesas|kg|kilos)/.test(text) && amount !== null) {
    await currentState.logWeight(amount);
    currentState.addLog({ text: `Hecho, dejé tu peso en ${amount.toFixed(1)} kg.`, category: 'SISTEMA' });
    return true;
  }

  if (/(traslado|demoro|demora|camino|viaje)/.test(text) && amount !== null) {
    currentState.setCommuteMinutes(amount);
    currentState.addLog({ text: `Hecho, ajusté tu traslado a ${Math.round(amount)} minutos.`, category: 'SISTEMA' });
    return true;
  }

  if (/(dorm|sueno|sueÃ±o|descans)/.test(text) && times.length > 0) {
    if (/(despert|wake|alarm)/.test(text)) {
      currentState.setTargetWakeTime(times[0]);
      currentState.addLog({ text: `Hecho, tu hora objetivo de despertar quedó en ${times[0]}.`, category: 'SISTEMA' });
    } else {
      currentState.setTargetSleepTime(times[0]);
      currentState.addLog({ text: `Hecho, tu hora objetivo de dormir quedó en ${times[0]}.`, category: 'SISTEMA' });
    }
    return true;
  }

  if (/(turno|horario)/.test(text) && times.length >= 2) {
    const resolvedDayIndex = dayIndex ?? new Date().getDay();
    const dayName = dayIndex !== null ? dayNameFromIndex(resolvedDayIndex) : dayNameFromIndex(resolvedDayIndex);
    updateWorkShifts({ day: dayName, start: times[0], end: times[1] });
    currentState.addLog({ text: `Hecho, actualicé tu turno de ${dayName} a ${times[0]} - ${times[1]}.`, category: 'SISTEMA' });
    return true;
  }

  if (/(rutina|entreno|gym|gimnasio|ejercicio)/.test(text)) {
    if (/(semanal|semana|lunes a sabado|lunes a sábado|completa|toda la semana|aplicar mi kit|usa mi kit|reorganiza|reconstruye)/.test(text)) {
      const weeklyPlan = buildWeeklyRoutinePlan(currentState.health?.equipmentInventory || []);
      currentState.setWeeklyRoutinePlan(weeklyPlan);
      currentState.addLog({ text: 'Listo, reconstruí tu plan semanal de gym con tu equipo disponible.', category: 'SISTEMA' });
      return true;
    }

    if (/(mas|más).*(espalda|pecho|pierna|abdomen|abdominal|core|gluteo|glúteo|hombro|triceps|tríceps|biceps|bíceps)/.test(text)) {
      const resolvedDayIndex = resolveRoutineDayIndex(commandText, currentState, null) ?? dayIndex ?? new Date().getDay();
      const routineDay = currentState.health?.routine?.[resolvedDayIndex];
      if (!routineDay) {
        currentState.addLog({ text: 'No veo una rutina activa para subirle el nivel.', category: 'LOGISTICA' });
        return true;
      }
      const accessory = buildAccessoryExercise(commandText, currentState.health?.equipmentInventory || []);
      const updatedExercises = [...routineDay.exercises, accessory];
      currentState.setRoutineDay(resolvedDayIndex, routineDay.name, updatedExercises, {
        objective: routineDay.objective,
        estimatedMinutes: Math.max(20, Number(routineDay.estimatedMinutes || updatedExercises.length * 10) + 10),
        notes: [...(routineDay.notes || []), 'Se añadió un bloque extra por instrucción del usuario.'],
      });
      currentState.addLog({ text: `Hecho, te reforcé la rutina con ${accessory.name}.`, category: 'SISTEMA' });
      return true;
    }

    if (/(mas|más).*(corto|breve|rapido|rápido|menos tiempo|acorta|reduce)/.test(text)) {
      const resolvedDayIndex = resolveRoutineDayIndex(commandText, currentState, null) ?? dayIndex ?? new Date().getDay();
      const routineDay = currentState.health?.routine?.[resolvedDayIndex];
      if (!routineDay) {
        currentState.addLog({ text: 'No veo una rutina activa para recortar.', category: 'LOGISTICA' });
        return true;
      }
      const shortened = applyIntensityToRoutine(routineDay, 'shorter');
      if (!shortened) return true;
      currentState.setRoutineDay(resolvedDayIndex, routineDay.name, shortened.exercises, {
        objective: shortened.objective,
        estimatedMinutes: shortened.estimatedMinutes,
        notes: shortened.notes,
      });
      currentState.addLog({ text: `Hecho, dejé más corta la rutina de ${routineDay.name}.`, category: 'SISTEMA' });
      return true;
    }

    if (/(mas|más).*(pesado|intenso|fuerte|duro|intensidad|carga)/.test(text)) {
      const resolvedDayIndex = resolveRoutineDayIndex(commandText, currentState, null) ?? dayIndex ?? new Date().getDay();
      const routineDay = currentState.health?.routine?.[resolvedDayIndex];
      if (!routineDay) {
        currentState.addLog({ text: 'No veo una rutina activa para poner más dura.', category: 'LOGISTICA' });
        return true;
      }
      const harder = applyIntensityToRoutine(routineDay, 'harder');
      if (!harder) return true;
      currentState.setRoutineDay(resolvedDayIndex, routineDay.name, harder.exercises, {
        objective: harder.objective,
        estimatedMinutes: harder.estimatedMinutes,
        notes: harder.notes,
      });
      currentState.addLog({ text: `Hecho, subí la intensidad de ${routineDay.name}.`, category: 'SISTEMA' });
      return true;
    }

    const swap = extractRoutineSwap(commandText);
    if (swap) {
      const resolvedDayIndex = resolveRoutineDayIndex(commandText, currentState, swap.oldName);
      if (resolvedDayIndex === null) {
        currentState.addLog({ text: `No encontré "${swap.oldName}" dentro de tu rutina para cambiarlo.`, category: 'LOGISTICA' });
        return true;
      }
      currentState.updateRoutineExercise(resolvedDayIndex, swap.oldName, swap.newName);
      currentState.addLog({
        text: `Hecho, cambié "${swap.oldName}" por "${swap.newName}" en tu rutina.`,
        category: 'SISTEMA',
      });
      return true;
    }

    if (/(agrega|añade|anade|suma|incorpora|pon)/.test(text)) {
      const suggestion = buildExerciseSuggestion(commandText, currentState.health?.equipmentInventory || []);
      const resolvedDayIndex = resolveRoutineDayIndex(commandText, currentState, suggestion.name);
      if (resolvedDayIndex === null) {
        currentState.addLog({ text: 'No pude ubicar el día de la rutina para sumar ese ejercicio.', category: 'LOGISTICA' });
        return true;
      }
      currentState.addRoutineExercise(resolvedDayIndex, suggestion);
      const dayName = dayNameFromIndex(resolvedDayIndex);
      currentState.addLog({
        text: `Hecho, agregué "${suggestion.name}" a tu rutina de ${dayName}.`,
        category: 'SISTEMA',
      });
      return true;
    }

    if (/(quita|elimina|borra|saca|retira)/.test(text)) {
      const removalMatch = stripAccents(commandText).match(/(?:quita|elimina|borra|saca|retira)\s+(.+?)(?:\s+de\s+la\s+rutina|\s*$)/i);
      const targetName = String(removalMatch?.[1] || '').trim();
      if (!targetName) {
        currentState.addLog({ text: 'Necesito el nombre exacto del ejercicio que quieres sacar.', category: 'LOGISTICA' });
        return true;
      }
      const resolvedDayIndex = resolveRoutineDayIndex(commandText, currentState, targetName);
      if (resolvedDayIndex === null) {
        currentState.addLog({ text: `No encontré "${targetName}" dentro de tu rutina para quitarlo.`, category: 'LOGISTICA' });
        return true;
      }
      currentState.removeRoutineExercise(resolvedDayIndex, targetName);
      currentState.addLog({
        text: `Hecho, saqué "${targetName}" de tu rutina.`,
        category: 'SISTEMA',
      });
      return true;
    }

    const kind = text.includes('brazo') ? 'brazo' : text.includes('pecho') || text.includes('espalda') || text.includes('torso') ? 'torso' : text.includes('pierna') ? 'pierna' : null;
    if (kind) {
      const resolvedDayIndex = dayIndex ?? new Date().getDay();
      const dayName = dayNameFromIndex(resolvedDayIndex);
      const template = buildRoutineTemplate(kind as 'brazo' | 'torso' | 'pierna', currentState.health?.equipmentInventory || []);
      currentState.setRoutineDay(resolvedDayIndex, dayName, template.exercises, {
        objective: template.objective,
        estimatedMinutes: template.estimatedMinutes,
        notes: template.notes,
      });
      currentState.addLog({ text: `Hecho, te dejé la rutina de ${template.dayName.toLowerCase()} para ${dayName}.`, category: 'SISTEMA' });
      return true;
    }
    return false;
}};


export const createOmniSlice = (set: any, get: any): OmniSlice => ({
  logs: [],
  isProcessing: false,
  toast: { visible: false, message: '' },
  pendingAction: null,
  dailyQuote: '',
  sessionAICost: 0,
  aiCostCop: 0,
  lastOmniMessagesSyncAt: 0,

  addLog: (log) => {
    set((state: any) => ({
      logs: [...(Array.isArray(state.logs) ? state.logs : []), { id: genId(), timestamp: new Date(), ...log }].slice(-250),
    }));
  },

  loadOmniMessages: async (force = false) => {
    try {
      const lastSync = get().lastOmniMessagesSyncAt || 0;
      if (!force && lastSync && Date.now() - lastSync < 2 * 60 * 1000) {
        return;
      }
      const res = await apiGet('/api/v1/omni/messages');
      if (!res || !res.ok) return;
      const data: OmniMessageListResponse = await res.json();
      const messages = (data.data || data.messages || []) as OmniMessage[];
      const msgs = messages.map((m: OmniMessage) => ({
        id: m.id,
        text: m.role === 'user' ? `> ${m.content}` : m.content,
        category: m.role === 'user' ? 'NONE' as const : 'SISTEMA' as const,
        timestamp: new Date(m.created_at),
      }));
      if (msgs.length > 0) {
        set({ logs: msgs.reverse() });
      }
      set({ lastOmniMessagesSyncAt: Date.now() });
    } catch (e) {
      console.error('Error loading NAVIR history:', e);
    }
  },

  processCommandWithAI: async (commandText: string) => {
    const { session } = get();
    if (!session) {
      get().addLog({ text: 'ERROR: Sin sesiÃ³n activa. Reinicia sesiÃ³n e intenta de nuevo.', category: 'ERROR' });
      return;
    }
    get().addLog({ text: `> ${commandText}`, category: 'NONE' });
    set({ isProcessing: true });

    try {
      // Prioridad: backend. Si falla, caemos a manejo local/offline.
      const pendingTasks = (get().projects?.tasks ?? []).filter((t: any) => !t.completed);

      try {
        const response = await apiPost('/api/v1/process-command', {
          command: commandText,
          context_tasks: pendingTasks,
          user_profile: get().userProfile,
          available_equipment: get().health?.equipmentInventory || [],
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody?.detail || `Error del servidor (${response.status})`);
        }

        const data: AIResponse = await response.json();
        const cost = data.interaction_cost_cop || 0;

        set((state: any) => ({ sessionAICost: state.sessionAICost + cost, aiCostCop: state.aiCostCop + cost }));

        if (data.multi_intent && data.actions && data.actions.length > 0) {
          set({ pendingAction: { mode: 'multi' as const, actions: data.actions } });
          get().addLog({ text: `Navir vio ${data.actions.length} cosas por confirmar.`, category: 'LOGISTICA', costCOP: cost, currentTRM: data.current_trm });
        } else if (['DEBT', 'FIXED_EXPENSE', 'PAY_FIXED_EXPENSE', 'GASTO', 'REGISTER_INCOME', 'LOG_WEIGHT', 'LOG_EXERCISE', 'LOG_SLEEP', 'CREATE_SHIFT', 'UPDATE_SHIFT', 'DELETE_SHIFT', 'SET_WAKE_TIME', 'CREATE_ROUTINE', 'ADD_ROUTINE_EXERCISE', 'REMOVE_ROUTINE_EXERCISE', 'COMPLETE_ROUTINE', 'UPDATE_ROUTINE', 'ANALYZE_FINANCES', 'CREATE_GOAL', 'UPDATE_GOAL', 'COMPLETE_GOAL', 'LOG_METRIC', 'REGISTER_FOCUS_DAY', 'REGISTER_URGE', 'REGISTER_RELAPSE', 'RESET_FOCUS', 'CREATE_TASK', 'UPDATE_TASK', 'COMPLETE_TASK', 'DELETE_TASK'].includes(data.intent)) {
          const ext = data.extracted_data as Record<string, number | string | undefined>;
          let summary = '';
          if (data.intent === 'DEBT') summary = `Registrar deuda con ${ext.entity} por ${(ext.amount as number)?.toLocaleString()}?`;
          if (data.intent === 'FIXED_EXPENSE') summary = `Registrar factura fija ${ext.name} con vencimiento el día ${ext.dueDate} por ${(ext.amount as number)?.toLocaleString()}?`;
          if (data.intent === 'PAY_FIXED_EXPENSE') summary = `Marcar como pagada la factura ${ext.name || ext.description || 'seleccionada'}?`;
          if (data.intent === 'REGISTER_INCOME') summary = `Registrar ingreso: ${ext.description || 'movimiento'} por ${(ext.amount as number)?.toLocaleString()}?`;
          if (data.intent === 'LOG_WEIGHT') summary = `Registrar peso de ${(ext.weight as number)?.toLocaleString()} kg?`;
          if (data.intent === 'LOG_EXERCISE') summary = `Registrar ejercicio ${ext.exercise_name || ext.name || 'sin nombre'}?`;
          if (data.intent === 'LOG_SLEEP') summary = `Registrar sueno de ${ext.bed_time || ext.sleep_time || 'hora indicada'} a ${ext.wake_time || 'hora indicada'}?`;
          if (data.intent === 'CREATE_SHIFT') summary = `Crear turno ${ext.day || ''} de ${ext.start || ''} a ${ext.end || ''}?`;
          if (data.intent === 'UPDATE_SHIFT') summary = `Actualizar turno ${ext.day || ext.shift_id || 'seleccionado'}?`;
          if (data.intent === 'DELETE_SHIFT') summary = `Eliminar turno ${ext.day || ext.shift_id || 'seleccionado'}?`;
          if (data.intent === 'SET_WAKE_TIME') summary = `Cambiar hora de despertar a ${ext.t_wake_target || ext.wake_time || ext.time || 'la indicada'}?`;
          if (data.intent === 'CREATE_ROUTINE') summary = `Ajustar rutina para ${ext.day || ext.day_name || 'el día indicado'}?`;
          if (data.intent === 'ADD_ROUTINE_EXERCISE') summary = `Agregar ejercicio ${ext.exercise_name || ext.name || 'a la rutina'}?`;
          if (data.intent === 'REMOVE_ROUTINE_EXERCISE') summary = `Quitar ejercicio ${ext.exercise_name || ext.name || 'de la rutina'}?`;
          if (data.intent === 'COMPLETE_ROUTINE') summary = `Marcar rutina como completada?`;
          if (data.intent === 'GASTO') summary = `Registrar gasto: ${ext.description} por ${(ext.amount as number)?.toLocaleString()}?`;
          if (data.intent === 'UPDATE_ROUTINE') summary = `Actualizar rutina: Cambiar ${ext.old_exercise} por ${ext.new_exercise}?`;
          if (data.intent === 'ANALYZE_FINANCES') summary = `Ejecutar análisis financiero profundo?`;
          if (data.intent === 'CREATE_GOAL') summary = data.mensaje_sistema || `Crear meta: ${ext?.name || 'nueva'}?`;
          if (data.intent === 'UPDATE_GOAL') summary = data.mensaje_sistema || `Actualizar meta ${ext?.goal_name || ext?.name || ext?.goal_id || 'seleccionada'}?`;
          if (data.intent === 'COMPLETE_GOAL') summary = data.mensaje_sistema || `Marcar meta como completada?`;
          if (data.intent === 'REGISTER_FOCUS_DAY') summary = data.mensaje_sistema || 'Registrar tu día limpio?';
          if (data.intent === 'REGISTER_URGE') summary = data.mensaje_sistema || 'Registrar impulso?';
          if (data.intent === 'REGISTER_RELAPSE') summary = data.mensaje_sistema || 'Registrar recaída y reiniciar racha?';
          if (data.intent === 'RESET_FOCUS') summary = data.mensaje_sistema || 'Reiniciar racha de enfoque?';
          if (data.intent === 'CREATE_TASK') summary = data.mensaje_sistema || `Crear tarea: ${ext?.name || ext?.title || 'nueva'}?`;
          if (data.intent === 'UPDATE_TASK') summary = data.mensaje_sistema || `Actualizar tarea ${ext?.task_id || ext?.mission_id || ext?.name || ext?.title || 'seleccionada'}${ext?.priority ? ` (prioridad ${ext.priority})` : ''}${ext?.scheduled_at || ext?.scheduledAt || ext?.due_date || ext?.dueDate ? ` y reprogramarla` : ''}?`;
          if (data.intent === 'COMPLETE_TASK') summary = data.mensaje_sistema || 'Marcar tarea como completada?';
          if (data.intent === 'DELETE_TASK') summary = data.mensaje_sistema || `Eliminar tarea ${ext?.task_id || ext?.mission_id || ext?.name || ext?.title || 'seleccionada'}?`;
          if (data.intent === 'LOG_METRIC') summary = data.mensaje_sistema || `Registrar avance: ${ext?.value || 0} ${ext?.unit || ''}?`;

          if (data.executed) {
            const displayText = data.mensaje_sistema || summary;
            get().addLog({ text: displayText, category: 'SISTEMA', costCOP: cost, currentTRM: data.current_trm });
            set({ toast: { visible: true, message: displayText } });
            setTimeout(() => {
              set({ toast: { visible: false, message: '' } });
            }, 3000);
            if (data.xp_ganada) get().addXP(data.xp_ganada);
            if (['PAY_FIXED_EXPENSE', 'REGISTER_INCOME', 'LOG_WEIGHT', 'LOG_EXERCISE', 'LOG_SLEEP', 'CREATE_SHIFT', 'UPDATE_SHIFT', 'DELETE_SHIFT', 'SET_WAKE_TIME', 'CREATE_ROUTINE', 'ADD_ROUTINE_EXERCISE', 'REMOVE_ROUTINE_EXERCISE', 'COMPLETE_ROUTINE', 'CREATE_GOAL', 'UPDATE_GOAL', 'COMPLETE_GOAL', 'LOG_METRIC', 'REGISTER_FOCUS_DAY', 'REGISTER_URGE', 'REGISTER_RELAPSE', 'RESET_FOCUS', 'CREATE_TASK', 'UPDATE_TASK', 'COMPLETE_TASK', 'DELETE_TASK'].includes(data.intent)) {
              get().markDataDirty('omni');
              void get().hydrateStore(true);
            }
          } else {
            set({ pendingAction: { type: data.intent as any, data: ext, summary } });
            get().addLog({ text: data.mensaje_sistema || summary, category: 'LOGISTICA', costCOP: cost, currentTRM: data.current_trm });
          }
        } else {
          const actionResponses = Array.isArray((data as any).actions) ? (data as any).actions : [];
          const stitchedMessage = actionResponses
            .map((a: any) => a?.mensaje_sistema || a?.summary || a?.description || '')
            .filter(Boolean)
            .join('\n');
          const conversationalMessage = (data as AIResponse).respuesta_usuario?.trim();
          const systemMessage = data.mensaje_sistema?.trim();
          const fallbackMessage =
            conversationalMessage ||
            systemMessage ||
            stitchedMessage ||
            (data.intent === 'NONE'
              ? 'No pude entender bien eso. Prueba con algo más específico.'
              : 'Te respondí, pero no pude dejarlo más claro.');

          get().addLog({
            text: fallbackMessage,
            category: 'SISTEMA',
            costCOP: cost,
            currentTRM: data.current_trm,
          });
          if (data.xp_ganada) get().addXP(data.xp_ganada);
        }
        return;
      } catch (remoteError) {
        const handledLocally = await handleLocalCommand(commandText, get);
        if (handledLocally) {
          const followUp = buildLocalFollowUp(commandText, get);
          if (followUp) {
            get().addLog({ text: followUp, category: 'SISTEMA' });
          }
          return;
        }
        throw remoteError;
      }
    } catch (error: any) {
      console.error('[OMNI] processCommandWithAI error:', error);
      const msg = error?.message || 'Error desconocido';
      get().addLog({ text: `Navir se quedó sin conexión: ${msg}`, category: 'NONE' });
    } finally {
      set({ isProcessing: false });
    }
  },

  confirmPendingAction: async () => {
    const { pendingAction, session } = get();
    if (!pendingAction) return;
    if (!session) {
      get().addLog({ text: 'ERROR: Sesión no autenticada. No se puede ejecutar la acción.', category: 'ERROR' });
      set({ pendingAction: null, isProcessing: false });
      return;
    }

    set({ isProcessing: true });
    try {
      if ('mode' in pendingAction && pendingAction.mode === 'multi') {
        for (const action of pendingAction.actions) {
          try {
            const handledLocally = await handleLocalCommand(action.command, get);
            if (handledLocally) {
              const followUp = buildLocalFollowUp(action.command, get);
              if (followUp) {
                get().addLog({ text: followUp, category: 'SISTEMA' });
              }
            } else {
              get().addLog({ text: `No pude ejecutar localmente: ${action.description}.`, category: 'LOGISTICA' });
            }
          } catch (e: any) {
            get().addLog({ text: `Error ejecutando "${action.description}": ${e?.message || 'Error desconocido'}`, category: 'ERROR' });
          }
        }
        get().addLog({ text: 'Ya quedó todo listo.', category: 'SISTEMA' });
        return;
      }

      const command = buildCommandFromPendingAction(pendingAction);
      if (command) {
        const handledLocally = await executePendingActionLocally(pendingAction, get) || await handleLocalCommand(command, get);
        if (handledLocally) {
          const followUp = buildLocalFollowUp(command, get);
          if (followUp) {
            get().addLog({ text: followUp, category: 'SISTEMA' });
          }
        } else {
          const summary = String((pendingAction as any).summary || (pendingAction as any).type || 'Accion pendiente');
          get().addLog({ text: `No pude ejecutar esta acción sin backend: ${summary}.`, category: 'LOGISTICA' });
          return;
        }
        get().addLog({ text: 'Listo, ya quedó hecho y guardado.', category: 'LOGISTICA' });
      } else {
        const summary = String((pendingAction as any).summary || (pendingAction as any).type || 'Accion pendiente');
        get().addLog({ text: `No pude leer bien esa acción: ${summary}.`, category: 'ERROR' });
      }
    } catch (e: any) {
      const errorMsg = e?.message || 'Error inesperado al ejecutar acción';
      get().addLog({ text: `Se me enredó esto: ${errorMsg}`, category: 'ERROR' });
    } finally {
      set({ pendingAction: null, isProcessing: false });
    }
  },
  cancelPendingAction: () => {
    set({ pendingAction: null });
    get().addLog({ text: 'AcciÃ³n cancelada por el usuario.', category: 'LOGISTICA' });
  },

  forceResetProcessing: () => {
    set({ isProcessing: false, pendingAction: null });
    get().addLog({ text: 'Listo, ya reinicié todo y paré lo que estaba haciendo.', category: 'SISTEMA' });
  },
});
