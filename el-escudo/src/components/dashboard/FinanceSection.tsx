import React, { useMemo } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import CompletedGoalsList from '../../components/goals/CompletedGoalsList';

type Props = {
  totalMonthlyExpenses: number;
  finances: { saldo: number };
  transactions: any[];
  formatCOP: (val: number) => string;
  onPress: () => void;
};

const FinanceSection: React.FC<Props> = ({ totalMonthlyExpenses, finances, transactions, formatCOP, onPress }) => {
  const monthlyExpensesData = useMemo(() => {
    const now = new Date();
    const months: { label: string; total: number }[] = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = d.getMonth();
      const year = d.getFullYear();
      const total = transactions
        .filter((t) => {
          const td = new Date(t.fecha);
          return t.tipo === 'GASTO' && td.getMonth() === month && td.getFullYear() === year;
        })
        .reduce((acc, t) => acc + t.monto, 0);
      const label = d.toLocaleDateString('es-CO', { month: 'short' }).toUpperCase();
      months.push({ label, total });
    }
    return months;
  }, [transactions]);

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`Sección de Finanzas. Gastos del mes: ${formatCOP(totalMonthlyExpenses)}. Saldo: ${formatCOP(finances.saldo)}.`}
        accessibilityHint="Doble toque para ver detalles de finanzas y transacciones."
      >
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: Colors.accent.gold + '15' }]}>
              <Ionicons name="wallet" size={18} color={Colors.accent.gold} />
            </View>
            <Text style={[styles.sectionTitle, { color: Colors.accent.gold }]} accessible={true} accessibilityRole="header" accessibilityLabel="Sección de Finanzas">FINANZAS</Text>
          </View>

          <View style={styles.pulseCard}>
            <View style={styles.pulseHeader}>
              <Ionicons name="flash" size={14} color={Colors.accent.gold} />
              <Text style={styles.pulseTitle}>Lectura rápida</Text>
            </View>
            <Text style={styles.pulseHeadline}>Saldo y gasto en una sola vista</Text>
            <Text style={styles.pulseBody}>
              {finances.saldo >= totalMonthlyExpenses
                ? 'Tienes margen para respirar. Lo importante aquí es no romper el balance.'
                : 'Ojo, te estás apretando. Conviene frenar gastos hoy.'}
            </Text>
            <View style={styles.pulseChips}>
              <View style={styles.pulseChip}><Text style={styles.pulseChipText}>Saldo {formatCOP(finances.saldo)}</Text></View>
              <View style={styles.pulseChip}><Text style={styles.pulseChipText}>Gasto mes {formatCOP(totalMonthlyExpenses)}</Text></View>
              <View style={styles.pulseChip}><Text style={styles.pulseChipText}>{(transactions || []).length} movimientos</Text></View>
            </View>
          </View>

          <View style={styles.kpiRow}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>GASTOS MES</Text>
              <Text style={[styles.kpiValue, { color: Colors.accent.red }]}>{formatCOP(totalMonthlyExpenses)}</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>SALDO</Text>
              <Text style={[styles.kpiValue, { color: finances.saldo >= 0 ? Colors.accent.green : Colors.accent.red }]}>{formatCOP(finances.saldo)}</Text>
            </View>
          </View>

          {(transactions || []).length > 0 && (
            <>
              <View style={styles.divider} />
              <Text style={styles.subsectionTitle}>ÚLTIMOS MOVIMIENTOS</Text>
              {transactions.slice(0, 3).map((t) => (
                <View key={t.id} style={styles.transactionRow}>
                  <View style={styles.transactionDot}>
                    <Ionicons name={t.tipo === 'INGRESO' ? 'arrow-down' : 'arrow-up'} size={10} color={t.tipo === 'INGRESO' ? Colors.accent.green : Colors.accent.red} />
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionDesc}>{t.descripcion}</Text>
                    <Text style={styles.transactionDate}>{new Date(t.fecha).toLocaleDateString('es-CO')}</Text>
                  </View>
                  <Text style={[styles.transactionAmount, { color: t.tipo === 'INGRESO' ? Colors.accent.green : Colors.accent.red }]}>
                    {t.tipo === 'INGRESO' ? '+' : '-'}{formatCOP(t.monto)}
                  </Text>
                </View>
              ))}
            </>
          )}

          <CompletedGoalsList />
        </View>
      </TouchableOpacity>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: Colors.accent.gold + '15' }]}>
            <Ionicons name="bar-chart" size={18} color={Colors.accent.gold} />
          </View>
          <Text style={[styles.sectionTitle, { color: Colors.accent.gold }]} accessible={true} accessibilityRole="header" accessibilityLabel="Gráfico de gastos mensuales">GASTOS MENSUALES</Text>
        </View>

        <View style={styles.barChartContainer}>
          {(() => {
            const maxExpense = Math.max(...monthlyExpensesData.map((m) => m.total), 1);
            return monthlyExpensesData.map((m, i) => {
              const heightPercent = (m.total / maxExpense) * 100;
              return (
                <View key={i} style={styles.barItem}>
                  <Text style={styles.barValue}>{formatCOP(m.total)}</Text>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { height: `${Math.max(5, heightPercent)}%`, backgroundColor: i === 2 ? Colors.accent.gold : Colors.accent.gold + '60' }]} />
                  </View>
                  <Text style={styles.barLabel}>{m.label}</Text>
                </View>
              );
            });
          })()}
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  sectionCard: { backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.border.default, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  sectionIcon: { width: 32, height: 32, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontFamily: FontFamily.techSemi, fontSize: FontSize.xs, letterSpacing: 1.5 },
  pulseCard: { backgroundColor: 'rgba(255, 193, 7, 0.06)', borderWidth: 1, borderColor: 'rgba(255, 193, 7, 0.14)', borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 6 },
  pulseHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pulseTitle: { fontFamily: FontFamily.techSemi, fontSize: FontSize.xs, color: Colors.text.primary, letterSpacing: 0.8 },
  pulseHeadline: { fontFamily: FontFamily.techSemi, fontSize: FontSize.sm, color: Colors.text.primary },
  pulseBody: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.secondary, lineHeight: 14 },
  pulseChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pulseChip: { backgroundColor: Colors.bg.input, borderWidth: 1, borderColor: Colors.border.subtle, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pulseChipText: { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.text.muted, letterSpacing: 0.4 },
  kpiRow: { flexDirection: 'row', gap: Spacing.sm },
  kpiBox: { flex: 1, backgroundColor: Colors.bg.input, borderRadius: BorderRadius.md, padding: Spacing.sm },
  kpiLabel: { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.text.muted, letterSpacing: 1 },
  kpiValue: { fontFamily: FontFamily.tech, fontSize: FontSize.md, color: Colors.text.primary, marginTop: 4, fontWeight: '700' },
  divider: { height: 1, backgroundColor: Colors.border.subtle },
  subsectionTitle: { fontFamily: FontFamily.techSemi, fontSize: FontSize.xs, color: Colors.text.muted, letterSpacing: 1 },
  transactionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs, gap: Spacing.sm },
  transactionDot: { width: 24, height: 24, borderRadius: BorderRadius.md, backgroundColor: Colors.bg.input, alignItems: 'center', justifyContent: 'center' },
  transactionInfo: { flex: 1 },
  transactionDesc: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.text.primary },
  transactionDate: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.muted, marginTop: 1 },
  transactionAmount: { fontFamily: FontFamily.tech, fontSize: FontSize.sm, fontWeight: '700' },
  barChartContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 160, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  barItem: { flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' },
  barValue: { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.text.muted, textAlign: 'center' },
  barBg: { flex: 1, width: '60%', backgroundColor: Colors.bg.input, borderRadius: BorderRadius.xxs, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: BorderRadius.xxs },
  barLabel: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.text.muted, marginTop: 4 },
});

export default React.memo(FinanceSection);
