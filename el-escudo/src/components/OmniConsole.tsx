import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Animated,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { BorderRadius, Spacing } from '../theme/spacing';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';

import GreetingCard from './GreetingCard';
import ShiftRadar from './ShiftRadar';

// ─── NAVIRConsole (Unified Dashboard + Console) ────────────────────────────────

/**
 * Props for the NAVIRConsole component.
 */
interface NAVIRConsoleProps {
  /** Whether to show the full console view on mount (default: `false`). */
  showFullConsole?: boolean;
}

/**
 * NAVIRConsole — Unified dashboard and AI command console.
 *
 * Serves as the main interaction hub for the application, combining:
 * - A greeting card with user context
 * - Shift status radar
 * - AI command input with chat-like message history
 * - Quick action chips for common operations
 * - Pending action confirmation flow
 * - Sleep inertia alerts
 *
 * Connects to the Zustand store for global state and uses `processCommandWithAI`
 * to send natural language commands to the backend.
 *
 * @component
 * @param {NAVIRConsoleProps} props - Component props
 * @param {boolean} [props.showFullConsole=false] - Whether to expand the console on mount
 * @example
 * ```tsx
 * <NAVIRConsole showFullConsole={false} />
 * ```
 */
const NAVIRConsole: React.FC<NAVIRConsoleProps> = ({ showFullConsole = false }) => {
  const isWeb = Platform.OS === 'web';
  const [input, setInput] = useState('');
  const [consoleVisible, setConsoleVisible] = useState(showFullConsole);
  const scrollRef = useRef<ScrollView>(null);

  const slideAnim = useRef(new Animated.Value(500)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // HUD Toast
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(20)).current;
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const lastLogCount = useRef(0);

  // Zustand
  const {
    userProfile,
    health,
    projects,
    logs,
    isProcessing,
    pendingAction,
    sessionAICost,
    brainFog,
    workShifts,
    targetWakeTime,
    targetSleepTime,
    mealPlan,
    commuteMinutes,
    calculateSleepCycles,
    setBrainFog,
    recordWakeUp,
  } = useAppStore(
    useShallow((state) => ({
      userProfile: state.userProfile,
      health: state.health,
      projects: state.projects,
      logs: state.logs,
      isProcessing: state.isProcessing,
      pendingAction: state.pendingAction,
      sessionAICost: state.sessionAICost,
      brainFog: state.brainFog,
      workShifts: state.workShifts,
      targetWakeTime: state.targetWakeTime,
      targetSleepTime: state.targetSleepTime,
      mealPlan: state.mealPlan,
      commuteMinutes: state.commuteMinutes,
      calculateSleepCycles: state.calculateSleepCycles,
      setBrainFog: state.setBrainFog,
      recordWakeUp: state.recordWakeUp,
    }))
  );

  // Inertia alert
  const [showInertiaAlert, setShowInertiaAlert] = useState(false);

  useEffect(() => {
    if (targetWakeTime) {
      const [h, m] = targetWakeTime.split(':').map(Number);
      const wakeMin = h * 60 + m;
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      const diff = nowMin - wakeMin;
      if (diff >= 0 && diff <= 30) {
        setShowInertiaAlert(true);
        recordWakeUp();
        const timer = setTimeout(() => setShowInertiaAlert(false), 8000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const processCommandWithAI = useAppStore(state => state.processCommandWithAI);
  const confirmPendingAction = useAppStore(state => state.confirmPendingAction);
  const cancelPendingAction = useAppStore(state => state.cancelPendingAction);
  const forceResetProcessing = useAppStore(state => state.forceResetProcessing);

  // Force-reset timer
  const [showForceReset, setShowForceReset] = useState(false);
  const processingStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (isProcessing) {
      processingStartRef.current = Date.now();
      setShowForceReset(false);
      const timer = setTimeout(() => setShowForceReset(true), 10000);
      return () => clearTimeout(timer);
    } else {
      processingStartRef.current = null;
      setShowForceReset(false);
    }
  }, [isProcessing]);

  useEffect(() => {
    if (consoleVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web' }),
        Animated.spring(slideAnim, { toValue: 0, tension: 70, friction: 12, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(slideAnim, { toValue: 500, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    }
  }, [consoleVisible]);

  useEffect(() => {
    if (scrollRef.current) {
      const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      return () => clearTimeout(timer);
    }
  }, [logs, isProcessing]);

  // HUD Toast: detect new system/assistant logs
  useEffect(() => {
    if (logs.length <= lastLogCount.current) return;
    const latestLog = logs[0];
    if (latestLog && (latestLog.category === 'SISTEMA' || latestLog.category === 'LOGISTICA')) {
      setToastMessage(latestLog.text);
      setToastVisible(true);
      Animated.parallel([
        Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(toastTranslateY, { toValue: 0, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(toastOpacity, { toValue: 0, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(toastTranslateY, { toValue: 20, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
        ]).start(() => setToastVisible(false));
      }, 5000);
    }
    lastLogCount.current = logs.length;
  }, [logs]);



  const dailyActionPlan = useMemo(() => {
    const now = new Date();
    const todayIndex = now.getDay();
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const todayName = dayNames[todayIndex];
    const shiftToday = workShifts.find((shift) => shift.day === todayName) || null;
    const routineDay = health.routine?.[todayIndex];
    const mealLunch = mealPlan.find((meal) => meal.type === 'Almuerzo') || mealPlan[0] || null;
    const mealDinner = mealPlan.find((meal) => meal.type === 'Cena') || null;

    const formatMinutesTo24h = (minutes: number) => {
      const total = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
      const hours = Math.floor(total / 60);
      const mins = total % 60;
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };
    const parseTimeToMinutes = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
      return hours * 60 + minutes;
    };
    const addMinutes = (time: string, minutes: number) => {
      const base = parseTimeToMinutes(time);
      return base === null ? null : formatMinutesTo24h(base + minutes);
    };

    const nextShift = (() => {
      for (let offset = 0; offset < 7; offset += 1) {
        const index = (todayIndex + offset) % 7;
        const name = dayNames[index];
        const found = workShifts.find((shift) => shift.day === name);
        if (found) return { shift: found, dayName: name };
      }
      return null;
    })();

    const commute = Math.max(0, Math.round(commuteMinutes || 35));
    const arrivalHome = shiftToday ? addMinutes(shiftToday.end, commute) : null;
    const focusStart = arrivalHome ? addMinutes(arrivalHome, 45) : null;
    const focusEnd = focusStart ? addMinutes(focusStart, 90) : null;
    const lunchTime = mealLunch?.time || (arrivalHome ? addMinutes(arrivalHome, 25) || '13:30' : '13:00');
    const dinnerTime = mealDinner?.time || '19:30';

    const nextShiftWake = nextShift?.shift?.start
      ? (() => {
          const base = parseTimeToMinutes(nextShift.shift.start);
          return base === null ? null : formatMinutesTo24h(base - commute - 45);
        })()
      : null;
    const sleepWindow = nextShiftWake ? calculateSleepCycles(nextShiftWake)[0] : null;

    const planLines = [
      `Plan de hoy:`,
      shiftToday ? `• Turno: ${shiftToday.day} ${shiftToday.start} - ${shiftToday.end}.` : '• Hoy no hay turno registrado.',
      shiftToday && arrivalHome ? `• Llegada estimada a casa: ${arrivalHome} (traslado ${commute} min).` : `• Traslado base: ${commute} min.`,
      `• Almuerzo: ${mealLunch ? `${mealLunch.name} a las ${lunchTime}` : `después de llegar, a las ${lunchTime}`}.`,
      focusStart && focusEnd ? `• Bloque de concentración: ${focusStart} - ${focusEnd} para apps, estudio o avances pesados.` : '• Bloque de concentración: reserva 90 min sin interrupciones.',
      routineDay ? `• Entreno: ${routineDay.name}.` : '• Entreno: día de recuperación o descanso.',
      `• Cena: ${dinnerTime}.`,
      sleepWindow
        ? `• Sueño: para el próximo turno ${nextShift ? `${nextShift.dayName} ${nextShift.shift.start}` : ''}, duerme ${sleepWindow.sleepTime} para completar ${sleepWindow.cycles} ciclos y despertar ${sleepWindow.wakeTime}.`
        : `• Sueño: respeta tu hora objetivo ${targetSleepTime}.`,
    ];

    return planLines.join('\n');
  }, [calculateSleepCycles, commuteMinutes, health.routine, mealPlan, targetSleepTime, workShifts]);

  const nextMilestone = useMemo(() => {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Mi�rcoles', 'Jueves', 'Viernes', 'S�bado'];

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

    const nextShift = (() => {
      for (let offset = 0; offset < 7; offset += 1) {
        const index = (now.getDay() + offset) % 7;
        const dayName = dayNames[index];
        const shift = workShifts.find((entry) => entry.day === dayName);
        if (shift) return { shift, dayName };
      }
      return null;
    })();

    const commute = Math.max(0, Math.round(commuteMinutes || 35));

    if (nextShift?.shift?.start) {
      const shiftStart = parseTimeToMinutes(nextShift.shift.start);
      if (shiftStart !== null) {
        const wakeTarget = formatMinutesTo24h(shiftStart - commute - 45);
        const windows = calculateSleepCycles(wakeTarget);
        const preferredWindow = windows.find((window) => window.recommended) || windows[0];

        if (preferredWindow) {
          return {
            label: 'LO SIGUIENTE',
            text: `${nextShift.dayName} ${nextShift.shift.start} -> dormir ${preferredWindow.sleepTime}`,
            sub: `Despertar ${preferredWindow.wakeTime} � ${preferredWindow.cycles} ciclos � traslado ${commute} min`,
            icon: 'moon' as const,
          };
        }
      }
    }

    if (targetWakeTime) {
      const windows = calculateSleepCycles(targetWakeTime);
      const preferredWindow = windows.find((window) => window.recommended) || windows[0];
      if (preferredWindow) {
        return {
          label: 'LO SIGUIENTE',
          text: `Despertar ${preferredWindow.wakeTime}`,
          sub: `Dormir ${preferredWindow.sleepTime} � ${preferredWindow.cycles} ciclos`,
          icon: 'alarm' as const,
        };
      }
    }

    if (targetSleepTime) {
      const [sh, sm] = targetSleepTime.split(':').map(Number);
      const sleepMin = sh * 60 + sm;
      const diff = sleepMin - nowMin;
      if (diff > 0) {
        const h = Math.floor(diff / 60);
        const m = diff % 60;
        return {
          label: 'LO SIGUIENTE',
          text: `Descanso en ${h}h ${m}m`,
          sub: 'Protege tu siguiente ciclo de sueno',
          icon: 'moon' as const,
        };
      }
    }

    return null;
  }, [calculateSleepCycles, commuteMinutes, targetSleepTime, targetWakeTime, workShifts]);

  const healthStatus = `${health.current}/${health.max}`;
  const tareasHoy = `${projects.tareasHoy.done}/${projects.tareasHoy.total}`;

  const alertBanner = useMemo(() => {
    if (brainFog <= 3) {
      return { text: `Neblina Mental ${brainFog}/10 detectada. Prioriza recuperación.`, severity: 'low' as const };
    }
    if (brainFog <= 6) {
      return { text: `Neblina Mental ${brainFog}/10. Reduce carga cognitiva.`, severity: 'mid' as const };
    }
    return { text: `Neblina Mental ${brainFog}/10 CRÍTICA. Activa protocolo de descanso.`, severity: 'high' as const };
  }, [brainFog]);

  const handleExecute = () => {
    if (!input.trim() || isProcessing) return;
    const textToProcess = input.trim();
    setInput('');
    processCommandWithAI(textToProcess);
  };

  const handleConsoleExecute = async () => {
    if (!input.trim() || isProcessing) return;
    await processCommandWithAI(input);
    setInput('');
  };

  // ─── Full Console Modal (Chat Style) ───────────────────────────────────────

  const chatLogs = useMemo(() => {
    return logs
      .filter((log) => log.category !== 'SISTEMA' && log.category !== 'LOGISTICA')
      .slice(0, 50)
      .reverse();
  }, [logs]);

  const hasRealMessages = chatLogs.length > 0;
  const displayName = userProfile?.name || 'Usuario';

  const quickGlanceCards = useMemo(() => {
    const current = new Date();
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const todayName = dayNames[current.getDay()];
    const todayShift = workShifts.find((shift) => shift.day === todayName) || null;
    const doneToday = projects?.tareasHoy?.done || 0;
    const totalToday = projects?.tareasHoy?.total || 0;
    const focusState = brainFog <= 3 ? "Muy clara" : brainFog <= 6 ? "Media" : "Baja";

    return [
      { label: "Turno", value: todayShift ? todayShift.start + " - " + todayShift.end : "Sin turno hoy", hint: todayShift ? todayShift.day : "Aún sin horario" },
      { label: "Sueño", value: targetSleepTime && targetWakeTime ? targetSleepTime + " · " + targetWakeTime : "Por definir", hint: commuteMinutes ? Math.round(commuteMinutes) + " min de traslado" : "Ajusta tu descanso" },
      { label: "Enfoque", value: focusState, hint: brainFog + "/10 de claridad" },
      { label: "Hoy", value: doneToday + "/" + totalToday + " tareas", hint: "Lo que ya avanzaste" },
    ];
  }, [brainFog, commuteMinutes, projects?.tareasHoy?.done, projects?.tareasHoy?.total, targetSleepTime, targetWakeTime, workShifts]);

  const actionPreviewLines = useMemo(() => dailyActionPlan.split("\n").slice(0, 4), [dailyActionPlan]);
  const recentActivity = useMemo(() => logs.filter((log) => log.category !== "NONE").slice(-3).reverse(), [logs]);
  const sleepCoachCard = useMemo(() => {
    const current = new Date();
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const todayName = dayNames[current.getDay()];
    const nextShift = workShifts.find((shift) => {
      const shiftDay = shift.day.toLowerCase();
      const todayIndex = current.getDay();
      const shiftIndex = dayNames.findIndex((day) => shiftDay.includes(day.toLowerCase()));
      return shiftIndex >= todayIndex;
    }) || workShifts[0] || null;

    const sleepWindows = calculateSleepCycles(targetWakeTime);
    const recommended = sleepWindows[0] || null;
    const commute = Math.max(0, Math.round(commuteMinutes || 35));
    const leadTime = commute + 45;

    return {
      title: recommended
        ? `${recommended.cycles} ciclos para despertar a las ${targetWakeTime}`
        : 'Ajusta tu sueño para mañana',
      body: nextShift
        ? `Con tu próximo turno a las ${nextShift.start}, deja al menos ${leadTime} min para traslado y bajada.`
        : `Si hoy no hay turno, protege la ventana ${targetSleepTime} - ${targetWakeTime}.`,
      chips: recommended
        ? [`Dormir ${recommended.sleepTime}`, `Despertar ${recommended.wakeTime}`, `Menos pantallas`]
        : [`Hora fija`, `Cena ligera`, `Alarma lista`],
    };
  }, [calculateSleepCycles, commuteMinutes, targetSleepTime, targetWakeTime, workShifts]);

  const renderConsoleModal = () => (
    <Modal visible={consoleVisible} transparent animationType="none" onRequestClose={() => setConsoleVisible(false)} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.consoleHeader}>
              <View style={styles.consoleHeaderLeft}>
                <View style={styles.headerIconSmall}>
                  <Ionicons name="flash" size={10} color="#000" />
                </View>
                <Text style={styles.consoleHeaderTitle}>NAVIR</Text>
                <Text style={styles.headerStatusSmall}>En línea</Text>
              </View>
              <TouchableOpacity onPress={() => setConsoleVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color={Colors.text.muted} />
              </TouchableOpacity>
            </View>
            <View style={styles.divider} />
            <ScrollView
              ref={scrollRef}
              style={styles.historyArea}
              contentContainerStyle={styles.historyContent}
              showsVerticalScrollIndicator={false}
            >
              {!hasRealMessages && (
                <>
                  <View style={styles.welcomeContainer}>
                    <Ionicons name="shield-checkmark" size={12} color={Colors.accent.green} />
                    <Text style={styles.welcomeTitle}>Navir listo</Text>
                  </View>
                  <Text style={styles.welcomeSubtitle}>{userProfile?.name ? `Hola, ${userProfile.name}.` : 'Bienvenido.'} ¿En qué te asisto?</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsRow}>
                    {[
                      { label: 'Registrar Gasto', icon: 'wallet', command: 'Registrar gasto' },
                      { label: 'Actualizar Peso', icon: 'barbell', command: 'Actualizar mi peso' },
                      { label: 'Nuevo Turno', icon: 'calendar', command: 'Agregar nuevo turno' },
                    ].map((action) => (
                      <TouchableOpacity
                        key={action.label}
                        style={styles.quickChip}
                        onPress={() => { processCommandWithAI(action.command); setInput(''); }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={action.icon as any} size={12} color={Colors.accent.green} />
                        <Text style={styles.quickChipText}>{action.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {chatLogs.map((log) => {
                const isUser = log.category === 'NONE' || log.category === 'USUARIO';
                return (
                  <View key={log.id} style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAI]}>
                    {!isUser && (
                      <View style={styles.aiAvatar}>
                        <Ionicons name="flash" size={8} color="#000" />
                      </View>
                    )}
                    <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
                      <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{log.text}</Text>
                      <Text style={[styles.bubbleTime, isUser && styles.bubbleTimeUser]}>
                        {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {isProcessing && (
                <View style={[styles.bubbleRow, styles.bubbleRowAI]}>
                  <View style={styles.aiAvatar}>
                    <Ionicons name="flash" size={8} color="#000" />
                  </View>
                  <View style={styles.typingBubble}>
                    <ActivityIndicator size="small" color={Colors.accent.green} />
                    <Text style={styles.typingText}>Pensando contigo...</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {pendingAction && 'summary' in pendingAction ? (
              <View style={styles.pendingContainer}>
                <Text style={styles.pendingLabel}>INTENCIÓN DETECTADA</Text>
                <Text style={styles.pendingSummary}>{pendingAction.summary}</Text>
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={cancelPendingAction}>
                    <Text style={styles.cancelText}>CANCELAR</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.confirmBtn]} onPress={confirmPendingAction} disabled={isProcessing}>
                    <Text style={styles.confirmText}>EJECUTAR</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.inputSection}>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.consoleInput}
                    placeholder="Escribe un comando..."
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    value={input}
                    onChangeText={setInput}
                    onSubmitEditing={handleConsoleExecute}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, (!input.trim() || isProcessing) && styles.sendBtnDisabled]}
                    onPress={handleConsoleExecute}
                    disabled={isProcessing || !input.trim()}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color={Colors.accent.green} />
                    ) : (
                      <Ionicons name="send" size={16} color={input.trim() ? '#000' : Colors.text.muted} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Gemini Flash-Lite · Telemetría Activa</Text>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );

  // ─── Dashboard View ───────────────────────────────────────────────────────

  return (
    <View style={[styles.canvas, isWeb && styles.canvasWeb]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <GreetingCard name={displayName} />

        <View style={styles.quickGlanceGrid}>
          {quickGlanceCards.map((card) => (
            <View key={card.label} style={styles.quickGlanceCard}>
              <Text style={styles.quickGlanceLabel}>{card.label}</Text>
              <Text style={styles.quickGlanceValue}>{card.value}</Text>
              <Text style={styles.quickGlanceHint}>{card.hint}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actionPreviewCard}>
          <View style={styles.actionPreviewHeader}>
            <Ionicons name="sparkles" size={14} color={Colors.accent.cyan} />
            <Text style={styles.actionPreviewTitle}>Lo más importante</Text>
          </View>
          {actionPreviewLines.map((line) => (
            <Text key={line} style={styles.actionPreviewLine}>{line.replace(/^•\s*/, "")}</Text>
          ))}
        </View>

        <View style={styles.sleepCoachCard}>
          <View style={styles.actionPreviewHeader}>
            <Ionicons name="moon" size={14} color={Colors.accent.indigo} />
            <Text style={styles.actionPreviewTitle}>Descanso de hoy</Text>
          </View>
          <Text style={styles.sleepCoachHeadline}>{sleepCoachCard.title}</Text>
          <Text style={styles.sleepCoachBody}>{sleepCoachCard.body}</Text>
          <View style={styles.sleepCoachChips}>
            {sleepCoachCard.chips.map((chip) => (
              <View key={chip} style={styles.sleepCoachChip}>
                <Text style={styles.sleepCoachChipText}>{chip}</Text>
              </View>
            ))}
          </View>
        </View>

        {recentActivity.length > 0 && (
          <View style={styles.recentActivityCard}>
            <View style={styles.actionPreviewHeader}>
              <Ionicons name="time" size={14} color={Colors.accent.green} />
              <Text style={styles.actionPreviewTitle}>Actividad reciente</Text>
            </View>
            {recentActivity.map((log) => (
              <View key={log.id} style={styles.recentRow}>
                <View style={styles.recentDot} />
                <View style={styles.recentTextWrap}>
                  <Text style={styles.recentText}>{log.text}</Text>
                  <Text style={styles.recentTime}>{log.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <ShiftRadar />

        {/* Inertia Alert */}
        {showInertiaAlert && (
          <View style={styles.inertiaAlert}>
            <Ionicons name="alarm" size={20} color="#FFD700" />
            <Text style={styles.inertiaText}>
              ✅ Ciclo completado. ¡No uses el botón de repetir alarma!
            </Text>
          </View>
        )}

        {/* Brain Fog Slider */}
        <View style={styles.brainFogCard}>
          <View style={styles.brainFogHeader}>
            <Ionicons name="hardware-chip-outline" size={14} color={Colors.accent.cyan} />
            <Text style={styles.brainFogTitle}>CLARIDAD MENTAL</Text>
            <Text style={[styles.brainFogValue, { color: brainFog >= 7 ? Colors.accent.red : brainFog >= 4 ? Colors.accent.gold : Colors.accent.green }]}>
              {brainFog}/10
            </Text>
          </View>
          <View style={styles.sliderRow}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
              <TouchableOpacity
                key={v}
                style={[
                  styles.sliderDot,
                  v <= brainFog && {
                    backgroundColor: v >= 7 ? Colors.accent.red : v >= 4 ? Colors.accent.gold : Colors.accent.green,
                  },
                ]}
                onPress={() => setBrainFog(v)}
                activeOpacity={0.6}
              />
            ))}
          </View>
          <Text style={styles.sliderLabels}>
            {brainFog <= 3 ? '🧠 Nítido' : brainFog <= 6 ? '😐 Moderado' : '🌫️ Crítico'}
          </Text>
        </View>

        <View style={styles.actionPlanCard}>
          <View style={styles.actionPlanHeader}>
            <Ionicons name="flash" size={16} color={Colors.accent.cyan} />
            <Text style={styles.actionPlanTitle}>Qué sigue</Text>
          </View>
          <Text style={styles.actionPlanText}>{dailyActionPlan}</Text>
        </View>

        {/* Próximo Hito */}
        {nextMilestone && (
          <View style={styles.milestoneCard}>
            <View style={styles.milestoneIconWrap}>
              <Ionicons name={nextMilestone.icon} size={18} color={Colors.accent.cyan} />
            </View>
            <View style={styles.milestoneContent}>
              <Text style={styles.milestoneLabel}>{nextMilestone.label}</Text>
              <Text style={styles.milestoneText}>{nextMilestone.text}</Text>
              <Text style={styles.milestoneSub}>{nextMilestone.sub}</Text>
            </View>
          </View>
        )}

        {/* Resumen de Potencial */}
        <View style={styles.potentialRow}>
          <View style={styles.potentialCard}>
            <Ionicons name="heart" size={14} color={Colors.accent.orange} />
            <Text style={styles.potentialLabel}>ESTADO FÍSICO</Text>
            <Text style={[styles.potentialValue, { color: Colors.accent.orange }]}>{healthStatus}</Text>
          </View>
          <View style={styles.potentialCard}>
            <Ionicons name="checkmark-done" size={14} color={Colors.accent.cyan} />
            <Text style={styles.potentialLabel}>TAREAS DE HOY</Text>
            <Text style={[styles.potentialValue, { color: Colors.accent.cyan }]}>{tareasHoy}</Text>
          </View>
        </View>

        {/* Alerta NAVIR */}
        <View style={[styles.alertBanner, alertBanner.severity === 'high' && styles.alertBannerHigh, alertBanner.severity === 'mid' && styles.alertBannerMid]}>
          <Ionicons name="shield" size={12} color={alertBanner.severity === 'high' ? Colors.accent.red : alertBanner.severity === 'mid' ? Colors.accent.gold : Colors.accent.green} />
          <Text style={[styles.alertText, alertBanner.severity === 'high' && styles.alertTextHigh, alertBanner.severity === 'mid' && styles.alertTextMid]}>
            NAVIR te avisa: {alertBanner.text}
          </Text>
        </View>

        <View style={{ height: 88 }} />
      </ScrollView>

      {/* HUD Toast Notification */}
      {toastVisible && (
        <Animated.View
          style={[
            styles.toastContainer,
            { opacity: toastOpacity, transform: [{ translateY: toastTranslateY }] },
          ]}
        >
          <View style={styles.toastBubble}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.accent.green} />
            <Text style={styles.toastText} numberOfLines={2}>{toastMessage}</Text>
          </View>
        </Animated.View>
      )}

      {/* Inline command input */}
      <View style={styles.inputContainer}>
        <View style={[styles.inputRow, isProcessing && styles.inputRowDisabled]}>
          <Text style={styles.prompt}>&gt;</Text>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={isProcessing ? 'Analizando comando...' : 'Escribe un comando...'}
            placeholderTextColor={Colors.text.muted}
            selectionColor={Colors.accent.green}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="send"
            onSubmitEditing={handleExecute}
            editable={!isProcessing}
          />
          {showForceReset ? (
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={() => { forceResetProcessing(); setInput(''); }}
              activeOpacity={0.7}
            >
              <Ionicons name="stop-circle" size={18} color={Colors.accent.red} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.execBtn}
              onPress={handleExecute}
              disabled={!input.trim() || isProcessing}
              activeOpacity={0.8}
            >
            {isProcessing ? (
              <ActivityIndicator size="small" color={Colors.accent.green} />
            ) : (
              <Ionicons
                name="flash"
                size={16}
                color={input.trim() ? Colors.accent.green : Colors.text.muted}
              />
            )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {renderConsoleModal()}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: Colors.bg.canvas,
  },
  canvasWeb: {
    alignItems: 'center' as any,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  inertiaAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  inertiaText: {
    flex: 1,
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.sm,
    color: '#FFD700',
  },
  brainFogCard: {
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  brainFogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  brainFogTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.xs,
    color: Colors.accent.cyan,
    letterSpacing: 1.5,
  },
  brainFogValue: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.sm,
    marginLeft: 'auto',
  },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  sliderDot: {
    width: 22,
    height: 6,
    borderRadius: BorderRadius.xxs,
    backgroundColor: Colors.border.subtle,
  },
  sliderLabels: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    textAlign: 'center',
  },
  actionPlanCard: {
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.accent.cyan + '40',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  actionPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  actionPlanTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.xs,
    color: Colors.accent.cyan,
    textTransform: 'uppercase',
  },
  actionPlanText: {
    fontFamily: FontFamily.techRegular,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  milestoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.accent.cyan + '30',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  milestoneIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneContent: { flex: 1 },
  milestoneLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.accent.cyan,
    letterSpacing: 1.5,
  },
  milestoneText: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
    marginTop: 2,
  },
  milestoneSub: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    marginTop: 1,
  },
  potentialRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  potentialCard: {
    flex: 1,
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  potentialLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.text.muted,
    letterSpacing: 1,
  },
  potentialValue: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginTop: 2,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
    borderWidth: 1,
    borderColor: Colors.accent.green + '25',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  alertBannerMid: {
    backgroundColor: 'rgba(255, 193, 7, 0.04)',
    borderColor: Colors.accent.gold + '30',
  },
  alertBannerHigh: {
    backgroundColor: 'rgba(255, 49, 49, 0.06)',
    borderColor: Colors.accent.red + '35',
  },
  alertText: {
    flex: 1,
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.accent.green,
    lineHeight: 16,
  },
  alertTextMid: {
    color: Colors.accent.gold,
  },
  alertTextHigh: {
    color: Colors.accent.red,
  },
  inputContainer: {
    padding: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    backgroundColor: Colors.bg.primary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bg.input,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  inputRowDisabled: {
    opacity: 0.7,
  },
  prompt: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.md,
    color: Colors.accent.green,
    fontWeight: '700',
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.mono,
    fontSize: FontSize.base,
    color: Colors.text.primary,
    padding: 0,
    margin: 0,
    height: Platform.OS === 'ios' ? 24 : 'auto',
  },
  execBtn: {
    padding: 4,
  },
  resetBtn: {
    padding: 4,
    backgroundColor: 'rgba(255, 49, 49, 0.1)',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  // HUD Toast
  toastContainer: {
    position: 'absolute',
    bottom: 72,
    left: Spacing.base,
    right: Spacing.base,
    zIndex: 10,
  },
  toastBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(10, 10, 11, 0.95)',
    borderWidth: 1,
    borderColor: Colors.accent.green + '60',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  toastText: {
    flex: 1,
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
  },

  // Console Modal
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  kav: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#09090B',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: '80%',
  },
  consoleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  consoleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accent.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consoleHeaderTitle: {
    fontFamily: FontFamily.techSemi,
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    letterSpacing: 1,
  },
  headerStatusSmall: {
    fontFamily: FontFamily.mono,
    color: Colors.accent.green,
    fontSize: 9,
    opacity: 0.6,
  },
  sessionTelemetry: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 157, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
  },
  telemetryLabel: {
    fontFamily: FontFamily.mono,
    color: 'rgba(0, 255, 157, 0.4)',
    fontSize: 9,
  },
  telemetryValue: {
    fontFamily: FontFamily.mono,
    color: Colors.accent.green,
    fontSize: 10,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: Spacing.md,
  },
  historyArea: {
    maxHeight: 300,
    marginBottom: Spacing.lg,
  },
  historyContent: {
    gap: 8,
  },

  // Welcome
  welcomeContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.base, paddingTop: Spacing.md, paddingBottom: Spacing.xs },
  welcomeTitle: { fontFamily: FontFamily.techSemi, fontSize: FontSize.sm, color: Colors.accent.green, letterSpacing: 1 },
  welcomeSubtitle: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.text.muted, paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },

  // Quick Actions
  quickActionsRow: { paddingHorizontal: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.md },
  quickChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0, 255, 157, 0.06)', borderWidth: 1, borderColor: Colors.accent.green + '25', borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  quickChipText: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.accent.green },

  // Chat Bubbles
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  bubbleRowUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  bubbleRowAI: { alignSelf: 'flex-start' },
  aiAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.accent.green, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bubble: { maxWidth: '78%', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, borderRadius: 14 },
  bubbleUser: { backgroundColor: '#1C1C1F', borderBottomRightRadius: BorderRadius.xs },
  bubbleAI: { backgroundColor: 'rgba(0, 255, 157, 0.04)', borderWidth: 1, borderColor: Colors.accent.green + '15', borderBottomLeftRadius: BorderRadius.xs },
  bubbleText: { fontFamily: FontFamily.techRegular, fontSize: FontSize.sm, color: Colors.text.primary, lineHeight: 18 },
  bubbleTextUser: { color: '#E5E5E7' },
  bubbleTime: { fontFamily: FontFamily.mono, fontSize: 8, color: Colors.text.muted, marginTop: 3, opacity: 0.5 },
  bubbleTimeUser: { textAlign: 'right' },

  // Typing
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0, 255, 157, 0.04)', borderWidth: 1, borderColor: Colors.accent.green + '15', borderRadius: 14, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm },
  typingText: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.accent.green, opacity: 0.6 },

  logEntry: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 10,
    borderRadius: BorderRadius.sm,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(0, 255, 157, 0.1)',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  logCategory: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    letterSpacing: 1,
  },
  logTime: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 9,
  },
  logText: {
    color: '#FFF',
    fontSize: 13,
    lineHeight: 18,
  },
  interactionCost: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: 'rgba(0, 255, 157, 0.3)',
    marginTop: 6,
  },
  processingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
  },
  processingText: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.accent.green,
    opacity: 0.5,
  },
  quickGlanceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  quickGlanceCard: { width: '48%' as any, backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.border.default, borderRadius: BorderRadius.lg, padding: Spacing.sm, gap: 3 },
  quickGlanceLabel: { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.text.muted, letterSpacing: 1.2 },
  quickGlanceValue: { fontFamily: FontFamily.techSemi, fontSize: FontSize.sm, color: Colors.text.primary },
  quickGlanceHint: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.secondary, lineHeight: 13 },
  actionPreviewCard: { backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.border.default, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 6 },
  actionPreviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionPreviewTitle: { fontFamily: FontFamily.techSemi, fontSize: FontSize.xs, color: Colors.text.primary, letterSpacing: 0.8 },
  actionPreviewLine: { fontFamily: FontFamily.techRegular, fontSize: FontSize.sm, color: Colors.text.primary, lineHeight: 19 },
  sleepCoachCard: { backgroundColor: 'rgba(124, 58, 237, 0.06)', borderWidth: 1, borderColor: 'rgba(124, 58, 237, 0.18)', borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 8 },
  sleepCoachHeadline: { fontFamily: FontFamily.techSemi, fontSize: FontSize.sm, color: Colors.text.primary },
  sleepCoachBody: { fontFamily: FontFamily.techRegular, fontSize: FontSize.sm, color: Colors.text.secondary, lineHeight: 19 },
  sleepCoachChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sleepCoachChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(124, 58, 237, 0.12)' },
  sleepCoachChipText: { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.accent.indigo, letterSpacing: 0.6 },
  recentActivityCard: { backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.accent.green + '20', borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 10 },
  recentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  recentDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, backgroundColor: Colors.accent.green },
  recentTextWrap: { flex: 1, gap: 2 },
  recentText: { fontFamily: FontFamily.techRegular, fontSize: FontSize.sm, color: Colors.text.primary, lineHeight: 19 },
  recentTime: { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.text.muted },

  inputSection: {
    width: '100%',
  },
  inputWrapper: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    paddingRight: 6,
    paddingVertical: 3,
  },
  consoleInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: Spacing.md,
    color: '#FFF',
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.border.subtle,
  },
  pendingContainer: {
    backgroundColor: 'rgba(0, 255, 157, 0.05)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 157, 0.2)',
    alignItems: 'center',
  },
  pendingLabel: {
    fontFamily: FontFamily.mono,
    color: Colors.accent.green,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 8,
  },
  pendingSummary: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    minWidth: 110,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  confirmBtn: {
    backgroundColor: Colors.accent.green,
  },
  cancelText: {
    color: Colors.text.muted,
    fontWeight: '700',
    fontFamily: FontFamily.mono,
    fontSize: 11,
  },
  confirmText: {
    color: '#000',
    fontWeight: '800',
    fontFamily: FontFamily.mono,
    fontSize: 11,
  },
  footer: {
    marginTop: 15,
    alignItems: 'center',
    opacity: 0.2,
  },
  footerText: {
    fontFamily: FontFamily.mono,
    fontSize: 8,
    color: Colors.text.muted,
  },
});

export default NAVIRConsole;





