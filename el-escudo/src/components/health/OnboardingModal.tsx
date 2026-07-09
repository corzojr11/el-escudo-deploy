import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { useAppStore } from '../../store';

/**
 * OnboardingModal — Health profile setup form for initial body measurements.
 *
 * Collects the user's baseline physical data (height, weight, body measurements)
 * and submits it to the Zustand store via `completeHealthOnboarding`. Sets default
 * objectives to "Ganar Masa Muscular" and "Fuerza Base".
 *
 * Fields collected:
 * - Height (meters)
 * - Current weight (kg)
 * - Chest circumference (cm)
 * - Arms circumference (cm)
 * - Waist circumference (cm)
 * - Legs circumference (cm)
 *
 * @component
 * @example
 * ```tsx
 * <OnboardingModal />
 * ```
 */
const OnboardingModal: React.FC = () => {
  const completeHealthOnboarding = useAppStore(state => state.completeHealthOnboarding);
  
  const [height, setHeight] = useState('1.74');
  const [weight, setWeight] = useState('55');
  const [chest, setChest] = useState('');
  const [arms, setArms] = useState('');
  const [waist, setWaist] = useState('');
  const [legs, setLegs] = useState('');

  const handleSave = () => {
    completeHealthOnboarding({
      height: parseFloat(height) || 1.74,
      weight: parseFloat(weight) || 55,
      measures: {
        chest: parseFloat(chest) || 0,
        arms: parseFloat(arms) || 0,
        waist: parseFloat(waist) || 0,
        legs: parseFloat(legs) || 0,
      },
      objectives: ['Ganar Masa Muscular', 'Fuerza Base'],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Calibración Física</Text>
        <Text style={styles.subtitle}>Introduce tus medidas base para calcular la hipertrofia.</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Estatura (m)</Text>
          <TextInput style={styles.input} value={height} onChangeText={setHeight} keyboardType="decimal-pad" placeholderTextColor={Colors.text.muted} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Peso Actual (kg)</Text>
          <TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholderTextColor={Colors.text.muted} />
        </View>

        <Text style={styles.sectionHeader}>Medidas Corporales (cm)</Text>
        
        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Pecho</Text>
            <TextInput style={styles.input} value={chest} onChangeText={setChest} keyboardType="decimal-pad" placeholder="Ej. 90" placeholderTextColor={Colors.text.muted}/>
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Brazos</Text>
            <TextInput style={styles.input} value={arms} onChangeText={setArms} keyboardType="decimal-pad" placeholder="Ej. 30" placeholderTextColor={Colors.text.muted}/>
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Cintura</Text>
            <TextInput style={styles.input} value={waist} onChangeText={setWaist} keyboardType="decimal-pad" placeholder="Ej. 75" placeholderTextColor={Colors.text.muted}/>
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Piernas</Text>
            <TextInput style={styles.input} value={legs} onChangeText={setLegs} keyboardType="decimal-pad" placeholder="Ej. 50" placeholderTextColor={Colors.text.muted}/>
          </View>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleSave}>
          <Text style={styles.buttonText}>INICIAR TRACKER</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  scroll: { padding: Spacing.xl, paddingBottom: 100 },
  title: { fontFamily: FontFamily.tech, fontSize: FontSize.xxl, color: Colors.text.primary, marginBottom: 4 },
  subtitle: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.text.muted, marginBottom: Spacing.xl },
  sectionHeader: { fontFamily: FontFamily.techSemi, fontSize: FontSize.md, color: Colors.text.secondary, marginTop: Spacing.md, marginBottom: Spacing.sm },
  inputGroup: { marginBottom: Spacing.md },
  label: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.text.muted, textTransform: 'uppercase', marginBottom: 4 },
  input: { backgroundColor: Colors.bg.input, borderWidth: 1, borderColor: Colors.border.default, borderRadius: BorderRadius.md, color: Colors.text.primary, padding: Spacing.md, fontFamily: FontFamily.techSemi },
  row: { flexDirection: 'row', gap: Spacing.md },
  button: { backgroundColor: Colors.accent.green, padding: Spacing.lg, borderRadius: BorderRadius.md, alignItems: 'center', marginTop: Spacing.xl },
  buttonText: { color: Colors.bg.primary, fontFamily: FontFamily.tech, fontSize: FontSize.md },
});

export default OnboardingModal;
