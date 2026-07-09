import React, { useMemo } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { Project, Task } from '../../store';

type Props = {
  projects: { list?: Project[]; tasks?: Task[]; tareasHoy?: { done: number; total: number } };
  onPress: () => void;
};

const ProjectsSection: React.FC<Props> = ({ projects, onPress }) => {
  const formatScheduledAt = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('es-CO', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const priorityOrder: Record<'high' | 'medium' | 'low', number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  const activeMissions = useMemo(
    () =>
      (projects.list || [])
        .filter((m: Project) => m.status === 'active')
        .slice()
        .sort((a, b) => {
          const priorityA = priorityOrder[(a.priority || 'medium') as 'high' | 'medium' | 'low'] ?? 1;
          const priorityB = priorityOrder[(b.priority || 'medium') as 'high' | 'medium' | 'low'] ?? 1;
          if (priorityA !== priorityB) return priorityA - priorityB;
          return String(a.scheduledAt || '').localeCompare(String(b.scheduledAt || ''));
        }),
    [projects.list]
  );

  const completedMissions = useMemo(
    () => (projects.list || []).filter((m: Project) => m.status === 'completed'),
    [projects.list]
  );

  const overallProgress = useMemo(() => {
    if (activeMissions.length === 0) return 0;
    let totalTasks = 0;
    let completedTasks = 0;
    activeMissions.forEach((mission: Project) => {
      const missionTasks = (projects.tasks || []).filter((t: Task) => t.projectId === mission.id);
      totalTasks += missionTasks.length;
      completedTasks += missionTasks.filter((t: Task) => t.completed).length;
    });
    return totalTasks > 0 ? completedTasks / totalTasks : 0;
  }, [activeMissions, projects.tasks]);

  const missionCompletionRate = useMemo(() => {
    const total = (projects.list || []).length;
    if (total === 0) return 0;
    return completedMissions.length / total;
  }, [projects.list, completedMissions]);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`Sección de Proyectos. Tareas de hoy completadas: ${projects.tareasHoy?.done || 0} de ${projects.tareasHoy?.total || 0}.`}
      accessibilityHint="Doble toque para gestionar tus misiones y objetivos."
    >
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: Colors.accent.cyan + '15' }]}>
            <Ionicons name="rocket" size={18} color={Colors.accent.cyan} />
          </View>
          <Text style={[styles.sectionTitle, { color: Colors.accent.cyan }]} accessible={true} accessibilityRole="header" accessibilityLabel="Sección de Proyectos">PROYECTOS</Text>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>MISIONES ACTIVAS</Text>
            <Text style={[styles.kpiValue, { color: Colors.accent.cyan }]}>{activeMissions.length}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>TASA COMPLETADAS</Text>
            <Text style={[styles.kpiValue, { color: Colors.accent.green }]}>{Math.round(missionCompletionRate * 100)}%</Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progreso global</Text>
            <Text style={styles.progressPercent}>{Math.round(overallProgress * 100)}%</Text>
          </View>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${Math.max(5, overallProgress * 100)}%` }]} />
          </View>
        </View>

        {activeMissions.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.subsectionTitle}>MISIONES ACTIVAS</Text>
            {activeMissions.slice(0, 3).map((mission: Project) => {
              const missionTasks = (projects.tasks || []).filter((t: Task) => t.projectId === mission.id);
              const doneCount = missionTasks.filter((t: Task) => t.completed).length;
              const missionProgress = missionTasks.length > 0 ? doneCount / missionTasks.length : 0;
              return (
                <View key={mission.id} style={styles.missionRow}>
                  <View style={styles.missionInfo}>
                    <Text style={styles.missionName}>{mission.name}</Text>
                    {mission.description ? <Text style={styles.missionDesc} numberOfLines={1}>{mission.description}</Text> : null}
                    <View style={styles.metaRow}>
                      <View
                        style={[
                          styles.metaChip,
                          mission.priority === 'high'
                            ? styles.metaChipHigh
                            : mission.priority === 'low'
                              ? styles.metaChipLow
                              : styles.metaChipMedium,
                        ]}
                      >
                        <Text style={styles.metaChipText}>{(mission.priority || 'medium').toUpperCase()}</Text>
                      </View>
                      {mission.scheduledAt ? (
                        <View style={styles.metaChip}>
                          <Text style={styles.metaChipText}>{formatScheduledAt(mission.scheduledAt)}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.missionProgress}>
                    <Text style={styles.missionProgressText}>{doneCount}/{missionTasks.length}</Text>
                    <View style={styles.missionProgressBg}>
                      <View style={[styles.missionProgressFill, { width: `${Math.max(5, missionProgress * 100)}%` }]} />
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  sectionCard: { backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.border.default, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  sectionIcon: { width: 32, height: 32, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontFamily: FontFamily.techSemi, fontSize: FontSize.xs, letterSpacing: 1.5 },
  kpiRow: { flexDirection: 'row', gap: Spacing.sm },
  kpiBox: { flex: 1, backgroundColor: Colors.bg.input, borderRadius: BorderRadius.md, padding: Spacing.sm },
  kpiLabel: { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.text.muted, letterSpacing: 1 },
  kpiValue: { fontFamily: FontFamily.tech, fontSize: FontSize.md, color: Colors.text.primary, marginTop: 4, fontWeight: '700' },
  divider: { height: 1, backgroundColor: Colors.border.subtle },
  subsectionTitle: { fontFamily: FontFamily.techSemi, fontSize: FontSize.xs, color: Colors.text.muted, letterSpacing: 1 },
  progressContainer: { paddingHorizontal: Spacing.xs, gap: 4 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.muted },
  progressPercent: { fontFamily: FontFamily.tech, fontSize: FontSize.xs, color: Colors.accent.green, fontWeight: '700' },
  progressBg: { height: 8, backgroundColor: Colors.border.subtle, borderRadius: BorderRadius.xxs, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.accent.green, borderRadius: BorderRadius.xxs },
  missionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs, gap: Spacing.sm },
  missionInfo: { flex: 1 },
  missionName: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.text.primary },
  missionDesc: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.muted, marginTop: 1 },
  metaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  metaChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border.default,
    backgroundColor: Colors.bg.input,
  },
  metaChipHigh: {
    borderColor: Colors.accent.red,
    backgroundColor: Colors.accent.red + '14',
  },
  metaChipMedium: {
    borderColor: Colors.accent.cyan,
    backgroundColor: Colors.accent.cyan + '14',
  },
  metaChipLow: {
    borderColor: Colors.accent.green,
    backgroundColor: Colors.accent.green + '14',
  },
  metaChipText: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.text.muted,
  },
  missionProgress: { alignItems: 'flex-end', gap: 2 },
  missionProgressText: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.muted },
  missionProgressBg: { width: 60, height: 4, backgroundColor: Colors.border.subtle, borderRadius: BorderRadius.xxs, overflow: 'hidden' },
  missionProgressFill: { height: '100%', backgroundColor: Colors.accent.cyan, borderRadius: BorderRadius.xxs },
});

export default React.memo(ProjectsSection);
