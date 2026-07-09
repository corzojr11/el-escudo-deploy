import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-wagmi-charts';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { useAppStore } from '../../store';

/**
 * WeightChart - Interactive weight history chart with quick logging.
 *
 * Renders a `LineChart` from `react-native-wagmi-charts` showing the user's weight
 * progression over time. Includes a text input and button for quickly logging new
 * weight entries via the Zustand store's `logWeight` action.
 */
const WeightChart: React.FC = () => {
  const { weightHistory, logWeight } = useAppStore();
  const [newWeight, setNewWeight] = useState('');

  const { data, latestEntry, delta, deltaLabel } = useMemo(() => {
    const sorted = [...weightHistory].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
    const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
    const difference = latest && previous ? latest.weight - previous.weight : 0;

    return {
      data: sorted.map((entry) => ({
        timestamp: entry.timestamp.getTime(),
        value: entry.weight,
      })),
      latestEntry: latest,
      delta: difference,
      deltaLabel:
        latest && previous
          ? `${difference >= 0 ? '+' : ''}${difference.toFixed(1)} kg desde el ultimo registro`
          : 'Todavia no hay tendencia suficiente',
    };
  }, [weightHistory]);

  const handleLog = () => {
    const value = parseFloat(newWeight);
    if (!Number.isNaN(value) && value > 0) {
      logWeight(value);
      setNewWeight('');
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>PESO</Text>
        </View>
        <Text style={styles.title}>Historial Fisico</Text>
      </View>
      <View style={styles.summaryRow}>
        <View style={styles.summaryChip}>
          <Text style={styles.summaryLabel}>Ultimo peso</Text>
          <Text style={styles.summaryValue}>{latestEntry ? `${latestEntry.weight.toFixed(1)} kg` : '--'}</Text>
        </View>
        <View style={styles.summaryChip}>
          <Text style={styles.summaryLabel}>Tendencia</Text>
          <Text style={[styles.summaryValue, delta < 0 ? styles.summaryDown : delta > 0 ? styles.summaryUp : null]}>
            {deltaLabel}
          </Text>
        </View>
      </View>

      {data.length > 0 ? (
        <LineChart.Provider data={data}>
          <LineChart>
            <LineChart.Path color={Colors.accent.cyan} width={3}>
              <LineChart.Gradient color={Colors.accent.cyan} />
            </LineChart.Path>
            <LineChart.CursorCrosshair color={Colors.text.primary} />
          </LineChart>
        </LineChart.Provider>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Sin registros suficientes.</Text>
          <Text style={styles.emptySubtext}>Registra tu peso para activar la evolucion visual.</Text>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Ej: 72.5"
          placeholderTextColor={Colors.text.muted}
          keyboardType="numeric"
          value={newWeight}
          onChangeText={setNewWeight}
        />
        <TouchableOpacity style={styles.btn} onPress={handleLog}>
          <Text style={styles.btnText}>REGISTRAR</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(4, 8, 18, 0.96)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,255,157,0.16)',
    backgroundColor: 'rgba(0,255,157,0.08)',
  },
  headerBadgeText: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.accent.green,
    letterSpacing: 1,
  },
  title: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.lg,
    color: Colors.text.primary,
    letterSpacing: 0.7,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  summaryChip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  summaryLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.text.muted,
    marginBottom: 4,
  },
  summaryValue: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
    lineHeight: 18,
  },
  summaryUp: {
    color: Colors.accent.orange,
  },
  summaryDown: {
    color: Colors.accent.green,
  },
  empty: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyText: {
    fontFamily: FontFamily.techRegular,
    color: Colors.text.muted,
  },
  emptySubtext: {
    fontFamily: FontFamily.mono,
    color: Colors.text.secondary,
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    color: Colors.text.primary,
    fontFamily: FontFamily.techSemi,
  },
  btn: {
    backgroundColor: Colors.accent.cyan,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    shadowColor: Colors.accent.cyan,
    shadowOpacity: 0.24,
    shadowRadius: 14,
  },
  btnText: {
    fontFamily: FontFamily.tech,
    color: Colors.bg.primary,
  },
});

export default React.memo(WeightChart);
