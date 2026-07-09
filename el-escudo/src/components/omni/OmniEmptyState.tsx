import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';

type QuickRecipe = {
  id: string;
  name: string;
  icon: string;
  command: string;
  color: string;
  category: 'trabajo' | 'finanzas' | 'salud';
};

interface OmniEmptyStateProps {
  userName?: string;
  showQuickRecipes: boolean;
  onHideQuickRecipes: () => void;
  onExecuteCommand: (command: string) => void;
  onOpenSection: (section: 'Estado' | 'Finanzas' | 'Turnos' | 'Salud' | 'Mas') => void;
}

const QUICK_ACTIONS = [
  { label: 'Anotar gasto', icon: 'wallet', command: 'Registrar gasto' },
  { label: 'Registrar peso', icon: 'barbell', command: 'Actualizar mi peso' },
  { label: 'Agregar turno', icon: 'calendar', command: 'Agregar nuevo turno' },
];

const QUICK_RECIPES: QuickRecipe[] = [
  { id: 'night_shift', name: 'Noche', icon: 'moon-outline', command: 'registrar turno noche 22:00 06:00', color: Colors.accent.purple, category: 'trabajo' },
  { id: 'day_shift', name: 'Día', icon: 'sunny-outline', command: 'registrar turno dia 06:00 14:00', color: Colors.accent.orange, category: 'trabajo' },
  { id: 'finances_month', name: 'Dinero', icon: 'cash-outline', command: 'resumen financiero mensual', color: Colors.accent.green, category: 'finanzas' },
  { id: 'weight_log', name: 'Peso', icon: 'fitness-outline', command: 'registrar peso', color: Colors.accent.cyan, category: 'salud' },
  { id: 'sleep_optimizer', name: 'Sueño', icon: 'bed-outline', command: 'optimizar sueno', color: Colors.accent.indigo, category: 'salud' },
];

const RECIPE_CATEGORIES = [
  { key: 'trabajo', label: 'TRABAJO' },
  { key: 'finanzas', label: 'FINANZAS' },
  { key: 'salud', label: 'SALUD' },
] as const;

const OmniEmptyState: React.FC<OmniEmptyStateProps> = ({
  userName,
  showQuickRecipes,
  onHideQuickRecipes,
  onExecuteCommand,
  onOpenSection,
}) => {
  return (
    <View style={styles.emptyStateBlock}>
      <View>
        <View style={styles.welcomeContainer}>
          <Ionicons name="shield-checkmark" size={14} color={Colors.accent.green} />
          <Text style={styles.welcomeTitle}>Navir listo</Text>
        </View>
        <Text style={styles.welcomeSubtitle}>
          {userName ? `Hola, ${userName}.` : 'Bienvenido.'} ¿Qué quieres hacer hoy?
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsRow}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity key={action.label} style={styles.quickChip} onPress={() => onExecuteCommand(action.command)} activeOpacity={0.7}>
              <Ionicons name={action.icon as any} size={12} color={Colors.accent.green} />
              <Text style={styles.quickChipText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.quickNavBlock}>
        <Text style={styles.quickNavTitle}>ABRIR SECCIÓN</Text>
        <View style={styles.quickNavRow}>
          <TouchableOpacity style={styles.quickNavChip} onPress={() => onOpenSection('Estado')} activeOpacity={0.75}>
            <Ionicons name="grid-outline" size={12} color={Colors.accent.cyan} />
            <Text style={styles.quickNavText}>Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickNavChip} onPress={() => onOpenSection('Finanzas')} activeOpacity={0.75}>
            <Ionicons name="card-outline" size={12} color={Colors.accent.green} />
            <Text style={styles.quickNavText}>Finanzas</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickNavChip} onPress={() => onOpenSection('Turnos')} activeOpacity={0.75}>
            <Ionicons name="time-outline" size={12} color={Colors.accent.indigo} />
            <Text style={styles.quickNavText}>Turnos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickNavChip} onPress={() => onOpenSection('Salud')} activeOpacity={0.75}>
            <Ionicons name="barbell-outline" size={12} color={Colors.accent.orange} />
            <Text style={styles.quickNavText}>Salud</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickNavChip} onPress={() => onOpenSection('Mas')} activeOpacity={0.75}>
            <Ionicons name="apps-outline" size={12} color={Colors.accent.purple} />
            <Text style={styles.quickNavText}>Más</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showQuickRecipes && (
        <View style={styles.quickRecipesInline}>
          <View style={styles.quickRecipesHeader}>
            <Text style={styles.quickRecipesTitle}>ATAJOS</Text>
            <TouchableOpacity onPress={onHideQuickRecipes}>
              <Ionicons name="close" size={16} color={Colors.text.muted} />
            </TouchableOpacity>
          </View>

          {RECIPE_CATEGORIES.map((cat) => {
            const catRecipes = QUICK_RECIPES.filter((r) => r.category === cat.key);
            if (catRecipes.length === 0) return null;

            return (
              <View key={cat.key} style={styles.recipeCategorySection}>
                <Text style={styles.recipeCategoryLabel}>{cat.label}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRecipesRow} nestedScrollEnabled>
                  {catRecipes.map((recipe) => (
                    <TouchableOpacity
                      key={recipe.id}
                      onPress={() => onExecuteCommand(recipe.command)}
                      style={[styles.quickRecipeChip, { borderColor: recipe.color + '40' }]}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={recipe.icon as any} size={14} color={recipe.color} />
                      <Text style={[styles.quickRecipeText, { color: recipe.color }]}>{recipe.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  emptyStateBlock: { paddingBottom: Spacing.sm },
  welcomeContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.base, paddingTop: Spacing.md, paddingBottom: Spacing.xs },
  welcomeTitle: { fontFamily: FontFamily.techSemi, fontSize: FontSize.sm, color: Colors.accent.green, letterSpacing: 1 },
  welcomeSubtitle: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.text.muted, paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  quickActionsRow: { paddingHorizontal: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.md },
  quickChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0, 255, 157, 0.06)', borderWidth: 1, borderColor: Colors.accent.green + '25', borderRadius: 20, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  quickChipText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.accent.green },
  quickRecipesInline: {
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRadius: 16,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    marginHorizontal: Spacing.base,
    maxHeight: 190,
  },
  quickNavBlock: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
    gap: Spacing.xs,
  },
  quickNavTitle: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.text.muted,
    letterSpacing: 1.4,
  },
  quickNavRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  quickNavChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: 20,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  quickNavText: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.text.primary,
  },
  quickRecipesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  quickRecipesTitle: { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.text.muted, letterSpacing: 1.5 },
  quickRecipesRow: { gap: Spacing.xs, paddingBottom: Spacing.sm },
  quickRecipeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, borderRadius: 20, borderWidth: 1, backgroundColor: Colors.bg.secondary },
  quickRecipeText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, fontWeight: '600' },
  recipeCategorySection: { marginBottom: Spacing.xs },
  recipeCategoryLabel: { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.text.muted, letterSpacing: 1.5, marginBottom: 6, marginLeft: 4 },
});

export default React.memo(OmniEmptyState);
