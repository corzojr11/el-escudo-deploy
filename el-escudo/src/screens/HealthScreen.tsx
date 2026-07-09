import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiGet, apiPut } from '../api/requests';

import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { useAppStore } from '../store';

import RestTimer from '../components/health/RestTimer';
import HealthTemplePanel from '../components/health/HealthTemplePanel';
import HealthFocusPanel from '../components/health/HealthFocusPanel';
import WeightChart from '../components/health/WeightChart';
import { ScreenHeader } from '../components/ScreenHeader';

type HealthTab = 'TEMPLO' | 'EVOLUCION' | 'ENFOQUE';
const FOCUS_KEY = 'escudo_focus_mode_v1';

const HealthScreen: React.FC = () => {
  const { logExercise } = useAppStore();
  const [activeTab, setActiveTab] = useState<HealthTab>('TEMPLO');

  const [focusStreak, setFocusStreak] = useState(0);
  const [focusBest, setFocusBest] = useState(0);
  const [lastCheckDate, setLastCheckDate] = useState<string | null>(null);
  const [urgeCount, setUrgeCount] = useState(0);
  const [isUrgencyActive, setIsUrgencyActive] = useState(false);
  const [urgencySeconds, setUrgencySeconds] = useState(90);
  const [quickLogVisible, setQuickLogVisible] = useState(false);
  const [quickExerciseName, setQuickExerciseName] = useState('Sentadilla');
  const [quickWeight, setQuickWeight] = useState('0');
  const [quickReps, setQuickReps] = useState('0');
  const [quickSets, setQuickSets] = useState('0');
  const [quickRpe, setQuickRpe] = useState('8');
  const [equipmentModalVisible, setEquipmentModalVisible] = useState(false);
  const [equipmentDraft, setEquipmentDraft] = useState('');


  useEffect(() => {
    const loadFocus = async () => {
      try {
        const raw = await AsyncStorage.getItem(FOCUS_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        setFocusStreak(Number(data.focusStreak || 0));
        setFocusBest(Number(data.focusBest || 0));
        setLastCheckDate(data.lastCheckDate || null);
        setUrgeCount(Number(data.urgeCount || 0));
      } catch {}
    };
    loadFocus();
  }, []);

  useEffect(() => {
    const loadFocusFromCloud = async () => {
      try {
        const res = await apiGet('/api/v1/focus/status');
        if (!res.ok) return;
        const data = await res.json();
        const focus = data?.focus_status;
        if (!focus) return;
        setFocusStreak(Number(focus.focus_streak || 0));
        setFocusBest(Number(focus.focus_best || 0));
        setLastCheckDate(focus.last_check_date || null);
        setUrgeCount(Number(focus.urge_count || 0));
      } catch {}
    };
    loadFocusFromCloud();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(
      FOCUS_KEY,
      JSON.stringify({ focusStreak, focusBest, lastCheckDate, urgeCount })
    ).catch(() => {});
  }, [focusStreak, focusBest, lastCheckDate, urgeCount]);


  useEffect(() => {
    const syncFocusToCloud = async () => {
      try {
        await apiPut('/api/v1/focus/status', {
          focus_streak: focusStreak,
          focus_best: focusBest,
          urge_count: urgeCount,
          last_check_date: lastCheckDate,
        });
      } catch {}
    };

    syncFocusToCloud();
  }, [focusStreak, focusBest, urgeCount, lastCheckDate]);

  useEffect(() => {
    if (!isUrgencyActive || urgencySeconds <= 0) return;
    const timer = setInterval(() => setUrgencySeconds((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [isUrgencyActive, urgencySeconds]);

  const markFocusDay = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (lastCheckDate === todayStr) return;
    const nextStreak = focusStreak + 1;
    setFocusStreak(nextStreak);
    if (nextStreak > focusBest) setFocusBest(nextStreak);
    setLastCheckDate(todayStr);
    useAppStore.getState().markDataDirty('health');
  };

  const registerSlip = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    setFocusStreak(0);
    setLastCheckDate(todayStr);
    useAppStore.getState().markDataDirty('health');
  };

  const startUrgency = () => {
    setUrgeCount((v) => v + 1);
    setUrgencySeconds(90);
    setIsUrgencyActive(true);
    useAppStore.getState().markDataDirty('health');
  };

  const stopUrgency = () => {
    setIsUrgencyActive(false);
    setUrgencySeconds(90);
  };

  const handleQuickLog = async () => {
    const exercise_name = quickExerciseName.trim();
    const weight = Number(quickWeight);
    const reps = Number(quickReps);
    const sets = Number(quickSets);
    const rpe = Number(quickRpe);

    if (!exercise_name) return;

    await logExercise({
      exercise_name,
      weight: Number.isFinite(weight) ? weight : 0,
      reps: Number.isFinite(reps) ? reps : 0,
      sets: Number.isFinite(sets) ? sets : 0,
      rpe: Number.isFinite(rpe) ? rpe : 8,
      extracted_data: {
        exercise_name,
        weight: Number.isFinite(weight) ? weight : 0,
        reps: Number.isFinite(reps) ? reps : 0,
        sets: Number.isFinite(sets) ? sets : 0,
        rpe: Number.isFinite(rpe) ? rpe : 8,
      },
    });

    setQuickLogVisible(false);
    setQuickExerciseName('Sentadilla');
    setQuickWeight('0');
    setQuickReps('0');
    setQuickSets('0');
    setQuickRpe('8');
  };

  const saveEquipmentInventory = () => {
    const parsed = equipmentDraft
      .split(/[\n,;]/g)
      .map((item) => item.trim())
      .filter(Boolean);
    useAppStore.getState().setEquipmentInventory(parsed);
    setEquipmentModalVisible(false);
  };

  return (
    <View style={styles.canvas}>
      <SafeAreaView style={styles.shell} edges={['top']}>
        <ScreenHeader title="SALUD" />

        <View style={styles.header}>
          <Text style={styles.headerTitle}>EL TEMPLO</Text>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>BIOMETRIA ACTIVA</Text>
          </View>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tab, activeTab === 'TEMPLO' && styles.tabActive]} onPress={() => setActiveTab('TEMPLO')}>
            <Text style={[styles.tabText, activeTab === 'TEMPLO' && styles.tabTextActive]}>LOGS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'EVOLUCION' && styles.tabActive]} onPress={() => setActiveTab('EVOLUCION')}>
            <Text style={[styles.tabText, activeTab === 'EVOLUCION' && styles.tabTextActive]}>EVOLUCION</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'ENFOQUE' && styles.tabActive]} onPress={() => setActiveTab('ENFOQUE')}>
            <Text style={[styles.tabText, activeTab === 'ENFOQUE' && styles.tabTextActive]}>ENFOQUE</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {activeTab === 'TEMPLO' ? (
            <HealthTemplePanel onEditEquipment={() => setEquipmentModalVisible(true)} onOpenQuickLog={() => setQuickLogVisible(true)} />
          ) : activeTab === 'EVOLUCION' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>EVOLUCION DE PESO CORPORAL</Text>
              <WeightChart />
            </View>
          ) : (
            <HealthFocusPanel
              focusStreak={focusStreak}
              focusBest={focusBest}
              urgeCount={urgeCount}
              isUrgencyActive={isUrgencyActive}
              urgencySeconds={urgencySeconds}
              onStartUrgency={startUrgency}
              onStopUrgency={stopUrgency}
              onMarkFocusDay={markFocusDay}
              onRegisterSlip={registerSlip}
            />
          )}
        </ScrollView>

        <Modal visible={equipmentModalVisible} transparent animationType="fade" onRequestClose={() => setEquipmentModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Equipo disponible</Text>
                <TouchableOpacity onPress={() => setEquipmentModalVisible(false)}>
                  <Ionicons name="close" size={22} color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalHint}>
                Escribe o pega una lista por lineas, comas o punto y coma. NAVIR usara esto para proponer rutinas y variantes compatibles.
              </Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextarea]}
                placeholder={"Mancuernas convertibles\nBarra conectora\nPeso ruso"}
                placeholderTextColor={Colors.text.muted}
                multiline
                value={equipmentDraft}
                onChangeText={setEquipmentDraft}
                textAlignVertical="top"
              />
              <TouchableOpacity style={styles.modalAction} onPress={saveEquipmentInventory}>
                <Text style={styles.modalActionText}>GUARDAR EQUIPO</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={quickLogVisible} transparent animationType="fade" onRequestClose={() => setQuickLogVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Log rápido</Text>
                <TouchableOpacity onPress={() => setQuickLogVisible(false)}>
                  <Ionicons name="close" size={22} color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalHint}>Registra un ejercicio al vuelo. Si estás sin red, igual se guarda localmente.</Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Ejercicio"
                placeholderTextColor={Colors.text.muted}
                value={quickExerciseName}
                onChangeText={setQuickExerciseName}
              />
              <View style={styles.modalRow}>
                <TextInput
                  style={[styles.modalInput, styles.modalInputHalf]}
                  placeholder="Peso"
                  placeholderTextColor={Colors.text.muted}
                  keyboardType="numeric"
                  value={quickWeight}
                  onChangeText={setQuickWeight}
                />
                <TextInput
                  style={[styles.modalInput, styles.modalInputHalf]}
                  placeholder="Reps"
                  placeholderTextColor={Colors.text.muted}
                  keyboardType="number-pad"
                  value={quickReps}
                  onChangeText={setQuickReps}
                />
              </View>
              <View style={styles.modalRow}>
                <TextInput
                  style={[styles.modalInput, styles.modalInputHalf]}
                  placeholder="Series"
                  placeholderTextColor={Colors.text.muted}
                  keyboardType="number-pad"
                  value={quickSets}
                  onChangeText={setQuickSets}
                />
                <TextInput
                  style={[styles.modalInput, styles.modalInputHalf]}
                  placeholder="RPE"
                  placeholderTextColor={Colors.text.muted}
                  keyboardType="number-pad"
                  value={quickRpe}
                  onChangeText={setQuickRpe}
                />
              </View>

              <TouchableOpacity style={styles.modalAction} onPress={handleQuickLog}>
                <Text style={styles.modalActionText}>Guardar entrenamiento</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: '#09090B' },
  shell: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  header: {
    padding: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.tech,
    fontSize: 24,
    color: '#FFF',
    letterSpacing: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.3)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: BorderRadius.xxs,
    backgroundColor: Colors.accent.cyan,
    marginRight: 6,
  },
  statusText: {
    color: Colors.accent.cyan,
    fontSize: 9,
    fontFamily: FontFamily.mono,
    letterSpacing: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: 15,
  },
  tab: {
    paddingBottom: 5,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.accent.cyan,
  },
  tabText: {
    fontFamily: FontFamily.mono,
    fontSize: 12,
    color: Colors.text.muted,
  },
  tabTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
  section: {
    marginTop: Spacing.md,
  },
  sectionTitle: {
    fontFamily: FontFamily.mono,
    fontSize: 12,
    color: Colors.text.muted,
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.bg.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border.default,
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  modalTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: 18,
    color: Colors.text.primary,
  },
  modalHint: {
    fontFamily: FontFamily.mono,
    color: Colors.text.muted,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: Spacing.md,
  },
  modalInput: {
    backgroundColor: Colors.bg.input,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: Colors.text.primary,
    fontFamily: FontFamily.techSemi,
    marginBottom: Spacing.sm,
  },
  modalTextarea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  modalRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalInputHalf: {
    flex: 1,
  },
  modalAction: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.accent.green,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalActionText: {
    fontFamily: FontFamily.tech,
    color: Colors.bg.primary,
    fontSize: 14,
  },
});

export default HealthScreen;



