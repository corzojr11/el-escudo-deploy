import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { BorderRadius, Spacing } from '../theme/spacing';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAppStore } from '../store';
import { getApiBaseUrl, resetApiBaseUrl, setApiBaseUrl } from '../config/api';

type QuickAccessCardProps = {
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  onPress: () => void;
};

const QuickAccessCard = ({ title, subtitle, icon, color, onPress }: QuickAccessCardProps) => (
  <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.78}>
    <View style={[styles.cardIcon, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
    <View style={styles.cardTextWrap}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
    </View>
    <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} />
  </TouchableOpacity>
);

const MoreScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const projects = useAppStore((state) => state.projects);
  const goals = useAppStore((state) => state.goals);
  const racha = useAppStore((state) => state.racha);
  const workShifts = useAppStore((state) => state.workShifts);
  const logout = useAppStore((state) => state.logout);
  const toggleNotifications = useAppStore((state) => state.toggleNotifications);
  const notificationsEnabled = useAppStore((state) => state.userProfile?.notificationsEnabled ?? false);
  const [backendUrl, setBackendUrl] = useState(getApiBaseUrl());
  const [savingBackend, setSavingBackend] = useState(false);
  const [changingNotifications, setChangingNotifications] = useState(false);

  useEffect(() => {
    setBackendUrl(getApiBaseUrl());
  }, []);

  const goTo = useCallback((screen: string) => {
    navigation.navigate(screen);
  }, [navigation]);

  const handleSaveBackend = useCallback(async () => {
    const value = backendUrl.trim();
    if (!value) {
      Alert.alert('Backend requerido', 'Pon una URL valida para usar la app en Android.');
      return;
    }
    setSavingBackend(true);
    try {
      await setApiBaseUrl(value);
      Alert.alert('Listo', 'Backend guardado.');
    } catch {
      Alert.alert('Error', 'No se pudo guardar la URL del backend.');
    } finally {
      setSavingBackend(false);
    }
  }, [backendUrl]);

  const handleResetBackend = useCallback(async () => {
    setSavingBackend(true);
    try {
      const next = await resetApiBaseUrl();
      setBackendUrl(next);
      Alert.alert('Listo', 'Backend restablecido.');
    } catch {
      Alert.alert('Error', 'No se pudo restablecer la URL del backend.');
    } finally {
      setSavingBackend(false);
    }
  }, []);

  const handleToggleNotifications = useCallback(async () => {
    setChangingNotifications(true);
    try {
      await toggleNotifications(!notificationsEnabled);
    } finally {
      setChangingNotifications(false);
    }
  }, [notificationsEnabled, toggleNotifications]);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const hiddenSummary = [
    { label: 'Proyectos', value: `${projects.tareasHoy.done}/${projects.tareasHoy.total}` },
    { label: 'Metas', value: `${goals.length}` },
    { label: 'Racha', value: `${racha.days}d` },
    { label: 'Turnos', value: `${workShifts.length}` },
  ];

  return (
    <SafeAreaView style={styles.shell} edges={['top']}>
      <ScreenHeader title="AJUSTES" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Configuración y accesos del sistema.</Text>
          <Text style={styles.heroText}>
            Backend, notificaciones y cierre de sesión sin buscar menús escondidos.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Ajustes rápidos</Text>
        <View style={styles.settingsCard}>
          <Text style={styles.settingsLabel}>Backend móvil</Text>
          <TextInput
            value={backendUrl}
            onChangeText={setBackendUrl}
            placeholder="http://192.168.1.20:8001"
            placeholderTextColor={Colors.text.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
          />
          <View style={styles.settingsActions}>
            <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary]} onPress={handleSaveBackend} disabled={savingBackend}>
              <Text style={styles.actionPrimaryText}>{savingBackend ? 'Guardando...' : 'Guardar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionSecondary]} onPress={handleResetBackend} disabled={savingBackend}>
              <Text style={styles.actionSecondaryText}>Restablecer</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.toggleRow} onPress={handleToggleNotifications} disabled={changingNotifications}>
            <View>
              <Text style={styles.toggleTitle}>Notificaciones</Text>
              <Text style={styles.toggleSubtitle}>{notificationsEnabled ? 'Activas' : 'Apagadas'}</Text>
            </View>
            <Text style={styles.toggleAction}>{changingNotifications ? '...' : notificationsEnabled ? 'Desactivar' : 'Activar'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          {hiddenSummary.map((item) => (
            <View key={item.label} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={styles.summaryValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Accesos directos</Text>
        <QuickAccessCard
          title="Dashboard"
          subtitle="Resumen general, XP y accesos rápidos."
          icon="grid-outline"
          color={Colors.accent.cyan}
          onPress={() => goTo('Estado')}
        />
        <QuickAccessCard
          title="Finanzas"
          subtitle="Ingresos, gastos, comprobantes y balance."
          icon="card-outline"
          color={Colors.accent.green}
          onPress={() => goTo('Finanzas')}
        />
        <QuickAccessCard
          title="Turnos"
          subtitle="Horario, sueño, descanso y planificación."
          icon="time-outline"
          color={Colors.accent.indigo}
          onPress={() => goTo('Turnos')}
        />
        <QuickAccessCard
          title="Salud / Gym"
          subtitle="Rutinas, peso, enfoque y recuperación."
          icon="barbell-outline"
          color={Colors.accent.orange}
          onPress={() => goTo('Salud')}
        />
        <QuickAccessCard
          title="OMNI"
          subtitle="Chat para ejecutar acciones en toda la app."
          icon="chatbubble-ellipses-outline"
          color={Colors.accent.cyan}
          onPress={() => goTo('Inicio')}
        />

        <Text style={styles.sectionTitle}>Módulos visibles desde aquí</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Proyectos, metas y hábitos</Text>
          <Text style={styles.infoText}>
            Se gestionan desde el dashboard, pero aquí ya no quedan escondidos.
            Entra a Estado para ver el resumen y saltar a cada bloque.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  content: {
    padding: Spacing.base,
    gap: Spacing.md,
    paddingBottom: 24,
  },
  hero: {
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 6,
  },
  heroTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.md,
    color: Colors.text.primary,
  },
  heroText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    lineHeight: 18,
    color: Colors.text.secondary,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  summaryCard: {
    flexGrow: 1,
    minWidth: '46%',
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  summaryLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.text.muted,
    letterSpacing: 1,
  },
  summaryValue: {
    marginTop: 4,
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.md,
    color: Colors.text.primary,
  },
  sectionTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    letterSpacing: 1.5,
    marginTop: Spacing.xs,
  },
  settingsCard: {
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  settingsLabel: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
  },
  input: {
    backgroundColor: Colors.bg.primary,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    color: Colors.text.primary,
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
  },
  settingsActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimary: {
    backgroundColor: Colors.accent.green,
  },
  actionPrimaryText: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.xs,
    color: '#000',
  },
  actionSecondary: {
    backgroundColor: Colors.bg.primary,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  actionSecondaryText: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.xs,
    color: Colors.text.primary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  toggleTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.xs,
    color: Colors.text.primary,
  },
  toggleSubtitle: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    marginTop: 2,
  },
  toggleAction: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.xs,
    color: Colors.accent.cyan,
  },
  logoutBtn: {
    marginTop: 4,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accent.red,
    paddingVertical: 10,
    alignItems: 'center',
  },
  logoutText: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.xs,
    color: Colors.accent.red,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.lg,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextWrap: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
  },
  cardSubtitle: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    lineHeight: 16,
    color: Colors.text.muted,
  },
  infoCard: {
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 6,
  },
  infoTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
  },
  infoText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    lineHeight: 18,
    color: Colors.text.secondary,
  },
});

export default MoreScreen;
