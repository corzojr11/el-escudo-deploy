import React, { useMemo } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-wagmi-charts';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';

type Props = {
  health: { weight: number };
  weightHistory: any[];
  goals: any[];
  onPress: () => void;
};

const WeightSection: React.FC<Props> = ({ health, weightHistory, goals, onPress }) => {
  const latestWeight = useMemo(() => {
    if (!weightHistory || weightHistory.length === 0) return null;
    return weightHistory[weightHistory.length - 1];
  }, [weightHistory]);

  const weightTrend7d = useMemo(() => {
    if (!weightHistory || weightHistory.length < 2) return null;
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentEntries = weightHistory.filter((w) => new Date(w.timestamp) >= sevenDaysAgo);
    if (recentEntries.length < 2) {
      const last = weightHistory[weightHistory.length - 1].weight;
      const prev = weightHistory[weightHistory.length - 2].weight;
      return last - prev;
    }
    const first = recentEntries[0].weight;
    const last = recentEntries[recentEntries.length - 1].weight;
    return last - first;
  }, [weightHistory]);

  const weight30dData = useMemo(() => {
    if (!weightHistory || weightHistory.length === 0) return [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recent = weightHistory
      .filter((w) => new Date(w.timestamp) >= thirtyDaysAgo)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return recent.map((w) => ({ timestamp: new Date(w.timestamp).getTime(), value: w.weight }));
  }, [weightHistory]);

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`Sección de Nutrición. Peso actual registrado: ${health.weight || 'no registrado'} kilogramos.`}
        accessibilityHint="Doble toque para ver el historial y registrar tu peso."
      >
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: Colors.accent.green + '15' }]}>
              <Ionicons name="fitness" size={18} color={Colors.accent.green} />
            </View>
            <Text style={[styles.sectionTitle, { color: Colors.accent.green }]} accessible={true} accessibilityRole="header" accessibilityLabel="Sección de Nutrición">NUTRICIÓN</Text>
          </View>

          <View style={styles.kpiRow}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>PESO ACTUAL</Text>
              <Text style={[styles.kpiValue, { color: Colors.accent.green }]}>
                {latestWeight ? `${latestWeight.weight} kg` : `${health.weight} kg`}
              </Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>TENDENCIA 7D</Text>
              {weightTrend7d !== null ? (
                <View style={styles.trendRow}>
                  <Ionicons
                    name={weightTrend7d > 0 ? 'trending-up' : weightTrend7d < 0 ? 'trending-down' : 'remove'}
                    size={14}
                    color={weightTrend7d > 0 ? Colors.accent.red : weightTrend7d < 0 ? Colors.accent.green : Colors.text.muted}
                  />
                  <Text
                    style={[
                      styles.kpiValue,
                      { color: weightTrend7d > 0 ? Colors.accent.red : weightTrend7d < 0 ? Colors.accent.green : Colors.text.muted },
                    ]}
                  >
                    {weightTrend7d > 0 ? '+' : ''}{weightTrend7d.toFixed(1)} kg
                  </Text>
                </View>
              ) : (
                <Text style={[styles.kpiValue, { color: Colors.text.muted }]}>—</Text>
              )}
            </View>
          </View>

          {(goals || []).filter((g) => g.status === 'active').length > 0 && (
            <>
              <View style={styles.divider} />
              <Text style={styles.subsectionTitle}>METAS ACTIVAS</Text>
              {(goals || [])
                .filter((g) => g.status === 'active')
                .slice(0, 3)
                .map((g) => {
                  const progress = g.target_value > 0 ? g.current_value / g.target_value : 0;
                  return (
                    <View key={g.id} style={styles.goalRow}>
                      <View style={styles.goalInfo}>
                        <Text style={styles.goalName}>{g.name}</Text>
                        <Text style={styles.goalSubtext}>{g.current_value}/{g.target_value} {g.unit}</Text>
                      </View>
                      <Text style={styles.goalPercent}>{Math.round(progress * 100)}%</Text>
                    </View>
                  );
                })}
            </>
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: Colors.accent.green + '15' }]}>
            <Ionicons name="trending-up" size={18} color={Colors.accent.green} />
          </View>
          <Text style={[styles.sectionTitle, { color: Colors.accent.green }]} accessible={true} accessibilityRole="header" accessibilityLabel="Tendencia de peso de los últimos 30 días">TENDENCIA DE PESO</Text>
        </View>

        {weight30dData.length === 0 ? (
          <View style={styles.chartEmpty}>
            <Ionicons name="scale-outline" size={32} color={Colors.text.muted} />
            <Text style={styles.chartEmptyText}>Sin datos de peso</Text>
            <Text style={styles.chartEmptySubtext}>Registra tu peso en Nutrición para ver la tendencia.</Text>
          </View>
        ) : (
          <View style={styles.chartContainer}>
            <LineChart.Provider data={weight30dData}>
              <LineChart height={180}>
                <LineChart.Path color={Colors.accent.green} />
                <LineChart.CursorCrosshair color={Colors.accent.cyan} />
                <LineChart.Tooltip position="top" />
              </LineChart>
            </LineChart.Provider>
            <View style={styles.chartLabels}>
              <Text style={styles.chartLabel}>{weight30dData[0]?.value} kg</Text>
              <Text style={styles.chartLabel}>{weight30dData[weight30dData.length - 1]?.value} kg</Text>
            </View>
          </View>
        )}
      </View>
    </>
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
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  divider: { height: 1, backgroundColor: Colors.border.subtle },
  subsectionTitle: { fontFamily: FontFamily.techSemi, fontSize: FontSize.xs, color: Colors.text.muted, letterSpacing: 1 },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.xs },
  goalInfo: { flex: 1 },
  goalName: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.text.primary },
  goalSubtext: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.muted, marginTop: 1 },
  goalPercent: { fontFamily: FontFamily.tech, fontSize: FontSize.sm, color: Colors.accent.green, fontWeight: '700' },
  chartEmpty: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.xs },
  chartEmptyText: { fontFamily: FontFamily.techSemi, fontSize: FontSize.md, color: Colors.text.muted },
  chartEmptySubtext: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.text.muted, opacity: 0.6, textAlign: 'center' },
  chartContainer: { paddingVertical: Spacing.xs },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.xs, marginTop: Spacing.xs },
  chartLabel: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.text.muted },
});

export default React.memo(WeightSection);
