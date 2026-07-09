import { apiPost } from '../../api/requests';
import { WorkShift, SleepWindow, Meal } from '../types';

export interface ScheduleSlice {
  workShifts: WorkShift[];
  targetWakeTime: string;
  targetSleepTime: string;
  commuteMinutes: number;
  mealPlan: Meal[];
  brainFog: number;
  lastWakeTimestamp: string | null;

  setWorkShifts: (shifts: Omit<WorkShift, 'id'>[]) => void;
  setTargetWakeTime: (time: string) => void;
  setTargetSleepTime: (time: string) => void;
  setCommuteMinutes: (minutes: number) => void;
  calculateSleepCycles: (wakeUpTime: string) => SleepWindow[];
  generateMealPlan: () => Promise<void>;
  getDailyActionPlan: () => string;
  setBrainFog: (level: number) => void;
  recordWakeUp: () => void;
}

const genId = () => Math.random().toString(36).substring(7);
const CYCLE_MINUTES = 90;
const SLEEP_LATENCY_MINUTES = 15;

const parseTimeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return (hours * 60 + minutes) % (24 * 60);
};

const formatMinutesTo24h = (minutes: number) => {
  const total = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

const formatMinutesToTime = (minutes: number) => {
  const total = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${mins.toString().padStart(2, '0')} ${suffix}`;
};

const addMinutes = (time: string, minutesToAdd: number, fallback: string) => {
  const base = parseTimeToMinutes(time);
  if (base === null) return fallback;
  return formatMinutesToTime(base + minutesToAdd);
};

const createFallbackMealPlan = (wakeTime: string, sleepTime: string, goal?: string): Meal[] => {
  const breakfastTime = addMinutes(wakeTime, 45, '7:30 AM');
  const lunchTime = addMinutes(wakeTime, 300, '12:30 PM');
  const dinnerCandidate = addMinutes(sleepTime, -150, '7:30 PM');
  const dinnerTime = dinnerCandidate === sleepTime ? '7:30 PM' : dinnerCandidate;
  const goalTag = goal ? ` para ${goal.toLowerCase()}` : '';
  return [
    {
      type: 'Desayuno',
      name: 'Huevos con avena y fruta',
      time: breakfastTime,
      ingredients: ['Huevos', 'Avena', 'Fruta', 'Agua'],
      instructions: `Empieza el día con proteína, carbohidratos y buena hidratación${goalTag}.`,
    },
    {
      type: 'Almuerzo',
      name: 'Pollo con arroz y vegetales',
      time: lunchTime,
      ingredients: ['Pollo', 'Arroz', 'Vegetales', 'Aceite de oliva'],
      instructions: 'Prioriza una porción alta en proteína y balancea con carbohidratos complejos.',
    },
    {
      type: 'Cena',
      name: 'Proteína magra con ensalada',
      time: dinnerTime,
      ingredients: ['Proteína magra', 'Ensalada', 'Aguacate'],
      instructions: 'Cierra el día con una cena ligera para ayudar al descanso y la recuperación.',
    },
  ];
};

export const createScheduleSlice = (set: any, get: any): ScheduleSlice => ({
  workShifts: [],
  targetWakeTime: '06:00',
  targetSleepTime: '22:00',
  commuteMinutes: 35,
  mealPlan: [],
  brainFog: 3,
  lastWakeTimestamp: null,

  setWorkShifts: (shifts: Omit<WorkShift, 'id'>[]) => {
    set({ workShifts: shifts.map((s) => ({ ...s, id: genId() })) });
    get().addLog({ text: 'Horario sincronizado.', category: 'SISTEMA' });
    get().markDataDirty('schedule');
  },

  setTargetWakeTime: (time: string) => {
    set({ targetWakeTime: time });
    get().markDataDirty('schedule');
  },

  setTargetSleepTime: (time: string) => {
    set({ targetSleepTime: time });
    get().markDataDirty('schedule');
  },

  setCommuteMinutes: (minutes: number) => {
    const next = Math.max(0, Math.min(120, Math.round(minutes || 0)));
    set({ commuteMinutes: next });
    get().markDataDirty('schedule');
  },

  calculateSleepCycles: (wakeUpTime: string) => {
    const [hours, minutes] = wakeUpTime.split(':').map(Number);
    const wakeDate = new Date();
    wakeDate.setHours(hours, minutes, 0, 0);

    const formatTime = (d: Date) => {
      let h = d.getHours();
      const m = d.getMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${h}:${m < 10 ? '0' + m : m} ${ampm}`;
    };

    const windows = [6, 5, 4].map((cycles) => {
      const sleepDuration = cycles * CYCLE_MINUTES * 60 * 1000;
      const sleepDate = new Date(wakeDate.getTime() - sleepDuration - SLEEP_LATENCY_MINUTES * 60 * 1000);
      const hoursTotal = cycles * 1.5;
      const score = Math.max(0, 100 - Math.abs(hoursTotal - 7.5) * 18 - Math.abs(cycles - 5) * 6);
      return {
        sleepTime: formatTime(sleepDate),
        wakeTime: formatTime(wakeDate),
        cycles,
        hours: hoursTotal,
        durationMinutes: cycles * CYCLE_MINUTES,
        latencyMinutes: SLEEP_LATENCY_MINUTES,
        cycleMinutes: CYCLE_MINUTES,
        score,
        label:
          cycles === 6
            ? 'Recuperacion profunda'
            : cycles === 5
              ? 'Balance ideal'
              : 'Minimo util',
      };
    });

    const recommendedIndex = windows.reduce((bestIndex, window, index) => {
      if (bestIndex === -1) return index;
      return window.score > windows[bestIndex].score ? index : bestIndex;
    }, -1);

    return windows
      .map((window, index) => ({
        ...window,
        recommended: index === recommendedIndex,
      }))
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  },

  generateMealPlan: async () => {
    const { userProfile, workShifts } = get();
    if (!userProfile) return;
    set({ isProcessing: true });
    try {
      const response = await apiPost('/api/v1/generate-meal-plan', { user_profile: userProfile, work_shifts: workShifts });
      const data = await response.json().catch(() => ({}));
      const queued = response.status === 202 || data?.queued === true || data?.queued_request === true;

      if (!response.ok && !queued) throw new Error('Error de red');

      if (Array.isArray(data?.meals) && data.meals.length > 0) {
        set({ mealPlan: data.meals });
        get().addLog({ text: 'Plan nutricional sincronizado.', category: 'SISTEMA' });
        get().markDataDirty('health');
      } else {
        const fallbackMeals = createFallbackMealPlan(
          get().targetWakeTime,
          get().targetSleepTime,
          userProfile.goal
        );
        set({ mealPlan: fallbackMeals });
        get().addLog({
          text: queued
            ? 'Plan nutricional estimado localmente mientras vuelve la conexión.'
            : 'Plan nutricional generado con fallback local.',
          category: 'SISTEMA',
        });
        get().markDataDirty('health');
      }
    } catch (e) {
      const fallbackMeals = createFallbackMealPlan(get().targetWakeTime, get().targetSleepTime, userProfile.goal);
      set({ mealPlan: fallbackMeals });
      get().addLog({ text: 'Plan nutricional local activado por error de red.', category: 'ERROR' });
      get().markDataDirty('health');
    } finally {
      set({ isProcessing: false });
    }
  },

  getDailyActionPlan: () => {
    const { health, workShifts, mealPlan, userProfile, commuteMinutes, targetSleepTime, calculateSleepCycles } = get();
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const todayIndex = new Date().getDay();
    const todayName = dayNames[todayIndex];
    const shiftToday = workShifts.find((shift: WorkShift) => shift.day === todayName) || null;
    const routineDay = health.routine[todayIndex] || null;
    const commute = Math.max(0, Math.round(commuteMinutes || 35));
    const mealLunch = mealPlan.find((meal: Meal) => meal.type === 'Almuerzo') || mealPlan[0] || null;
    const mealDinner = mealPlan.find((meal: Meal) => meal.type === 'Cena') || null;

    const parseTimeToMinutes = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
      return hours * 60 + minutes;
    };

    const formatMinutesTo24h = (minutes: number) => {
      const total = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
      const hours = Math.floor(total / 60);
      const mins = total % 60;
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    const addMinutes = (time: string, minutesToAdd: number) => {
      const base = parseTimeToMinutes(time);
      return base === null ? null : formatMinutesTo24h(base + minutesToAdd);
    };

    const nextShift = (() => {
      for (let offset = 0; offset < 7; offset += 1) {
        const index = (todayIndex + offset) % 7;
        const dayName = dayNames[index];
        const found = workShifts.find((shift: WorkShift) => shift.day === dayName);
        if (found) return { shift: found, dayName };
      }
      return null;
    })();

    const arrivalHome = shiftToday ? addMinutes(shiftToday.end, commute) : null;
    const focusStart = arrivalHome ? addMinutes(arrivalHome, 45) : null;
    const focusEnd = focusStart ? addMinutes(focusStart, 90) : null;
    const lunchTime = mealLunch?.time || (arrivalHome ? addMinutes(arrivalHome, 25) || '13:30' : '13:00');
    const dinnerTime = mealDinner?.time || '19:30';

    const sleepWindow = nextShift?.shift?.start
      ? (() => {
          const base = parseTimeToMinutes(nextShift.shift.start);
          return base === null ? null : calculateSleepCycles(formatMinutesTo24h(base - commute - 45))[0] || null;
        })()
      : null;

    const goal = userProfile?.goal ? ` (${userProfile.goal})` : '';
    const lines = [
      `Plan diario${goal}:`,
      shiftToday ? `- Turno: ${shiftToday.day} ${shiftToday.start} - ${shiftToday.end}.` : '- Hoy no hay turno registrado.',
      shiftToday && arrivalHome ? `- Llegada estimada a casa: ${arrivalHome} (traslado ${commute} min).` : `- Traslado base: ${commute} min.`,
      `- Almuerzo: ${mealLunch ? `${mealLunch.name} a las ${lunchTime}` : `despues de llegar, a las ${lunchTime}`}.`,
      focusStart && focusEnd ? `- Bloque de concentracion: ${focusStart} - ${focusEnd} para apps, estudio o avances pesados.` : '- Bloque de concentracion: reserva 90 min sin interrupciones.',
      routineDay ? `- Entreno: ${routineDay.name}.` : '- Entreno: dia de recuperacion o descanso.',
      `- Cena: ${dinnerTime}.`,
      sleepWindow
        ? `- Sueno: para el proximo turno ${nextShift ? `${nextShift.dayName} ${nextShift.shift.start}` : ''}, duerme ${sleepWindow.sleepTime} para completar ${sleepWindow.cycles} ciclos y despertar ${sleepWindow.wakeTime}.`
        : `- Sueno: respeta tu hora objetivo ${targetSleepTime}.`,
    ];

    return lines.join('\n');
  },

  setBrainFog: (level: number) => {
    set({ brainFog: level });
    get().addLog({ text: `Neblina mental reportada: ${level}/10`, category: 'SISTEMA' });
    get().markDataDirty('health');
  },

  recordWakeUp: () => {
    set({ lastWakeTimestamp: new Date().toISOString() });
    get().markDataDirty('schedule');
  },
});
