import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { BorderRadius, Spacing } from '../theme/spacing';
import { apiFetch, apiPost, apiDelete, apiPut } from '../api/requests';
import { useAppStore, WorkShift, SleepWindow } from '../store';
import { ScreenHeader } from '../components/ScreenHeader';
import ScheduleWeekCalendar, { WeekDay } from '../components/schedule/ScheduleWeekCalendar';
import SchedulePlannerPanel from '../components/schedule/SchedulePlannerPanel';

type NavirDecision = {
  window: SleepWindow;
  overlap: boolean;
  shift: WorkShift | null;
} | null;

const formatMinutesTo24h = (minutes: number) => {
  const total = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

const parse24hToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const addMinutes = (time: string, minutes: number) => {
  const base = parse24hToMinutes(time);
  return base === null ? null : formatMinutesTo24h(base + minutes);
};

const ScheduleScreen: React.FC = () => {
  const {
    workShifts,
    targetWakeTime,
    targetSleepTime,
    commuteMinutes,
    setWorkShifts,
    setTargetWakeTime,
    setCommuteMinutes,
    calculateSleepCycles,
    userProfile,
    session,
  } = useAppStore();


  const [isScanning, setIsScanning] = useState(false);
  const [wakeInput, setWakeInput] = useState(targetWakeTime);
  const [showManualForm, setShowManualForm] = useState(false);
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedWeekDay, setSelectedWeekDay] = useState<WeekDay | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingShift, setEditingShift] = useState<WorkShift | null>(null);
  const [commuteInput, setCommuteInput] = useState(String(commuteMinutes || 35));


  useEffect(() => {
    setCommuteInput(String(commuteMinutes || 35));
  }, [commuteMinutes]);

  const sleepWindows = useMemo(() => calculateSleepCycles(targetWakeTime), [calculateSleepCycles, targetWakeTime]);

  const scheduleContext = useMemo(() => {
    const todayNameSpan = new Date().toLocaleDateString('es-CO', { weekday: 'long' });
    const todayShift = workShifts.find((shift) => shift.day.toLowerCase().includes(todayNameSpan.toLowerCase())) || null;
    const nextShift = workShifts.find((shift) => shift !== todayShift) || null;
    const commute = Math.max(0, Math.min(120, Number(commuteMinutes || 35)));
    const arrivalHome = todayShift ? addMinutes(todayShift.end, commute) : null;
    const focusStart = arrivalHome ? addMinutes(arrivalHome, 45) : null;
    const focusEnd = focusStart ? addMinutes(focusStart, 90) : null;
    const lunchTime = arrivalHome ? addMinutes(arrivalHome, 25) || '13:30' : '13:00';
    const dinnerTime = addMinutes(targetSleepTime, -150) || '19:30';
    const nextShiftWake = nextShift?.start ? addMinutes(nextShift.start, -commute - 45) : null;
    const nextShiftWindow = nextShiftWake ? calculateSleepCycles(nextShiftWake)[0] || null : null;

    return {
      todayShift,
      nextShift,
      commute,
      arrivalHome,
      focusStart,
      focusEnd,
      lunchTime,
      dinnerTime,
      nextShiftWindow,
    };
  }, [addMinutes, calculateSleepCycles, commuteMinutes, targetSleepTime, workShifts]);

  const dailyBlocks = useMemo(
    () => [
      {
        key: 'work',
        title: scheduleContext.todayShift ? `Turno ${scheduleContext.todayShift.start} - ${scheduleContext.todayShift.end}` : 'Sin turno hoy',
        detail: scheduleContext.todayShift ? `${scheduleContext.todayShift.day}` : 'Día libre',
        tone: Colors.accent.cyan,
      },
      {
        key: 'commute',
        title: scheduleContext.arrivalHome ? `Llegas ${scheduleContext.arrivalHome}` : `${scheduleContext.commute} min de traslado`,
        detail: scheduleContext.todayShift ? 'Tiempo de regreso a casa' : 'Base de transporte',
        tone: Colors.accent.orange,
      },
      {
        key: 'lunch',
        title: `Almuerzo ${scheduleContext.lunchTime}`,
        detail: 'Recarga post turno',
        tone: Colors.accent.green,
      },
      {
        key: 'focus',
        title: scheduleContext.focusStart && scheduleContext.focusEnd ? `${scheduleContext.focusStart} - ${scheduleContext.focusEnd}` : 'Bloque de foco',
        detail: 'Apps, estudio o desarrollo',
        tone: Colors.accent.indigo,
      },
      {
        key: 'gym',
        title: scheduleContext.todayShift ? 'Entreno / recuperación' : 'Entreno libre',
        detail: 'Ajustado a energía y carga',
        tone: Colors.accent.gold,
      },
      {
        key: 'dinner',
        title: `Cena ${scheduleContext.dinnerTime}`,
        detail: 'Baja la intensidad',
        tone: Colors.accent.red,
      },
      {
        key: 'sleep',
        title: scheduleContext.nextShiftWindow ? `Dormir ${scheduleContext.nextShiftWindow.sleepTime}` : `Dormir ${targetSleepTime}`,
        detail: scheduleContext.nextShiftWindow
          ? `${scheduleContext.nextShiftWindow.cycles} ciclos · despierta ${scheduleContext.nextShiftWindow.wakeTime}`
          : 'Ajustado a tu hora meta',
        tone: Colors.accent.indigo,
      },
    ],
    [scheduleContext, targetSleepTime]
  );

  const NAVIRDecision: NavirDecision = useMemo(() => {
    if (sleepWindows.length === 0) return null;
    const today = new Date().getDay();
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const todayName = days[today];
    const todayShift = workShifts.find((s) => s.day === todayName);

    for (const w of sleepWindows) {
      const hasOverlap = checkOverlap(w, workShifts);
      if (!hasOverlap) return { window: w, overlap: false, shift: todayShift || null };
    }
    return { window: sleepWindows[0], overlap: true, shift: todayShift || null };
  }, [sleepWindows, workShifts]);

  const timeBar = useMemo(() => {
    if (!NAVIRDecision?.window) return null;

    const parse12h = (timeStr: string) => {
      const [time, modifier] = timeStr.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (hours === 12) hours = 0;
      if (modifier === 'PM') hours += 12;
      return hours * 60 + minutes;
    };

    const sleepStart = parse12h(NAVIRDecision.window.sleepTime);
    const sleepEnd = parse12h(NAVIRDecision.window.wakeTime);
    const totalDay = 24 * 60;

    let workStart = 480;
    let workEnd = 960;
    if (NAVIRDecision.shift?.start && NAVIRDecision.shift?.end) {
      const [sh, sm] = NAVIRDecision.shift.start.split(':').map(Number);
      const [eh, em] = NAVIRDecision.shift.end.split(':').map(Number);
      workStart = sh * 60 + sm;
      workEnd = eh * 60 + em;
    }

    const transitionBefore = Math.max(0, workStart - sleepEnd);
    const transitionAfter = Math.max(0, sleepStart - workEnd);
    const transitionTotal = transitionBefore + transitionAfter;
    const freeTime = Math.max(0, totalDay - (NAVIRDecision.window.hours * 60) - (workEnd - workStart) - transitionTotal);

    return {
      sleep: NAVIRDecision.window.hours * 60,
      work: workEnd - workStart,
      transition: transitionTotal,
      free: freeTime,
      total: totalDay,
    };
  }, [NAVIRDecision]);

  const handleScanSchedule = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se necesita acceso a la galería para escanear el horario.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setIsScanning(true);
      try {
        if (!session) {
          Alert.alert('Error de Autenticación', 'Debes iniciar sesión para sincronizar turnos.');
          return;
        }
        const formData = new FormData();
        formData.append('file', {
          uri: result.assets[0].uri,
          name: 'schedule.jpg',
          type: 'image/jpeg',
        } as any);
        formData.append('user_name', userProfile?.name || 'Samid');

        const response = await apiFetch('/api/v1/shifts/upload-image', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json().catch(() => ({}));
        const detectedShifts = Array.isArray(data.shifts) ? data.shifts : [];

        if (response.ok && detectedShifts.length > 0) {
          setWorkShifts(detectedShifts);
          useAppStore.getState().markDataDirty('schedule');
          Alert.alert('Escaneo completado', `${detectedShifts.length} turnos detectados y sincronizados.${data.notes ? ` ${data.notes}` : ''}`);
        } else {
          openManualFallback(data.notes || 'No pude leer turnos suficientes. Completa el horario manualmente.');
        }
      } catch (error: any) {
        openManualFallback(error.message || 'No se pudo procesar el horario. Te dejo el formulario manual listo.');
      } finally {
        setIsScanning(false);
      }
    }
  };

  const handleWakeTimeSubmit = () => {
    const match = wakeInput.match(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/);
    if (match) {
      setTargetWakeTime(wakeInput);
      useAppStore.getState().markDataDirty('schedule');
    } else {
      Alert.alert('Formato inválido', 'Usa formato 24h ej: 06:00');
      setWakeInput(targetWakeTime);
    }
  };

  const handleAddManualShift = async () => {
    if (!selectedDay || !startTime || !endTime) {
      Alert.alert('Campos incompletos', 'Selecciona día, hora de inicio y hora de fin.');
      return;
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      Alert.alert('Formato inválido', 'Usa formato 24h ej: 08:00');
      return;
    }

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (endMinutes <= startMinutes) {
      Alert.alert('Error de validación', 'La hora de fin debe ser mayor que la hora de inicio.');
      return;
    }

    setIsSubmitting(true);
    try {
      const isEditing = !!editingShift;
      const endpoint = isEditing ? `/api/v1/shifts/${editingShift.id}` : '/api/v1/shifts';
      const method = isEditing ? apiPut : apiPost;
      const res = await method(endpoint, {
        day: selectedDay,
        start: startTime,
        end: endTime,
      });

      if (res.ok) {
        if (isEditing) {
          const updatedShifts = workShifts.map((s) =>
            s.id === editingShift.id ? { ...s, day: selectedDay, start: startTime, end: endTime } : s
          );
          setWorkShifts(updatedShifts);
          useAppStore.getState().markDataDirty('schedule');
          Alert.alert('Turno actualizado', `Turno de ${selectedDay} modificado exitosamente.`);
        } else {
          useAppStore.getState().markDataDirty('schedule');
          Alert.alert('Turno añadido', `Turno para ${selectedDay} registrado exitosamente.`);
        }
        cancelEditing();
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Error', err.detail || (isEditing ? 'No se pudo actualizar el turno.' : 'No se pudo registrar el turno.'));
      }
    } catch (e: any) {
      Alert.alert('Error de conexión', e.message || 'No se pudo conectar con el servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (shift: WorkShift) => {
    setEditingShift(shift);
    setSelectedDay(shift.day);
    setStartTime(shift.start);
    setEndTime(shift.end);
    setShowManualForm(true);
  };

  const cancelEditing = () => {
    setEditingShift(null);
    setSelectedDay('');
    setStartTime('');
    setEndTime('');
    setShowManualForm(false);
  };

  const confirmDelete = (shift: WorkShift) => {
    Alert.alert(
      'Eliminar turno',
      `¿Eliminar el turno de ${shift.day} (${shift.start} - ${shift.end})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => handleDelete(shift.id),
        },
      ]
    );
  };

  const handleDelete = async (shiftId: string) => {
    try {
      const res = await apiDelete(`/api/v1/shifts/${shiftId}`);
      if (res.ok) {
        setWorkShifts(workShifts.filter((s) => s.id !== shiftId));
        useAppStore.getState().markDataDirty('schedule');
      } else {
        Alert.alert('Error', 'No se pudo eliminar el turno.');
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo eliminar el turno.');
    }
  };

  const openManualFallback = useCallback((message?: string) => {
    const todayName = new Date().toLocaleDateString('es-CO', { weekday: 'long' });
    setSelectedDay(todayName.charAt(0).toUpperCase() + todayName.slice(1));
    setStartTime('08:00');
    setEndTime('17:00');
    setEditingShift(null);
    setShowManualForm(true);
    if (message) {
      Alert.alert('Escaneo incompleto', message);
    }
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="HORARIO" />
      <View style={styles.header}>
        <Text style={styles.title}>Chronos</Text>
        <Text style={styles.subtitle}>Motor de Planificación Circadiana</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ScheduleWeekCalendar
          workShifts={workShifts}
          selectedWeekDay={selectedWeekDay}
          onSelectDay={setSelectedWeekDay}
          onClearSelection={() => setSelectedWeekDay(null)}
        />

        <SchedulePlannerPanel
          workShifts={workShifts}
          isScanning={isScanning}
          showManualForm={showManualForm}
          editingShift={editingShift}
          selectedDay={selectedDay}
          startTime={startTime}
          endTime={endTime}
          isSubmitting={isSubmitting}
          wakeInput={wakeInput}
          commuteInput={commuteInput}
          dailyBlocks={dailyBlocks}
          timeBar={timeBar}
          navirDecision={NAVIRDecision}
          days={['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']}
          dayShort={['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']}
          onScanSchedule={handleScanSchedule}
          onToggleManualForm={() => setShowManualForm(!showManualForm)}
          onCancelEditing={cancelEditing}
          onSelectedDayChange={setSelectedDay}
          onStartTimeChange={setStartTime}
          onEndTimeChange={setEndTime}
          onSubmitManualShift={handleAddManualShift}
          onWakeInputChange={setWakeInput}
          onWakeSubmit={handleWakeTimeSubmit}
          onCommuteInputChange={setCommuteInput}
          onCommuteSubmit={() => {
            const parsed = Number(commuteInput);
            if (Number.isFinite(parsed)) {
              setCommuteMinutes(parsed);
            } else {
              setCommuteInput(String(commuteMinutes || 35));
            }
          }}
          onEditShift={startEditing}
          onDeleteShift={confirmDelete}
        />

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const checkOverlap = (window: SleepWindow, shifts: WorkShift[]) => {
  const parse12h = (timeStr: string) => {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (hours === 12) hours = 0;
    if (modifier === 'PM') hours += 12;
    return hours * 60 + minutes;
  };

  const sleepMins = parse12h(window.sleepTime);

  for (const shift of shifts) {
    if (!shift.end) continue;
    const [endH, endM] = shift.end.split(':').map(Number);
    const endMins = endH * 60 + endM;
    if (endMins > sleepMins && endMins - sleepMins < 400) {
      return true;
    }
  }
  return false;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  header: {
    padding: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  title: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.xxl,
    color: Colors.text.primary,
  },
  subtitle: {
    fontFamily: FontFamily.techRegular,
    fontSize: FontSize.sm,
    color: Colors.accent.cyan,
    marginTop: 2,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: 100,
  },
});

export default ScheduleScreen;



