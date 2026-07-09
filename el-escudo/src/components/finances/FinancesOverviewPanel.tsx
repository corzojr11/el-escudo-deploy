import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import type { Transaction } from '../../store';

type PeriodFilter = 'MES' | '30D' | 'TODOS';

interface OverviewProps {
  availableBalance: number;
  incomeTotal: number;
  expenseTotal: number;
  periodFilter: PeriodFilter;
  expenseSummary: Array<{ category: string; total: number }>;
  recentTransactions: Transaction[];
  formatCOP: (value: number) => string;
  getDisplayCategory: (category: string) => string;
  onChangePeriodFilter: (value: PeriodFilter) => void;
  onScanReceipt: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (tx: Transaction) => void;
  onCreateTransaction: () => void;
  onCreateIncome: () => void;
  onRefresh?: () => void;
}

const FinancesOverviewPanel: React.FC<OverviewProps> = ({
  availableBalance,
  incomeTotal,
  expenseTotal,
  periodFilter,
  expenseSummary,
  recentTransactions,
  formatCOP,
  getDisplayCategory,
  onChangePeriodFilter,
  onScanReceipt,
  onEditTransaction,
  onDeleteTransaction,
  onCreateTransaction,
  onCreateIncome,
}) => {
  return (
    <View>
      <View style={styles.totalContainer}>
        <BlurView intensity={20} tint="dark" style={styles.glassTotal}>
          <Text style={styles.totalLabel}>DISPONIBLE</Text>
          <Text style={styles.totalValue}>{formatCOP(availableBalance)}</Text>
          <Text style={styles.totalHint}>Ingresos - Gastos</Text>
        </BlurView>
      </View>

      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>INGRESOS</Text>
          <Text style={[styles.kpiValue, { color: Colors.accent.green }]}>{formatCOP(incomeTotal)}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>GASTOS</Text>
          <Text style={[styles.kpiValue, { color: Colors.accent.red }]}>-{formatCOP(expenseTotal)}</Text>
        </View>
      </View>

      <View style={styles.periodRow}>
        {(['MES', '30D', 'TODOS'] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodChip, periodFilter === p && styles.periodChipActive]}
            onPress={() => onChangePeriodFilter(p)}
          >
            <Text style={[styles.periodChipText, periodFilter === p && styles.periodChipTextActive]}>
              {p === 'MES' ? 'Este mes' : p === '30D' ? '30 dias' : 'Todo'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.toolsRow}>
        <TouchableOpacity style={styles.scanInlineBtn} onPress={onScanReceipt} activeOpacity={0.85}>
          <Ionicons name="scan-outline" size={16} color={Colors.accent.cyan} />
          <Text style={styles.scanInlineText}>Escanear comprobante</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.incomeInlineBtn} onPress={onCreateIncome} activeOpacity={0.85}>
          <Ionicons name="arrow-down-circle-outline" size={16} color={Colors.accent.green} />
          <Text style={styles.incomeInlineText}>Registrar ingreso</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Ionicons name="pie-chart" size={14} color={Colors.accent.green} />
        <Text style={styles.sectionTitle}>DESGLOSE DE GASTOS</Text>
      </View>

      <FlatList
        data={expenseSummary}
        keyExtractor={(item) => item.category}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.categoryRow}>
            <View style={styles.categoryInfo}>
              <Ionicons name="pricetag-outline" size={16} color={Colors.accent.cyan} />
              <Text style={styles.categoryName}>{item.category}</Text>
            </View>
            <Text style={styles.categoryTotal}>{formatCOP(item.total)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>Aun no hay gastos registrados.</Text>}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <View style={styles.dividerSection} />
      <View style={styles.sectionHeader}>
        <Ionicons name="time" size={14} color={Colors.accent.orange} />
        <Text style={styles.sectionTitle}>MOVIMIENTOS RECIENTES</Text>
      </View>

      <FlatList
        data={recentTransactions}
        keyExtractor={(tx) => tx.id}
        scrollEnabled={false}
        renderItem={({ item: tx }) => {
          const isIncome = tx.tipo === 'INGRESO' || String(tx.categoria || '').startsWith('INGRESO:');
          return (
            <View style={styles.transactionRow}>
              <View style={styles.transactionIcon}>
                <Ionicons
                  name={isIncome ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
                  size={16}
                  color={isIncome ? Colors.accent.green : Colors.accent.orange}
                />
              </View>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionDesc}>{tx.descripcion}</Text>
                <View style={styles.transactionMeta}>
                  <Text style={styles.transactionCategory}>{getDisplayCategory(tx.categoria)}</Text>
                  <Text style={styles.transactionDate}>
                    {new Date(tx.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                  </Text>
                </View>
              </View>
              <Text style={[styles.transactionAmount, isIncome ? styles.transactionIncome : styles.transactionExpense]}>
                {isIncome ? '+' : '-'}
                {formatCOP(tx.monto)}
              </Text>
              <TouchableOpacity onPress={() => onEditTransaction(tx)} style={styles.iconAction} activeOpacity={0.6}>
                <Ionicons name="pencil-outline" size={16} color={Colors.accent.cyan} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onDeleteTransaction(tx)} style={styles.iconAction} activeOpacity={0.6}>
                <Ionicons name="trash-outline" size={16} color={Colors.accent.red} />
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>Aun no hay movimientos recientes.</Text>}
      />

      <TouchableOpacity style={styles.floatingAction} onPress={onCreateTransaction} activeOpacity={0.85}>
        <Ionicons name="add" size={24} color="#000" />
        <Text style={styles.floatingActionText}>Nuevo movimiento</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  totalContainer: { padding: Spacing.lg },
  glassTotal: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 157, 0.25)',
  },
  totalLabel: { color: Colors.accent.green, fontFamily: FontFamily.mono, fontSize: 12, letterSpacing: 2, marginBottom: Spacing.xs },
  totalValue: { color: '#FFF', fontFamily: FontFamily.mono, fontSize: 32, fontWeight: '800' },
  totalHint: { color: Colors.text.muted, fontFamily: FontFamily.mono, fontSize: FontSize.xs, marginTop: Spacing.sm },
  kpiRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  kpiCard: { flex: 1, borderWidth: 1, borderColor: Colors.border.default, borderRadius: BorderRadius.md, backgroundColor: Colors.bg.card, padding: Spacing.sm },
  kpiLabel: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.muted, letterSpacing: 1 },
  kpiValue: { marginTop: 4, fontFamily: FontFamily.techSemi, fontSize: FontSize.md },
  periodRow: { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md, flexWrap: 'wrap' },
  periodChip: { borderWidth: 1, borderColor: Colors.border.default, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 6, backgroundColor: Colors.bg.input },
  periodChipActive: { borderColor: Colors.accent.green, backgroundColor: 'rgba(0, 255, 157, 0.12)' },
  periodChipText: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.muted },
  periodChipTextActive: { color: Colors.accent.green },
  toolsRow: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  scanInlineBtn: {
    height: 38,
    marginBottom: Spacing.sm,
    borderRadius: 19,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.accent.cyan + '55',
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  scanInlineText: { fontFamily: FontFamily.mono, fontSize: 11, color: Colors.accent.cyan },
  incomeInlineBtn: {
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.accent.green + '55',
    backgroundColor: 'rgba(0, 255, 157, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  incomeInlineText: { fontFamily: FontFamily.mono, fontSize: 11, color: Colors.accent.green },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  sectionTitle: { color: Colors.text.muted, fontFamily: FontFamily.mono, fontSize: 12, letterSpacing: 1.5 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  categoryInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  categoryName: { color: Colors.text.primary, fontFamily: FontFamily.techSemi, fontSize: FontSize.sm },
  categoryTotal: { color: Colors.accent.cyan, fontFamily: FontFamily.mono, fontSize: FontSize.sm, fontWeight: '700' },
  separator: { height: 1, backgroundColor: Colors.border.subtle, marginHorizontal: Spacing.lg },
  dividerSection: { height: 1, backgroundColor: Colors.border.default, marginVertical: Spacing.md, marginHorizontal: Spacing.lg },
  transactionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.sm },
  transactionIcon: { width: 32, height: 32, borderRadius: BorderRadius.lg, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  transactionInfo: { flex: 1 },
  transactionDesc: { fontFamily: FontFamily.techSemi, fontSize: FontSize.sm, color: Colors.text.primary },
  transactionMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2, flexWrap: 'wrap' },
  transactionCategory: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.text.muted },
  transactionDate: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.text.muted, opacity: 0.6 },
  transactionAmount: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, fontWeight: '700' },
  transactionIncome: { color: Colors.accent.green },
  transactionExpense: { color: Colors.accent.red },
  iconAction: { padding: Spacing.xs, marginLeft: 2 },
  emptyText: { color: Colors.text.muted, textAlign: 'center', paddingVertical: Spacing.md, fontFamily: FontFamily.mono },
  floatingAction: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    backgroundColor: Colors.accent.green,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  floatingActionText: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.sm,
    color: '#000',
  },
});

export default FinancesOverviewPanel;
