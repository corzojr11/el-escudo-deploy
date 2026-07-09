import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { apiPost, apiDelete, apiPut } from '../api/requests';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAppStore, Transaction } from '../store';
import FinancesOverviewPanel from '../components/finances/FinancesOverviewPanel';

const EXPENSE_CATEGORIES = ['Comida', 'Transporte', 'Servicios', 'Entretenimiento', 'Salud', 'Educacion', 'Hogar', 'General'];
const INCOME_CATEGORIES = ['Sueldo', 'Pago trabajo', 'Extra', 'Venta', 'Otro'];

const isIncomeCategory = (category: string) => category === 'INGRESO' || category.startsWith('INGRESO:');
const getDisplayCategory = (category: string) => (category.startsWith('INGRESO:') ? category.replace('INGRESO:', '') : category);
const normalizeText = (v: string) => (v || '').toLowerCase().trim();
const suggestCategoryFromDescription = (description: string, fallback: string, type: 'GASTO' | 'INGRESO') => {
  const d = normalizeText(description);
  if (type === 'INGRESO') {
    if (d.includes('nomina') || d.includes('sueldo') || d.includes('abono')) return 'Sueldo';
    return fallback || 'Otro';
  }
  if (d.includes('uber') || d.includes('cabify') || d.includes('taxi') || d.includes('peaje') || d.includes('gasolina')) return 'Transporte';
  if (d.includes('d1') || d.includes('ara') || d.includes('exito') || d.includes('jumbo') || d.includes('mercado') || d.includes('restaurante')) return 'Comida';
  if (d.includes('netflix') || d.includes('spotify') || d.includes('cine')) return 'Entretenimiento';
  if (d.includes('eps') || d.includes('farmacia') || d.includes('clinica')) return 'Salud';
  if (d.includes('pse') || d.includes('qr') || d.includes('transfer')) return 'Servicios';
  return fallback || 'General';
};

const formatCOP = (val: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(val);

const buildExpenseSummary = (transactions: Transaction[]) => {
  const map = new Map<string, number>();
  transactions
    .filter((t) => t.tipo === 'GASTO')
    .forEach((t) => {
      const category = getDisplayCategory(t.categoria) || 'General';
      map.set(category, (map.get(category) || 0) + t.monto);
    });
  return Array.from(map.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
};

const commitTransactionsToStore = (nextTransactions: Transaction[]) => {
  const income = nextTransactions.reduce((sum, t) => sum + ((isIncomeCategory(t.categoria) || t.tipo === 'INGRESO') ? t.monto : 0), 0);
  const expense = nextTransactions.reduce((sum, t) => sum + ((isIncomeCategory(t.categoria) || t.tipo === 'INGRESO') ? 0 : t.monto), 0);
  useAppStore.setState({
    transactions: nextTransactions,
    financesSummary: buildExpenseSummary(nextTransactions),
    finances: { saldo: income - expense },
  });
};

const removeTransactionFromStore = (financeId: string) => {
  const current = useAppStore.getState().transactions || [];
  commitTransactionsToStore(current.filter((tx: Transaction) => tx.id !== financeId));
};

type PeriodFilter = 'MES' | '30D' | 'TODOS';

const FinancesScreen: React.FC = () => {
  const { transactions, hydrateStore } = useAppStore();

  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [formType, setFormType] = useState<'GASTO' | 'INGRESO'>('GASTO');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('General');
  const [receiptSource, setReceiptSource] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('MES');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await hydrateStore(true);
    setRefreshing(false);
  }, [hydrateStore]);

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter((t: Transaction) => {
      const d = new Date(t.fecha);
      if (periodFilter === 'TODOS') return true;
      if (periodFilter === '30D') return now.getTime() - d.getTime() <= 30 * 24 * 60 * 60 * 1000;
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [transactions, periodFilter]);

  const financeSummary = useMemo(() => {
    let income = 0;
    let expense = 0;
    const expenseMap = new Map<string, number>();
    const recent = [...filteredTransactions].sort((a: Transaction, b: Transaction) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    filteredTransactions.forEach((t: Transaction) => {
      const isIncome = isIncomeCategory(t.categoria) || t.tipo === 'INGRESO';
      if (isIncome) {
        income += t.monto;
        return;
      }

      expense += t.monto;
      const key = getDisplayCategory(t.categoria) || 'General';
      expenseMap.set(key, (expenseMap.get(key) || 0) + t.monto);
    });

    return {
      incomeTotal: income,
      expenseTotal: expense,
      availableBalance: income - expense,
      expenseSummary: Array.from(expenseMap.entries())
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total),
      recentTransactions: recent.slice(0, 30),
    };
  }, [filteredTransactions]);

  const { incomeTotal, expenseTotal, availableBalance, expenseSummary, recentTransactions } = financeSummary;

  const resetForm = useCallback(() => {
    setFormType('GASTO');
    setFormDescription('');
    setFormAmount('');
    setFormCategory('General');
    setEditingTransaction(null);
  }, []);

  const handleOpenCreateModal = useCallback(() => {
    resetForm();
    setReceiptSource(null);
    setModalVisible(true);
  }, [resetForm]);

  const handleOpenIncomeModal = useCallback(() => {
    resetForm();
    setReceiptSource(null);
    setFormType('INGRESO');
    setFormCategory('Sueldo');
    setModalVisible(true);
  }, [resetForm]);

  const handleOpenEditModal = useCallback((tx: Transaction) => {
    setEditingTransaction(tx);
    const inferredType: 'GASTO' | 'INGRESO' = isIncomeCategory(tx.categoria) || tx.tipo === 'INGRESO' ? 'INGRESO' : 'GASTO';
    setFormType(inferredType);
    setFormDescription(tx.descripcion);
    setFormAmount(String(tx.monto));
    setFormCategory(getDisplayCategory(tx.categoria));
    setReceiptSource(null);
    setModalVisible(true);
  }, []);

  const handleScanReceipt = async () => {
    const choice = await new Promise<'camera' | 'gallery' | 'cancel'>((resolve) => {
      Alert.alert('Escanear comprobante', 'Elige origen del comprobante', [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve('cancel') },
        { text: 'Camara', onPress: () => resolve('camera') },
        { text: 'Galeria', onPress: () => resolve('gallery') },
      ]);
    });

    if (choice === 'cancel') return;

    try {
      const permission = choice === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Permiso requerido', 'Necesitamos permiso para acceder al comprobante.');
        return;
      }

      const result = choice === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: false, base64: true });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const uri = asset.uri;
      resetForm();
      setFormType('GASTO');
      setFormDescription('Comprobante escaneado');
      setFormCategory('General');
      setReceiptSource(uri);
      setModalVisible(true);

      const openManualFallback = (message?: string) => {
        const fallbackDescription = asset.fileName ? `Comprobante ${asset.fileName}` : 'Comprobante escaneado';
        setFormType('GASTO');
        setFormAmount('');
        setFormDescription(fallbackDescription);
        setFormCategory(suggestCategoryFromDescription(fallbackDescription, 'General', 'GASTO'));
        if (message) {
          Alert.alert('Escaneo incompleto', message);
        }
      };

      if (asset.base64) {
        try {
          const parseRes = await apiPost('/api/v1/finances/parse-receipt', {
            image_base64: asset.base64,
            mime_type: asset.mimeType || 'image/jpeg',
          });
          if (parseRes.ok) {
            const parsed = await parseRes.json();
            const nextType: 'INGRESO' | 'GASTO' = parsed.type === 'INGRESO' ? 'INGRESO' : 'GASTO';
            const parsedDescription = parsed.description || 'Comprobante escaneado';
            const parsedCategory = suggestCategoryFromDescription(
              parsedDescription,
              parsed.category || (nextType === 'INGRESO' ? 'Sueldo' : 'General'),
              nextType
            );
            setFormType(nextType);
            setFormAmount(parsed.amount ? String(parsed.amount) : '');
            setFormDescription(parsedDescription);
            setFormCategory(parsedCategory);
          } else {
            const errorData = await parseRes.json().catch(() => ({}));
            openManualFallback(errorData.detail || 'No pude leer el comprobante. Completa los campos manualmente.');
          }
        } catch {
          openManualFallback('No pude procesar la imagen. Completa el comprobante manualmente.');
        }
      } else {
        openManualFallback('La imagen no trajo base64. Completa el comprobante manualmente.');
      }
    } catch {
      Alert.alert('Error', 'No se pudo abrir el escaner de comprobantes.');
    }
  };

  const handleDelete = useCallback((financeId: string, description: string) => {
    Alert.alert('Confirmar eliminacion', `Eliminar "${description}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await apiDelete(`/api/v1/finances/${financeId}`);
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              Alert.alert('Error', errorData.detail || 'No se pudo eliminar el movimiento.');
              return;
            }
            removeTransactionFromStore(financeId);
            Alert.alert('Exito', 'Movimiento eliminado.');
          } catch {
            Alert.alert('Error', 'No se pudo conectar con el servidor.');
          }
        },
      },
    ]);
  }, [hydrateStore]);

  const handleSubmit = async () => {
    if (!formDescription.trim() || !formAmount.trim()) {
      Alert.alert('Campos requeridos', 'Completa descripcion y monto.');
      return;
    }

    const amount = parseFloat(formAmount.replace(/,/g, '.'));
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Monto invalido', 'Ingresa un monto mayor a 0.');
      return;
    }

    setSubmitting(true);
    try {
      const duplicate = transactions.find((t: Transaction) => {
        const sameType = (isIncomeCategory(t.categoria) || t.tipo === 'INGRESO') === (formType === 'INGRESO');
        const sameAmount = Math.abs(t.monto - amount) < 1;
        const sameDesc = normalizeText(t.descripcion) === normalizeText(formDescription);
        const txTime = new Date(t.fecha).getTime();
        const within48h = Math.abs(Date.now() - txTime) <= 48 * 60 * 60 * 1000;
        return sameType && sameAmount && sameDesc && within48h;
      });
      if (!editingTransaction && duplicate) {
        Alert.alert(
          'Posible duplicado',
          'Este movimiento parece ya registrado en las ultimas 48h.',
          [
            { text: 'Cancelar', style: 'cancel', onPress: () => setSubmitting(false) },
            {
              text: 'Forzar guardado',
              onPress: async () => {
                try {
                  const body = {
                    description: formDescription.trim(),
                    amount,
                    type: formType,
                    category: formType === 'INGRESO' ? `INGRESO:${formCategory}` : formCategory,
                  };
                  const response = await apiPost('/api/v1/finances', body);
                  if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    Alert.alert('Error', errorData.detail || 'No se pudo guardar el movimiento.');
                    setSubmitting(false);
                    return;
                  }
                  const nextTransaction: Transaction = {
                    id: `${Date.now()}`,
                    monto: amount,
                    descripcion: formDescription.trim(),
                    categoria: formType === 'INGRESO' ? `INGRESO:${formCategory}` : formCategory,
                    tipo: formType,
                    fecha: new Date(),
                  };
                  commitTransactionsToStore([nextTransaction, ...transactions]);
                  Alert.alert('Exito', 'Movimiento registrado.');
                  setModalVisible(false);
                  resetForm();
                } catch {
                  Alert.alert('Error', 'No se pudo conectar con el servidor.');
                } finally {
                  setSubmitting(false);
                }
              },
            },
          ]
        );
        setSubmitting(false);
        return;
      }

      const body = {
        description: formDescription.trim(),
        amount,
        type: formType,
        category: formType === 'INGRESO' ? `INGRESO:${formCategory}` : formCategory,
      };

      const response = editingTransaction
        ? await apiPut(`/api/v1/finances/${editingTransaction.id}`, body)
        : await apiPost('/api/v1/finances', body);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        Alert.alert('Error', errorData.detail || 'No se pudo guardar el movimiento.');
        return;
      }

      const nextTransaction: Transaction = {
        id: editingTransaction?.id || `${Date.now()}`,
        monto: amount,
        descripcion: formDescription.trim(),
        categoria: formType === 'INGRESO' ? `INGRESO:${formCategory}` : formCategory,
        tipo: formType,
        fecha: editingTransaction?.fecha || new Date(),
      };
      const nextTransactions = editingTransaction
        ? transactions.map((tx) => (tx.id === editingTransaction.id ? nextTransaction : tx))
        : [nextTransaction, ...transactions];
      commitTransactionsToStore(nextTransactions);
      Alert.alert('Exito', editingTransaction ? 'Movimiento actualizado.' : 'Movimiento registrado.');
      setModalVisible(false);
      resetForm();
    } catch {
      Alert.alert('Error', 'No se pudo conectar con el servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.canvas}>
      <SafeAreaView style={styles.shell} edges={['top']}>
        <ScreenHeader title="FINANZAS" />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accent.green}
              colors={[Colors.accent.green]}
              progressBackgroundColor={Colors.bg.primary}
            />
          }
        >
          <FinancesOverviewPanel
            availableBalance={availableBalance}
            incomeTotal={incomeTotal}
            expenseTotal={expenseTotal}
            periodFilter={periodFilter}
            expenseSummary={expenseSummary}
            recentTransactions={recentTransactions}
            formatCOP={formatCOP}
            getDisplayCategory={getDisplayCategory}
            onChangePeriodFilter={setPeriodFilter}
            onScanReceipt={handleScanReceipt}
            onEditTransaction={handleOpenEditModal}
            onDeleteTransaction={(tx) => handleDelete(tx.id, tx.descripcion)}
            onCreateTransaction={handleOpenCreateModal}
            onCreateIncome={handleOpenIncomeModal}
          />
        </ScrollView>
      </SafeAreaView>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingTransaction ? 'EDITAR MOVIMIENTO' : 'REGISTRAR MOVIMIENTO'}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={Colors.text.muted} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalForm}>
                <Text style={styles.inputLabel}>TIPO</Text>
                <View style={styles.typeRow}>
                  <TouchableOpacity style={[styles.typeChip, formType === 'GASTO' && styles.typeChipActive]} onPress={() => { setFormType('GASTO'); setFormCategory('General'); }}>
                    <Text style={[styles.typeChipText, formType === 'GASTO' && styles.typeChipTextActive]}>Gasto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.typeChip, formType === 'INGRESO' && styles.typeChipActive]} onPress={() => { setFormType('INGRESO'); setFormCategory('Sueldo'); }}>
                    <Text style={[styles.typeChipText, formType === 'INGRESO' && styles.typeChipTextActive]}>Ingreso</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>DESCRIPCION</Text>
                <TextInput style={styles.input} placeholder="Ej: Pago quincena" placeholderTextColor={Colors.text.muted} value={formDescription} onChangeText={setFormDescription} />
                {!!receiptSource && <Text style={styles.receiptHint}>Comprobante cargado listo para registrar.</Text>}

                <Text style={styles.inputLabel}>MONTO (COP)</Text>
                <TextInput style={styles.input} placeholder="Ej: 1200000" placeholderTextColor={Colors.text.muted} value={formAmount} onChangeText={setFormAmount} keyboardType="numeric" />

                <Text style={styles.inputLabel}>CATEGORIA</Text>
                <View style={styles.categoryGrid}>
                  {(formType === 'INGRESO' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((cat) => (
                    <TouchableOpacity key={cat} style={[styles.categoryChip, formCategory === cat && styles.categoryChipActive]} onPress={() => setFormCategory(cat)}>
                      <Text style={[styles.categoryChipText, formCategory === cat && styles.categoryChipTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={[styles.submitButton, submitting && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.7}>
                  {submitting ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.submitButtonText}>{editingTransaction ? 'GUARDAR CAMBIOS' : `GUARDAR ${formType}`}</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: '#09090B' },
  shell: { flex: 1, ...(Platform.OS === 'web' ? { maxWidth: 500, width: '100%', alignSelf: 'center' } : {}) },
  scrollContent: { paddingBottom: 220 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  modalBackdrop: { backgroundColor: Colors.bg.secondary, borderTopLeftRadius: BorderRadius.lg, borderTopRightRadius: BorderRadius.lg, maxHeight: '85%' },
  modalCard: { borderTopLeftRadius: BorderRadius.lg, borderTopRightRadius: BorderRadius.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border.default },
  modalTitle: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.accent.green, letterSpacing: 1.5 },
  closeButton: { padding: 4 },
  modalForm: { padding: Spacing.lg, gap: Spacing.md },
  inputLabel: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.muted, letterSpacing: 1 },
  input: { backgroundColor: Colors.bg.input, borderWidth: 1, borderColor: Colors.border.default, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: Colors.text.primary, fontFamily: FontFamily.mono, fontSize: FontSize.sm },
  receiptHint: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.accent.cyan },
  typeRow: { flexDirection: 'row', gap: Spacing.sm },
  typeChip: { flex: 1, borderWidth: 1, borderColor: Colors.border.default, borderRadius: BorderRadius.sm, paddingVertical: Spacing.sm, alignItems: 'center', backgroundColor: Colors.bg.input },
  typeChipActive: { borderColor: Colors.accent.green, backgroundColor: 'rgba(0, 255, 157, 0.1)' },
  typeChipText: { fontFamily: FontFamily.mono, color: Colors.text.muted, fontSize: FontSize.xs },
  typeChipTextActive: { color: Colors.accent.green },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  categoryChip: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border.default, backgroundColor: Colors.bg.input },
  categoryChipActive: { borderColor: Colors.accent.green, backgroundColor: 'rgba(0, 255, 157, 0.1)' },
  categoryChipText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.text.muted },
  categoryChipTextActive: { color: Colors.accent.green },
  submitButton: { backgroundColor: Colors.accent.green, borderRadius: BorderRadius.sm, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: '#000', fontWeight: '800', letterSpacing: 1 },
});

export default FinancesScreen;
