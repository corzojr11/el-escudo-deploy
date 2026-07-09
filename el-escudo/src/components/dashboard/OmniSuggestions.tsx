import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';

export interface OmniSuggestion {
  icon: string;
  text: string;
}

export interface OmniSuggestionsProps {
  suggestions: OmniSuggestion[];
  title?: string;
  onSuggestionPress?: (suggestion: OmniSuggestion, index: number) => void;
}

export const OmniSuggestions: React.FC<OmniSuggestionsProps> = React.memo(({ suggestions, title = 'SUGERENCIAS DE NAVIR', onSuggestionPress }) => {
  if (suggestions.length === 0) return null;

  return (
    <>
      <Text style={styles.NAVIRSectionTitle}>{title}</Text>
      {suggestions.map((suggestion, index) => (
        <TouchableOpacity
          key={index}
          style={styles.NAVIRSuggestionCard}
          activeOpacity={0.85}
          onPress={onSuggestionPress ? () => onSuggestionPress(suggestion, index) : undefined}
          accessibilityRole={onSuggestionPress ? 'button' : undefined}
        >
          <View style={styles.NAVIRMain}>
            <View style={styles.NAVIRIconWrap}>
              <Ionicons name={suggestion.icon as any} size={18} color={Colors.accent.cyan} />
            </View>
            <Text style={styles.NAVIRSuggestionText}>{suggestion.text}</Text>
          </View>
          {onSuggestionPress && <Ionicons name="chevron-forward" size={14} color={Colors.text.muted} />}
        </TouchableOpacity>
      ))}
    </>
  );
});

const styles = StyleSheet.create({
  NAVIRSectionTitle: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.muted, letterSpacing: 1.5, marginHorizontal: Spacing.base, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  NAVIRSuggestionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.card, borderLeftWidth: 3, borderLeftColor: Colors.accent.cyan, borderTopWidth: 1, borderBottomWidth: 1, borderRightWidth: 1, borderColor: Colors.border.default, borderRadius: BorderRadius.lg, padding: Spacing.md, marginHorizontal: Spacing.base, marginBottom: Spacing.sm, gap: Spacing.md },
  NAVIRMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  NAVIRIconWrap: { width: 32, height: 32, borderRadius: BorderRadius.md, backgroundColor: Colors.accent.cyan + '15', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  NAVIRSuggestionText: { flex: 1, fontFamily: FontFamily.techRegular, fontSize: FontSize.sm, color: Colors.text.primary, lineHeight: 20 },
});


