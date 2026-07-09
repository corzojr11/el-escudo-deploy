import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { useAppStore, ActionLog } from '../store';
import { apiGet, apiPost, apiDelete } from '../api/requests';
import { ToastNotification } from '../components/ToastNotification';
import { ErrorState } from '../components/ErrorState';
import { LogEntry, TypingIndicator } from '../components/omni/LogEntry';
import { CommandInput } from '../components/omni/CommandInput';
import { ActionConfirmPanel } from '../components/omni/ActionConfirmPanel';
import { OmniHeader, RecipesModal, OmniRecipe } from '../components/omni';
import OmniEmptyState from '../components/omni/OmniEmptyState';
import { OmniRecipeListResponse } from '../types/api';

type ChatListProps = {
  logs: ActionLog[];
  isProcessing: boolean;
  onRenderItem: ({ item }: { item: ActionLog }) => React.ReactElement;
  onKeyExtractor: (item: ActionLog) => string;
  onEmptyState: () => React.ReactElement;
  listRef: React.RefObject<FlatList<ActionLog> | null>;
  chatContentStyle: any;
  isWeb: boolean;
};

const ChatList = React.memo(({ logs, isProcessing, onRenderItem, onKeyExtractor, onEmptyState, listRef, chatContentStyle }: ChatListProps) => (
  <FlatList
    ref={listRef}
    style={styles.chatArea}
    contentContainerStyle={chatContentStyle}
    data={logs}
    renderItem={onRenderItem}
    keyExtractor={onKeyExtractor}
    showsVerticalScrollIndicator={false}
    ListEmptyComponent={onEmptyState}
    ListFooterComponent={isProcessing ? TypingIndicator : null}
    maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
    initialNumToRender={8}
    maxToRenderPerBatch={8}
    windowSize={4}
    removeClippedSubviews
  />
));

const OmniChatScreen: React.FC = () => {
  const isWeb = Platform.OS === 'web';
  const { height: windowHeight } = useWindowDimensions();
  const webViewportMinHeight = Math.max(560, windowHeight - 76);
  const keyboardBehavior = Platform.OS === 'ios' ? 'padding' : undefined;
  const navigation = useNavigation<any>();

  const [input, setInput] = useState('');
  const [hasError, setHasError] = useState(false);
  const [showRecipes, setShowRecipes] = useState(false);
  const [showQuickRecipes, setShowQuickRecipes] = useState(true);
  const [recipes, setRecipes] = useState<OmniRecipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipeSubmitting, setRecipeSubmitting] = useState(false);
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [recipeForm, setRecipeForm] = useState({ name: '', command: '', description: '' });

  const flatListRef = useRef<FlatList<ActionLog>>(null);

  const logs = useAppStore((state) => state.logs);
  const isProcessing = useAppStore((state) => state.isProcessing);
  const aiCostCop = useAppStore((state) => state.aiCostCop);
  const toast = useAppStore((state) => state.toast) ?? { visible: false, message: '' };
  const processCommandWithAI = useAppStore((state) => state.processCommandWithAI);
  const loadOmniMessages = useAppStore((state) => state.loadOmniMessages);
  const pendingAction = useAppStore((state) => state.pendingAction);
  const confirmPendingAction = useAppStore((state) => state.confirmPendingAction);
  const cancelPendingAction = useAppStore((state) => state.cancelPendingAction);
  const userProfile = useAppStore((state) => state.userProfile);

  const fetchRecipes = useCallback(async () => {
    setRecipesLoading(true);
    try {
      const res = await apiGet('/api/v1/omni/recipes');
      if (res.ok) {
        const data: OmniRecipeListResponse = await res.json();
        setRecipes(Array.isArray(data) ? data : data.data || data.recipes || []);
      }
    } catch (e) {
      console.error('Error fetching recipes:', e);
    } finally {
      setRecipesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (logs.length > 0) return;
    void loadOmniMessages().catch((e) => {
      console.error('Error loading OMNI history:', e);
    });
  }, [logs.length, loadOmniMessages]);

  useEffect(() => {
    if (showRecipes) fetchRecipes();
  }, [fetchRecipes, showRecipes]);

  useEffect(() => {
    if (flatListRef.current && logs.length > 0) {
      const timer = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 60);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [logs.length, isProcessing]);

  const chatLogs = logs
    .filter((log) => log.category !== 'ERROR')
    .slice(0, 50)
    .reverse();

  const handleExecute = useCallback(async (text?: string) => {
    const textToProcess = (text || input).trim();
    if (!textToProcess || isProcessing) return;
    setInput('');
    try {
      setHasError(false);
      await processCommandWithAI(textToProcess);
    } catch {
      setHasError(true);
    }
  }, [input, isProcessing, processCommandWithAI]);

  const executeQuickCommand = useCallback(async (command: string) => {
    setShowQuickRecipes(false);
    await handleExecute(command);
  }, [handleExecute]);

  const handleToggleRecipes = useCallback(() => {
    setShowRecipes((value) => !value);
  }, []);

  const handleCloseRecipes = useCallback(() => {
    setShowRecipes(false);
  }, []);

  const handleHideQuickRecipes = useCallback(() => {
    setShowQuickRecipes(false);
  }, []);

  const handleToggleRecipeForm = useCallback(() => {
    setShowRecipeForm((value) => !value);
  }, []);

  const handleRecipeFormChange = useCallback(
    (field: keyof typeof recipeForm, value: string) => {
      setRecipeForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleUseRecipe = useCallback(
    (command: string) => {
      setShowRecipes(false);
      void handleExecute(command);
    },
    [handleExecute]
  );

  const openSection = useCallback((section: 'Estado' | 'Finanzas' | 'Turnos' | 'Salud' | 'Mas') => {
    setShowRecipes(false);
    navigation.navigate(section);
  }, [navigation]);

  const suggestSectionFromText = useCallback((text: string) => {
    const value = text.toLowerCase();
    if (value.includes('gasto') || value.includes('ingreso') || value.includes('saldo') || value.includes('factura') || value.includes('pagar')) return 'Finanzas';
    if (value.includes('turno') || value.includes('horario') || value.includes('sueño') || value.includes('sueno') || value.includes('dorm') || value.includes('descanso')) return 'Turnos';
    if (value.includes('peso') || value.includes('gym') || value.includes('rutina') || value.includes('ejercicio') || value.includes('salud')) return 'Salud';
    if (value.includes('meta') || value.includes('proyecto') || value.includes('tarea') || value.includes('hábito') || value.includes('habito')) return 'Estado';
    if (value.includes('ranking') || value.includes('clan') || value.includes('reto')) return 'Mas';
    return null;
  }, []);

  const inlineSectionSuggestion = suggestSectionFromText(input.trim());
  const inlineSectionSuggestionLabel = inlineSectionSuggestion
    ? ({
        Estado: 'Ver dashboard',
        Finanzas: 'Abrir finanzas',
        Turnos: 'Ir a turnos',
        Salud: 'Abrir salud',
        Mas: 'Abrir m?s',
      } as const)[inlineSectionSuggestion]
    : null;

  const handleCreateRecipe = async () => {
    if (!recipeForm.name.trim() || !recipeForm.command.trim()) {
      Alert.alert('Error', 'Nombre y comando son obligatorios.');
      return;
    }
    setRecipeSubmitting(true);
    try {
      const res = await apiPost('/api/v1/omni/recipes', {
        name: recipeForm.name.trim(),
        command_sequence: recipeForm.command.trim(),
        description: recipeForm.description.trim() || undefined,
      });
      if (res.ok) {
        await fetchRecipes();
        setRecipeForm({ name: '', command: '', description: '' });
        setShowRecipeForm(false);
        Alert.alert('Exito', 'Receta creada correctamente.');
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Error', err.detail || 'No se pudo crear la receta.');
      }
    } catch {
      Alert.alert('Error de conexion', 'No se pudo conectar con el servidor.');
    } finally {
      setRecipeSubmitting(false);
    }
  };

  const handleDeleteRecipe = async (recipe: OmniRecipe) => {
    try {
      const res = await apiDelete(`/api/v1/omni/recipes/${recipe.id}`);
      if (res.ok) {
        await fetchRecipes();
        Alert.alert('Exito', 'Receta eliminada.');
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Error', err.detail || 'No se pudo eliminar.');
      }
    } catch {
      Alert.alert('Error de conexion', 'No se pudo conectar con el servidor.');
    }
  };

  const renderEmptyState = useCallback(
    () => (
      <OmniEmptyState
        userName={userProfile?.name}
        showQuickRecipes={showQuickRecipes}
        onHideQuickRecipes={handleHideQuickRecipes}
        onExecuteCommand={executeQuickCommand}
        onOpenSection={openSection}
      />
    ),
    [executeQuickCommand, handleHideQuickRecipes, openSection, showQuickRecipes, userProfile?.name]
  );

  const renderChatItem = useCallback(({ item }: { item: ActionLog }) => <LogEntry log={item} />, []);
  const keyExtractor = useCallback((item: ActionLog) => item.id, []);
  return (
    <SafeAreaView style={[styles.shell, isWeb && styles.shellWeb]} edges={['top']}>
      <View style={[styles.viewport, isWeb && styles.viewportWeb, isWeb && { minHeight: webViewportMinHeight }] }>
        {hasError ? (
          <ErrorState
            message="NAVIR no pudo procesar tu comando. Verifica tu conexion e intenta nuevamente."
            onRetry={() => {
              setHasError(false);
              if (input.trim()) handleExecute();
            }}
          />
        ) : (
          <>
            <OmniHeader aiCostCop={aiCostCop} onToggleRecipes={handleToggleRecipes} />

            <KeyboardAvoidingView style={styles.keyboardShell} behavior={keyboardBehavior}>
              <ChatList
                listRef={flatListRef}
                logs={chatLogs}
                isProcessing={isProcessing}
                onRenderItem={renderChatItem}
                onKeyExtractor={keyExtractor}
                onEmptyState={renderEmptyState}
                chatContentStyle={[styles.chatContent, chatLogs.length === 0 && styles.chatContentEmpty, isWeb && styles.chatContentWebPad]}
                isWeb={isWeb}
              />

              {pendingAction && (
                <ActionConfirmPanel
                  action={'mode' in pendingAction ? undefined : pendingAction}
                  actions={'mode' in pendingAction ? pendingAction.actions : undefined}
                  onConfirm={confirmPendingAction}
                  onCancel={cancelPendingAction}
                  isProcessing={isProcessing}
                />
              )}

              <CommandInput
                value={input}
                onChangeText={setInput}
                onSubmit={(text) => handleExecute(text)}
                onToggleRecipes={() => setShowQuickRecipes(true)}
                showRecipes={showQuickRecipes}
                isProcessing={isProcessing}
                suggestion={inlineSectionSuggestion && inlineSectionSuggestionLabel ? {
                  label: inlineSectionSuggestionLabel,
                  onPress: () => openSection(inlineSectionSuggestion),
                } : null}
              />
            </KeyboardAvoidingView>

            <RecipesModal
              visible={showRecipes}
              recipes={recipes}
              isLoading={recipesLoading}
              isSubmitting={recipeSubmitting}
              showForm={showRecipeForm}
              formState={recipeForm}
              onClose={handleCloseRecipes}
              onToggleForm={handleToggleRecipeForm}
              onFormChange={handleRecipeFormChange}
              onCreateRecipe={handleCreateRecipe}
              onUseRecipe={handleUseRecipe}
              onDeleteRecipe={handleDeleteRecipe}
            />

            <ToastNotification message={toast.message} visible={toast.visible} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#0A0A0B' },
  shellWeb: { backgroundColor: '#070708' },
  viewport: { flex: 1, width: '100%' },
  viewportWeb: {
    maxWidth: 500,
    alignSelf: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: '#0A0A0B',
  },
  keyboardShell: { flex: 1 },
  chatArea: { flex: 1 },
  chatContent: { padding: Spacing.base, gap: 8 },
  chatContentWebPad: { paddingBottom: 96 },
  chatContentEmpty: { flexGrow: 1, justifyContent: 'flex-start' },
});

export default React.memo(OmniChatScreen);

