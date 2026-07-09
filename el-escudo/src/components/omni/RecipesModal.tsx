import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';

export interface OmniRecipe {
  id: string;
  name: string;
  command_sequence: string;
  description?: string;
}

export interface RecipeFormState {
  name: string;
  command: string;
  description: string;
}

export interface RecipesModalProps {
  visible: boolean;
  recipes: OmniRecipe[];
  isLoading: boolean;
  isSubmitting: boolean;
  showForm: boolean;
  formState: RecipeFormState;
  onClose: () => void;
  onToggleForm: () => void;
  onFormChange: (field: keyof RecipeFormState, value: string) => void;
  onCreateRecipe: () => void;
  onUseRecipe: (command: string) => void;
  onDeleteRecipe: (recipe: OmniRecipe) => void;
}

const RecipeCard = ({
  item,
  onUseRecipe,
  onDelete,
}: {
  item: OmniRecipe;
  onUseRecipe: (command: string) => void;
  onDelete: (recipe: OmniRecipe) => void;
}) => (
  <View style={styles.recipeCard}>
    <TouchableOpacity style={styles.recipeCardMain} onPress={() => onUseRecipe(item.command_sequence)} activeOpacity={0.7}>
      <View style={styles.recipeCardIcon}>
        <Ionicons name="play" size={14} color={Colors.accent.green} />
      </View>
      <View style={styles.recipeCardInfo}>
        <Text style={styles.recipeCardName}>{item.name}</Text>
        {item.description ? <Text style={styles.recipeCardDesc} numberOfLines={1}>{item.description}</Text> : null}
        <View style={styles.recipeCardCommand}>
          <Ionicons name="terminal-outline" size={10} color={Colors.text.muted} />
          <Text style={styles.recipeCardCommandText} numberOfLines={1}>{item.command_sequence}</Text>
        </View>
      </View>
    </TouchableOpacity>
    <TouchableOpacity onPress={() => onDelete(item)} style={styles.recipeDeleteBtn} activeOpacity={0.6}>
      <Ionicons name="trash-outline" size={16} color={Colors.accent.red} />
    </TouchableOpacity>
  </View>
);

const RecipesFormPanel = ({
  showForm,
  formState,
  isSubmitting,
  onToggleForm,
  onFormChange,
  onCreateRecipe,
}: {
  showForm: boolean;
  formState: RecipeFormState;
  isSubmitting: boolean;
  onToggleForm: () => void;
  onFormChange: (field: keyof RecipeFormState, value: string) => void;
  onCreateRecipe: () => void;
}) => {
  if (!showForm) return null;

  // ponytail: plain form, no extra wrapper logic.
  const resetAndClose = () => {
    onFormChange('name', '');
    onFormChange('command', '');
    onFormChange('description', '');
    onToggleForm();
  };

  return (
    <View style={styles.recipeForm}>
      <Text style={styles.recipeInputLabel}>NOMBRE</Text>
      <TextInput
        style={styles.recipeInput}
        placeholder="Ej: anotar gasto rapido"
        placeholderTextColor={Colors.text.muted}
        value={formState.name}
        onChangeText={(text) => onFormChange('name', text)}
      />

      <Text style={styles.recipeInputLabel}>COMANDO</Text>
      <TextInput
        style={[styles.recipeInput, styles.recipeCommandInput]}
        placeholder="Ej: anotar gasto de almuerzo $15000"
        placeholderTextColor={Colors.text.muted}
        value={formState.command}
        onChangeText={(text) => onFormChange('command', text)}
        multiline
        numberOfLines={2}
      />

      <Text style={styles.recipeInputLabel}>DESCRIPCION (OPCIONAL)</Text>
      <TextInput
        style={[styles.recipeInput, styles.recipeCommandInput]}
        placeholder="Cuando quieres usar este atajo..."
        placeholderTextColor={Colors.text.muted}
        value={formState.description}
        onChangeText={(text) => onFormChange('description', text)}
        multiline
        numberOfLines={2}
      />

      <View style={styles.recipeFormActions}>
        <TouchableOpacity style={styles.recipeCancelBtn} onPress={resetAndClose}>
          <Text style={styles.recipeCancelText}>ATRAS</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.recipeSubmitBtn, isSubmitting && styles.recipeSubmitBtnDisabled]}
          onPress={onCreateRecipe}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={styles.recipeSubmitText}>GUARDAR</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const RecipesListPanel = ({
  recipes,
  isLoading,
  onUseRecipe,
  onDeleteRecipe,
}: {
  recipes: OmniRecipe[];
  isLoading: boolean;
  onUseRecipe: (command: string) => void;
  onDeleteRecipe: (recipe: OmniRecipe) => void;
}) => {
  if (isLoading) {
    return (
      <View style={styles.recipesLoadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent.green} />
        <Text style={styles.recipesLoadingText}>Cargando atajos...</Text>
      </View>
    );
  }

  if (recipes.length === 0) {
    return (
      <View style={styles.recipesEmptyContainer}>
        <Ionicons name="cube-outline" size={40} color={Colors.text.muted} />
        <Text style={styles.recipesEmptyText}>Aun no hay atajos</Text>
        <Text style={styles.recipesEmptySubtext}>Crea atajos para lo que repites seguido.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={recipes}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.recipesList}
      renderItem={({ item }) => <RecipeCard item={item} onUseRecipe={onUseRecipe} onDelete={onDeleteRecipe} />}
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      windowSize={5}
      removeClippedSubviews
    />
  );
};

export const RecipesModal: React.FC<RecipesModalProps> = ({
  visible,
  recipes,
  isLoading,
  isSubmitting,
  showForm,
  formState,
  onClose,
  onToggleForm,
  onFormChange,
  onCreateRecipe,
  onUseRecipe,
  onDeleteRecipe,
}) => {
  const handleDelete = (recipe: OmniRecipe) => {
    Alert.alert('Eliminar atajo', `Seguro que quieres borrar "${recipe.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => onDeleteRecipe(recipe),
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <Ionicons name="cube" size={18} color={Colors.accent.green} />
              <Text style={styles.modalTitle}>ATAJOS DE NAVIR</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.addRecipeBtn} onPress={onToggleForm} activeOpacity={0.7}>
              <Ionicons name={showForm ? 'close' : 'add'} size={16} color={Colors.accent.green} />
              <Text style={styles.addRecipeText}>{showForm ? 'ATRAS' : 'NUEVO ATAJO'}</Text>
            </TouchableOpacity>
          </View>

          <RecipesFormPanel
            showForm={showForm}
            formState={formState}
            isSubmitting={isSubmitting}
            onToggleForm={onToggleForm}
            onFormChange={onFormChange}
            onCreateRecipe={onCreateRecipe}
          />

          <RecipesListPanel
            recipes={recipes}
            isLoading={isLoading}
            onUseRecipe={onUseRecipe}
            onDeleteRecipe={handleDelete}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.bg.primary, borderTopLeftRadius: BorderRadius.xxl, borderTopRightRadius: BorderRadius.xxl, maxHeight: '85%', padding: Spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  modalTitle: { fontFamily: FontFamily.techSemi, fontSize: FontSize.md, color: Colors.text.primary, letterSpacing: 1 },
  modalActions: { marginBottom: Spacing.md },
  addRecipeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: 'rgba(0, 255, 157, 0.08)', borderWidth: 1, borderColor: Colors.accent.green + '30', borderRadius: BorderRadius.md, paddingVertical: Spacing.sm },
  addRecipeText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.accent.green, fontWeight: '700' },
  recipeForm: { backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.accent.green + '20', borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.md },
  recipeInputLabel: { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.text.muted, letterSpacing: 1 },
  recipeInput: { backgroundColor: Colors.bg.input, borderWidth: 1, borderColor: Colors.border.default, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: Colors.text.primary, fontFamily: FontFamily.mono, fontSize: FontSize.sm },
  recipeCommandInput: { minHeight: 60, textAlignVertical: 'top' },
  recipeFormActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  recipeCancelBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: BorderRadius.sm, paddingVertical: Spacing.sm, alignItems: 'center' },
  recipeCancelText: { color: Colors.text.muted, fontWeight: '700', fontFamily: FontFamily.mono, fontSize: FontSize.xs },
  recipeSubmitBtn: { flex: 1, backgroundColor: Colors.accent.green, borderRadius: BorderRadius.sm, paddingVertical: Spacing.sm, alignItems: 'center' },
  recipeSubmitBtnDisabled: { opacity: 0.6 },
  recipeSubmitText: { color: '#000', fontWeight: '800', fontFamily: FontFamily.mono, fontSize: FontSize.xs },
  recipesLoadingContainer: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  recipesLoadingText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.text.muted },
  recipesEmptyContainer: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  recipesEmptyText: { fontFamily: FontFamily.techSemi, fontSize: FontSize.md, color: Colors.text.muted },
  recipesEmptySubtext: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.text.muted, opacity: 0.6, textAlign: 'center' },
  recipesList: { gap: Spacing.sm },
  recipeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.border.default, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm },
  recipeCardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  recipeCardIcon: { width: 28, height: 28, borderRadius: BorderRadius.sm, backgroundColor: Colors.accent.green + '15', alignItems: 'center', justifyContent: 'center' },
  recipeCardInfo: { flex: 1 },
  recipeCardName: { fontFamily: FontFamily.techSemi, fontSize: FontSize.sm, color: Colors.text.primary },
  recipeCardDesc: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.muted, marginTop: 2 },
  recipeCardCommand: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  recipeCardCommandText: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.accent.cyan, flex: 1 },
  recipeDeleteBtn: { padding: Spacing.xs },
});
