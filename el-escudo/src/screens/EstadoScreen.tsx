import React, { useMemo, useState, useEffect, useCallback, useRef, useDeferredValue } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { BorderRadius, Spacing } from '../theme/spacing';
import { useAppStore, Task } from '../store';
import { XPFloatAnimation } from '../components/XPFloatAnimation';
import { XPProgressBar } from '../components/XPProgressBar';
import { LevelUpModal } from '../components/LevelUpModal';
import { MissionCompletedBadge } from '../components/MissionCompletedBadge';
import { StreakBadge } from '../components/StreakBadge';
import { ErrorState } from '../components/ErrorState';
import { AchievementUnlockedModal } from '../components/AchievementUnlockedModal';
import { WellnessScoreCard, InsightCard, OmniSuggestions } from '../components/dashboard';
import { ScreenHeader } from '../components/ScreenHeader';
import FinanceSection from '../components/dashboard/FinanceSection';
import ProjectsSection from '../components/dashboard/ProjectsSection';
import WeightSection from '../components/dashboard/WeightSection';

// EstadoScreen — Main dashboard and command center.
const EstadoScreen: React.FC = () => {
  const { userProfile, player, health, finances, projects, weightHistory, transactions, goals, hydrateStore, xpAnimation, levelUpNotification, missionCompleted, racha, achievementUnlocked, workShifts, targetSleepTime, targetWakeTime, commuteMinutes } = useAppStore();
  const navigation = useNavigation<any>();
  const netInfo = useNetInfo();
  const isConnected = netInfo.isConnected ?? false;
  const [refreshing, setRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const prevConnected = useRef(netInfo.isConnected);
  const deferredTransactions = useDeferredValue(transactions);
  const deferredProjects = useDeferredValue(projects);
  const deferredWeightHistory = useDeferredValue(weightHistory);
  const deferredGoals = useDeferredValue(goals);
  const deferredWorkShifts = useDeferredValue(workShifts);

  const shouldSyncDashboard = useCallback(() => {
    const state = useAppStore.getState();
    const lastSync = state._lastSyncTime;
    const dirty = state._dirtyDomains || [];
    const stale = !lastSync || Date.now() - lastSync > 3 * 60 * 1000;
    const relevantDirty = dirty.some((d) => ['omni', 'projects', 'goals', 'finances', 'health', 'schedule'].includes(d));
    return stale || relevantDirty;
  }, []);

  useEffect(() => {
    if (prevConnected.current === false && netInfo.isConnected === true) {
      const lastSync = useAppStore.getState()._lastSyncTime;
      const fiveMin = 5 * 60 * 1000;
      if (!lastSync || Date.now() - lastSync > fiveMin) {
        if (!isSyncing) {
          setIsSyncing(true);
          useAppStore.setState({ toast: { visible: true, message: 'Sincronizando datos...' } });
          hydrateStore(true).then(() => {
            useAppStore.setState({ toast: { visible: true, message: 'Datos actualizados' } });
            setTimeout(() => { useAppStore.setState({ toast: { visible: false, message: '' } }); }, 3000);
          }).finally(() => { setIsSyncing(false); });
        }
      }
    }
    prevConnected.current = netInfo.isConnected;
  }, [netInfo.isConnected, hydrateStore, isSyncing]);

  const loadDashboard = useCallback(async (showSpinner = false) => {
    try {
      setHasError(false);
      if (showSpinner) setRefreshing(true);
      await hydrateStore();
    } catch {
      setHasError(true);
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }, [hydrateStore]);

  const onRefresh = useCallback(async () => {
    await loadDashboard(true);
  }, [loadDashboard]);

  useFocusEffect(
    useCallback(() => {
      if (shouldSyncDashboard()) {
        void loadDashboard(false);
      }
      return () => {};
    }, [loadDashboard, shouldSyncDashboard])
  );

  const formatCOP = useCallback((val: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);
  }, []);

  const handlePressFinanzas = useCallback(() => {
    navigation.navigate('Finanzas');
  }, [navigation]);

  const handlePressProyectos = useCallback(() => {
    navigation.navigate('Inicio');
  }, [navigation]);

  const handlePressNutricion = useCallback(() => {
    navigation.navigate('Salud');
  }, [navigation]);

  const handlePressTurnos = useCallback(() => {
    navigation.navigate('Turnos');
  }, [navigation]);

  const resolveInsightRoute = useCallback((text: string) => {
    const value = text.toLowerCase();
    if (value.includes('gasto') || value.includes('presupuesto') || value.includes('saldo') || value.includes('finanza')) return 'Finanzas';
    if (value.includes('peso') || value.includes('rutina') || value.includes('ejercicio') || value.includes('gym')) return 'Salud';
    if (value.includes('turno') || value.includes('sueño') || value.includes('dorm') || value.includes('descanso')) return 'Turnos';
    return 'Inicio';
  }, []);

  const dashboardCore = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const todayLabel = now.toDateString();
    let monthlyExpenses = 0;
    let todayIncomeSum = 0;
    let todayExpenseSum = 0;
    const todayTxs: typeof deferredTransactions = [];

    deferredTransactions.forEach((t) => {
      const d = new Date(t.fecha);
      const isCurrentMonth = d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      const isToday = d.toDateString() === todayLabel;
      const isExpense = t.tipo === 'GASTO';

      if (isCurrentMonth && isExpense) {
        monthlyExpenses += t.monto;
      }
      if (isToday) {
        todayTxs.push(t);
        if (t.tipo === 'INGRESO') todayIncomeSum += t.monto;
        if (t.tipo === 'GASTO') todayExpenseSum += t.monto;
      }
    });

    const completedTasks = (deferredProjects.tasks || []).filter((t: Task) => t.completed);
    const xpToday = completedTasks.reduce((acc, t) => acc + t.xpReward, 0);
    const { done, total } = deferredProjects.tareasHoy || { done: 0, total: 0 };

    return {
      totalMonthlyExpenses: monthlyExpenses,
      todayTransactions: todayTxs,
      todayIncome: todayIncomeSum,
      todayExpenses: todayExpenseSum,
      xpEarnedToday: xpToday,
      todayTaskProgress: total > 0 ? done / total : 0,
    };
  }, [deferredProjects.tasks, deferredProjects.tareasHoy, deferredTransactions]);

  const { totalMonthlyExpenses, todayTransactions, todayIncome, todayExpenses, xpEarnedToday, todayTaskProgress } = dashboardCore;

  const wellnessScore = useMemo(() => {
    const taskScore = todayTaskProgress * 100;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const hasWeightThisWeek = deferredWeightHistory.some((w) => new Date(w.timestamp) >= weekAgo);
    const activityScore = hasWeightThisWeek ? 100 : 0;
    const streakDays = racha.days || 0;
    const streakScore = Math.min(100, (streakDays / 7) * 100);
    const monthlyBudget = 2000000;
    const budgetRatio = totalMonthlyExpenses > 0 ? Math.max(0, 1 - totalMonthlyExpenses / monthlyBudget) : 0.5;
    const financeScore = budgetRatio * 100;
    const score = taskScore * 0.30 + financeScore * 0.25 + streakScore * 0.25 + activityScore * 0.20;
    return Math.round(Math.min(100, Math.max(0, score)));
  }, [todayTaskProgress, deferredWeightHistory, racha.days, totalMonthlyExpenses]);

  const wellnessColor = useMemo(() => {
    if (wellnessScore < 40) return Colors.accent.red;
    if (wellnessScore < 70) return Colors.accent.orange;
    return Colors.accent.green;
  }, [wellnessScore]);

  const wellnessMetrics = useMemo(
    () => [
      { icon: 'checkmark-circle', label: 'Tareas', value: `${Math.round(todayTaskProgress * 100)}%` },
      { icon: 'flame', label: 'Racha', value: `${racha.days}d` },
      { icon: 'wallet', label: 'Gasto mes', value: formatCOP(totalMonthlyExpenses) },
      {
        icon: 'fitness',
        label: 'Peso',
        value: deferredWeightHistory.length > 0 ? `${Number(deferredWeightHistory[deferredWeightHistory.length - 1].weight).toFixed(1)}kg` : '—',
      },
    ],
    [deferredWeightHistory, formatCOP, racha.days, totalMonthlyExpenses, todayTaskProgress]
  );

  const weeklyInsight = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    if (racha.days >= 5) return { icon: 'flame' as const, text: `Racha sólida de ${racha.days} días. Mantén el ritmo.` };
    const monthlyBudget = 2000000;
    if (totalMonthlyExpenses > monthlyBudget * 0.8) return { icon: 'warning' as const, text: 'Alerta: gastos altos este mes. Revisa tu presupuesto.' };
    if (deferredWorkShifts.length === 0) return { icon: 'calendar-outline' as const, text: 'Registra tus turnos para optimizar el sueño.' };
    const thisWeekWeights = deferredWeightHistory.filter((w) => new Date(w.timestamp) >= weekAgo);
    const lastWeekWeights = deferredWeightHistory.filter((w) => { const d = new Date(w.timestamp); return d >= twoWeeksAgo && d < weekAgo; });
    if (thisWeekWeights.length > 0 && lastWeekWeights.length > 0) {
      const avgThisWeek = thisWeekWeights.reduce((sum, w) => sum + w.weight, 0) / thisWeekWeights.length;
      const avgLastWeek = lastWeekWeights.reduce((sum, w) => sum + w.weight, 0) / lastWeekWeights.length;
      const diff = avgThisWeek - avgLastWeek;
      if (diff > 1) return { icon: 'trending-up' as const, text: `Tu peso subió ${diff.toFixed(1)}kg vs semana pasada. Revisa nutrición.` };
      if (diff < -1) return { icon: 'trending-down' as const, text: `Tu peso bajó ${Math.abs(diff).toFixed(1)}kg. Buen progreso.` };
    }
    if (todayTaskProgress >= 0.8) return { icon: 'checkmark-circle' as const, text: 'Casi completas tus tareas hoy. ¡Último empujón!' };
    return { icon: 'bulb-outline' as const, text: 'Sigue registrando datos para recibir insights personalizados.' };
  }, [racha.days, totalMonthlyExpenses, deferredWorkShifts.length, deferredWeightHistory, todayTaskProgress]);

  const omniSuggestions = useMemo(() => {
    const suggestions: { icon: string; text: string; priority: number }[] = [];
    const now = new Date();
    const currentHour = now.getHours();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDay = tomorrow.toLocaleDateString('es-CO', { weekday: 'long' }).toLowerCase();
    const earlyShift = deferredWorkShifts.find((s) => { const shiftDay = s.day.toLowerCase(); const startHour = parseInt(s.start.split(':')[0], 10); return shiftDay.includes(tomorrowDay.split(',')[0]) && startHour < 8; });
    if (earlyShift && currentHour >= 22) suggestions.push({ icon: 'moon', text: 'Tienes turno temprano mañana. Es hora de dormir.', priority: 1 });
    if (racha.days >= 5) suggestions.push({ icon: 'flame', text: `Tu racha de ${racha.days} días está en riesgo. Completa un hábito.`, priority: 2 });
    const shiftsThisWeek = deferredWorkShifts;
    if (shiftsThisWeek.length === 0) suggestions.push({ icon: 'calendar-outline', text: 'Registra tus turnos para recibir recomendaciones de sueño.', priority: 3 });
    if (deferredWeightHistory.length > 0) {
      const sorted = [...deferredWeightHistory].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const lastWeightDate = new Date(sorted[0].timestamp);
      const daysSinceWeight = Math.floor((now.getTime() - lastWeightDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceWeight > 7) suggestions.push({ icon: 'scale-outline', text: `Hace ${daysSinceWeight} días que no registras peso.`, priority: 4 });
    }
    const monthlyBudget = 2000000;
    const daysLeftInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
    if (totalMonthlyExpenses > monthlyBudget * 0.9 && daysLeftInMonth < 5) suggestions.push({ icon: 'cash-outline', text: 'Alerta: presupuesto casi agotado.', priority: 5 });
    suggestions.sort((a, b) => a.priority - b.priority);
    return suggestions.slice(0, 3);
  }, [deferredWorkShifts, racha.days, deferredWeightHistory, totalMonthlyExpenses]);

  const homePulse = useMemo(() => {
    const nextShift = deferredWorkShifts[0] || null;
    const nextTurnLabel = nextShift ? `${nextShift.day} ${nextShift.start}` : 'sin turno cargado';
    const sleepWindow = targetSleepTime && targetWakeTime
      ? `${targetSleepTime} - ${targetWakeTime}`
      : 'por definir';
    return {
      headline: todayIncome > todayExpenses ? 'Hay más entrada que salida hoy' : 'Hoy conviene cuidar el gasto',
      body: nextShift
        ? `Tu siguiente referencia fuerte es ${nextTurnLabel}. Descanso sugerido: ${sleepWindow}. Traslado estimado: ${commuteMinutes || 35} min.`
        : `Descanso sugerido: ${sleepWindow}. Carga tus turnos para ordenar mejor el día.`,
      chips: [
        `Ingreso ${formatCOP(todayIncome)}`,
        `Gasto ${formatCOP(todayExpenses)}`,
        `Tareas ${deferredProjects.tareasHoy?.done || 0}/${deferredProjects.tareasHoy?.total || 0}`,
      ],
    };
  }, [commuteMinutes, deferredProjects.tareasHoy?.done, deferredProjects.tareasHoy?.total, deferredWorkShifts, formatCOP, targetSleepTime, targetWakeTime, todayExpenses, todayIncome]);

  if (hasError) return <ErrorState message="No se pudo cargar el dashboard." onRetry={() => loadDashboard(true)} />;

  const displayName = userProfile?.name || 'Usuario';
  const quickAccessCards = [
    { title: 'Finanzas', subtitle: 'Ingresos, gastos y balance.', icon: 'card-outline', color: Colors.accent.green, onPress: handlePressFinanzas },
    { title: 'Turnos', subtitle: 'Horario y descanso.', icon: 'time-outline', color: Colors.accent.indigo, onPress: handlePressTurnos },
    { title: 'Salud', subtitle: 'Gym, peso y racha.', icon: 'barbell-outline', color: Colors.accent.orange, onPress: handlePressNutricion },
    { title: 'OMNI', subtitle: 'Chat para editar todo.', icon: 'chatbubble-ellipses-outline', color: Colors.accent.cyan, onPress: handlePressProyectos },
  ];

  return (
    <SafeAreaView style={styles.shell} edges={['top']}>
      <XPFloatAnimation amount={xpAnimation.amount} visible={xpAnimation.visible} onComplete={() => {}} />
      {levelUpNotification.visible && <LevelUpModal visible={levelUpNotification.visible} newLevel={levelUpNotification.newLevel} newTitle={levelUpNotification.newTitle} onClose={() => useAppStore.setState({ levelUpNotification: { visible: false, newLevel: 0, newTitle: '' } })} />}
      {missionCompleted.visible && <MissionCompletedBadge missionName={missionCompleted.missionName} xpReward={missionCompleted.xpReward} visible={missionCompleted.visible} onClose={() => useAppStore.setState({ missionCompleted: { visible: false, missionName: '', xpReward: 0 } })} />}
      {achievementUnlocked.visible && <AchievementUnlockedModal name={achievementUnlocked.name} description={achievementUnlocked.description} visible={achievementUnlocked.visible} />}
      <ScreenHeader title="ESTADO" />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View accessible={true} accessibilityRole="header" accessibilityLabel="Dashboard, centro de mando"><Text style={styles.headerTitle}>TU PANEL</Text><Text style={styles.headerSubtitle}>Resumen de hoy</Text></View>
          <View style={styles.headerRight}><StreakBadge days={racha.days} />{refreshing && <ActivityIndicator size="small" color={Colors.accent.green} />}</View>
        </View>
        <XPProgressBar level={player.level} xpCurrent={player.xpCurrent} xpToNext={player.xpToNext} />
      </View>
      <View style={styles.networkPillWrapper}>
        <View style={[styles.networkPill, { backgroundColor: isConnected ? Colors.accent.green + '20' : Colors.accent.orange + '20' }]}>
          <Ionicons name={isConnected ? 'wifi' : 'wifi-off' as any} size={14} color={isConnected ? Colors.accent.green : Colors.accent.orange} />
          <Text style={[styles.networkPillText, { color: isConnected ? Colors.accent.green : Colors.accent.orange }]}>{isConnected ? 'EN LÍNEA' : 'SIN CONEXIÓN'}</Text>
        </View>
      </View>
      <WellnessScoreCard
        score={wellnessScore}
        color={wellnessColor}
        subtitle={wellnessScore >= 70 ? 'Excelente ritmo' : wellnessScore >= 40 ? 'Buen progreso' : 'Necesitas impulso'}
        metrics={wellnessMetrics}
        onPress={handlePressNutricion}
      />
      <TouchableOpacity activeOpacity={0.88} onPress={handlePressTurnos}>
        <View style={styles.homePulseCard}>
          <View style={styles.homePulseHeader}>
            <Ionicons name="flash" size={14} color={Colors.accent.cyan} />
            <Text style={styles.homePulseTitle}>Lectura rápida</Text>
          </View>
          <Text style={styles.homePulseHeadline}>{homePulse.headline}</Text>
          <Text style={styles.homePulseBody}>{homePulse.body}</Text>
          <View style={styles.homePulseChips}>
            {homePulse.chips.map((chip) => (
              <View key={chip} style={styles.homePulseChip}>
                <Text style={styles.homePulseChipText}>{chip}</Text>
              </View>
            ))}
          </View>
        </View>
      </TouchableOpacity>
      <InsightCard
        icon={weeklyInsight.icon}
        text={weeklyInsight.text}
        onPress={() => navigation.navigate(resolveInsightRoute(weeklyInsight.text))}
      />
      <OmniSuggestions
        suggestions={omniSuggestions}
        onSuggestionPress={(suggestion) => navigation.navigate(resolveInsightRoute(suggestion.text))}
      />

      <View style={styles.quickAccessSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="layers" size={16} color={Colors.accent.cyan} />
          <Text style={[styles.sectionTitle, { color: Colors.accent.cyan }]}>ACCESOS RÁPIDOS</Text>
        </View>
        <View style={styles.quickAccessGrid}>
          {quickAccessCards.map((card) => (
            <TouchableOpacity key={card.title} activeOpacity={0.82} onPress={card.onPress} style={styles.quickAccessCard}>
              <View style={[styles.quickAccessIcon, { backgroundColor: card.color + '18' }]}>
                <Ionicons name={card.icon as any} size={18} color={card.color} />
              </View>
              <Text style={styles.quickAccessTitle}>{card.title}</Text>
              <Text style={styles.quickAccessSubtitle}>{card.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent.green} colors={[Colors.accent.green]} progressBackgroundColor={Colors.bg.primary} />}>
        <View style={styles.playerCard}>
          <View style={styles.avatarCircle}><Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase() || 'U'}</Text></View>
          <View style={styles.playerInfo}>
            <Text style={styles.playerName}>{displayName}</Text>
            <View style={styles.xpRow}><Ionicons name="star" size={10} color={Colors.accent.gold} /><Text style={styles.xpText}>Nivel {player.level}</Text><Text style={styles.xpSubtext}>{player.xpCurrent}/{player.xpToNext} XP</Text></View>
          </View>
        </View>
        <View style={styles.dailySummaryCard}>
          <View style={styles.sectionHeader}><Ionicons name="today" size={16} color={Colors.accent.cyan} /><Text style={[styles.sectionTitle, { color: Colors.accent.cyan }]} accessible={true} accessibilityRole="header" accessibilityLabel="Resumen diario">HOY</Text></View>
          <View style={styles.dailyGrid}>
            <View style={styles.dailyStat}>
              <View style={[styles.dailyStatIcon, { backgroundColor: Colors.accent.green + '15' }]}><Ionicons name="checkmark-circle" size={16} color={Colors.accent.green} /></View>
              <Text style={styles.dailyStatValue}>{deferredProjects.tareasHoy?.done || 0}/{deferredProjects.tareasHoy?.total || 0}</Text>
              <Text style={styles.dailyStatLabel}>TAREAS HOY</Text>
              <View style={styles.miniProgressBg}><View style={[styles.miniProgressFill, { width: `${Math.max(5, todayTaskProgress * 100)}%` }]} /></View>
            </View>
            <View style={styles.dailyStat}>
              <View style={[styles.dailyStatIcon, { backgroundColor: Colors.accent.gold + '15' }]}><Ionicons name="flash" size={16} color={Colors.accent.gold} /></View>
              <Text style={[styles.dailyStatValue, { color: Colors.accent.gold }]}>+{xpEarnedToday}</Text>
              <Text style={styles.dailyStatLabel}>XP HOY</Text>
              <View style={styles.miniProgressBg}><View style={[styles.miniProgressFill, { width: `${Math.max(5, Math.min(100, (xpEarnedToday / 500) * 100))}%`, backgroundColor: Colors.accent.gold }]} /></View>
            </View>
            <View style={styles.dailyStat}>
              <View style={[styles.dailyStatIcon, { backgroundColor: Colors.accent.cyan + '15' }]}><Ionicons name="trending-up" size={16} color={Colors.accent.cyan} /></View>
              <Text style={[styles.dailyStatValue, { color: todayIncome > todayExpenses ? Colors.accent.green : Colors.accent.red }]}>{formatCOP(todayIncome - todayExpenses)}</Text>
              <Text style={styles.dailyStatLabel}>BALANCE HOY</Text>
              <View style={styles.miniProgressBg}><View style={[styles.miniProgressFill, { width: `${Math.max(5, todayIncome > 0 ? 70 : 10)}%`, backgroundColor: todayIncome > todayExpenses ? Colors.accent.green : Colors.accent.red }]} /></View>
            </View>
          </View>
        </View>
        <FinanceSection totalMonthlyExpenses={totalMonthlyExpenses} finances={finances} transactions={deferredTransactions} formatCOP={formatCOP} onPress={handlePressFinanzas} />
        <ProjectsSection projects={deferredProjects} onPress={handlePressProyectos} />
        <WeightSection health={health} weightHistory={deferredWeightHistory} goals={deferredGoals} onPress={handlePressNutricion} />
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  skeletonContainer: { flex: 1, backgroundColor: Colors.bg.primary, padding: Spacing.base, gap: Spacing.sm },
  shell: { flex: 1, backgroundColor: Colors.bg.primary },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xs },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerTitle: { fontFamily: FontFamily.techSemi, fontSize: FontSize.lg, color: Colors.text.primary, letterSpacing: 2 },
  headerSubtitle: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.text.muted, marginTop: 2 },
  scroll: { padding: Spacing.base, gap: Spacing.sm },
  networkPillWrapper: { alignItems: 'center', marginVertical: Spacing.sm },
  networkPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, gap: Spacing.xs },
  networkPillText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 1 },
  playerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.border.default, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.md },
  avatarCircle: { width: 48, height: 48, borderRadius: BorderRadius.xl, backgroundColor: Colors.accent.green + '20', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FontFamily.tech, fontSize: FontSize.xl, color: Colors.accent.green },
  playerInfo: { flex: 1 },
  playerName: { fontFamily: FontFamily.techSemi, fontSize: FontSize.md, color: Colors.text.primary },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  xpText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.accent.gold, fontWeight: '700' },
  xpSubtext: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.muted },
  dailySummaryCard: { backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.accent.cyan + '30', borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm },
  homePulseCard: { marginHorizontal: Spacing.base, backgroundColor: 'rgba(0, 229, 255, 0.05)', borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.14)', borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 6 },
  homePulseHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  homePulseTitle: { fontFamily: FontFamily.techSemi, fontSize: FontSize.xs, color: Colors.text.primary, letterSpacing: 0.8 },
  homePulseHeadline: { fontFamily: FontFamily.techSemi, fontSize: FontSize.sm, color: Colors.text.primary },
  homePulseBody: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.secondary, lineHeight: 14 },
  homePulseChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  homePulseChip: { backgroundColor: Colors.bg.input, borderWidth: 1, borderColor: Colors.border.subtle, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  homePulseChipText: { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.text.muted, letterSpacing: 0.4 },
  dailyGrid: { flexDirection: 'row', gap: Spacing.sm },
  quickAccessSection: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  quickAccessCard: {
    width: '48%',
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    gap: 4,
  },
  quickAccessIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAccessTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
  },
  quickAccessSubtitle: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    lineHeight: 14,
    color: Colors.text.muted,
  },
  dailyStat: { flex: 1, backgroundColor: Colors.bg.input, borderRadius: BorderRadius.md, padding: Spacing.sm, alignItems: 'center', gap: 4 },
  dailyStatIcon: { width: 28, height: 28, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  dailyStatValue: { fontFamily: FontFamily.tech, fontSize: FontSize.sm, color: Colors.text.primary, fontWeight: '700' },
  dailyStatLabel: { fontFamily: FontFamily.mono, fontSize: 8, color: Colors.text.muted, letterSpacing: 0.5, textAlign: 'center' },
  miniProgressBg: { width: '100%', height: 3, backgroundColor: Colors.border.subtle, borderRadius: BorderRadius.xxs, overflow: 'hidden', marginTop: 2 },
  miniProgressFill: { height: '100%', backgroundColor: Colors.accent.green, borderRadius: BorderRadius.xxs },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  sectionTitle: { fontFamily: FontFamily.techSemi, fontSize: FontSize.xs, letterSpacing: 1.5 },
});

export default React.memo(EstadoScreen);


