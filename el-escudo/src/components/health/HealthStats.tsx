import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { useAppStore } from '../../store';
import WeightChart from './WeightChart';

/**
 * HealthStats — Comprehensive health and fitness statistics dashboard.
 *
 * Displays a scrollable panel containing:
 * - Weight evolution chart (via `WeightChart`)
 * - Physical summary card (weight, height, BMI)
 * - Body measurements grid (chest, arms, waist, legs)
 * - Fitness objectives list
 * - Last workout date reference
 *
 * Reads all data from the Zustand store's `health` slice.
 *
 * @component
 * @example
 * ```tsx
 * <HealthStats />
 * ```
 */
const HealthStats: React.FC = () => {
  const { health } = useAppStore();
  const { weight, height, measures, objectives, lastWorkoutDate } = health;

  const imc = (weight / (height * height)).toFixed(1);

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      
      {/* Gráfico de Peso Evolutivo */}
      <WeightChart />
      
      {/* Resumen Físico */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Resumen Físico</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>PESO</Text>
            <Text style={styles.statValue}>{weight}<Text style={styles.unit}>kg</Text></Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>ALTURA</Text>
            <Text style={styles.statValue}>{height}<Text style={styles.unit}>m</Text></Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>IMC</Text>
            <Text style={styles.statValue}>{imc}</Text>
          </View>
        </View>
      </View>

      {/* Medidas (Hipertrofia) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Medidas (cm)</Text>
        <View style={styles.measuresGrid}>
          <View style={styles.measureItem}>
            <Text style={styles.measureLabel}>Pecho</Text>
            <Text style={styles.measureVal}>{measures.chest}</Text>
          </View>
          <View style={styles.measureItem}>
            <Text style={styles.measureLabel}>Brazos</Text>
            <Text style={styles.measureVal}>{measures.arms}</Text>
          </View>
          <View style={styles.measureItem}>
            <Text style={styles.measureLabel}>Cintura</Text>
            <Text style={styles.measureVal}>{measures.waist}</Text>
          </View>
          <View style={styles.measureItem}>
            <Text style={styles.measureLabel}>Piernas</Text>
            <Text style={styles.measureVal}>{measures.legs}</Text>
          </View>
        </View>
      </View>

      {/* Calendario Mock */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Calendario de Entrenamiento</Text>
        <Text style={styles.subText}>Último registro: {lastWorkoutDate || 'Ninguno'}</Text>
        <View style={styles.calendarGrid}>
          {Array.from({ length: 30 }).map((_, i) => (
            <View 
              key={i} 
              style={[
                styles.calDay, 
                // Randomly highlight some days for visual mock, but always highlight today if active
                (i % 3 === 0 || i % 7 === 0) && styles.calDayActive
              ]} 
            />
          ))}
        </View>
      </View>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { padding: Spacing.base, gap: Spacing.md, paddingBottom: Spacing.xl },
  card: {
    backgroundColor: 'rgba(4, 8, 18, 0.96)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: Spacing.md,
    overflow: 'hidden',
  },
  cardTitle: { fontFamily: FontFamily.techSemi, fontSize: FontSize.md, color: Colors.text.primary, marginBottom: Spacing.md, letterSpacing: 0.7 },
  subText: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.text.muted, marginBottom: Spacing.md },
  
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  statLabel: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.muted, marginBottom: 4 },
  statValue: { fontFamily: FontFamily.tech, fontSize: FontSize.lg, color: Colors.text.primary },
  unit: { fontSize: FontSize.sm, color: Colors.text.secondary },

  measuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  measureItem: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  measureLabel: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.text.secondary },
  measureVal: { fontFamily: FontFamily.techSemi, fontSize: FontSize.md, color: Colors.accent.green },

  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  calDay: { width: 32, height: 32, borderRadius: BorderRadius.xs, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  calDayActive: { backgroundColor: Colors.accent.green, borderColor: Colors.accent.green, opacity: 0.8 },
});

export default HealthStats;
