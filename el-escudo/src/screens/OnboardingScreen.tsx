import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, LayoutAnimation, UIManager, Platform, Keyboard, KeyboardAvoidingView, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { BorderRadius, Spacing } from '../theme/spacing';
import { useAppStore, UserProfile } from '../store';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const GOALS = [
  { id: 'muscle', label: 'Quiero ganar músculo', icon: 'barbell' },
  { id: 'fatloss', label: 'Quiero bajar de peso', icon: 'flame' },
  { id: 'energy', label: 'Quiero energía', icon: 'flash' },
];

const Container = ({ children, onPress }: { children: React.ReactNode, onPress?: () => void }) => {
  if (Platform.OS === 'web') return <View style={{ flex: 1 }}>{children}</View>;
  return <TouchableWithoutFeedback onPress={onPress} style={{ flex: 1 }}>{children}</TouchableWithoutFeedback>;
};

const OnboardingScreen: React.FC = () => {
  const completeUserOnboarding = useAppStore(state => state.completeUserOnboarding);
  
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<Partial<UserProfile>>({
    name: '',
    age: 0,
    weight: 0,
    height: 0,
    goal: '',
  });

  const nextStep = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (step < 3) setStep(step + 1);
  };

  const prevStep = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (step > 1) setStep(step - 1);
  };

  const [isFinishing, setIsFinishing] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

  const handleFinish = async (goalLabel: string) => {
    setSelectedGoal(goalLabel);
    setIsFinishing(true);
    const finalProfile = { ...profile, goal: goalLabel } as UserProfile;
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    try {
      await completeUserOnboarding(finalProfile);
      setIsFinishing(false);
    } catch (e) {
      console.error(e);
      setIsFinishing(false);
    }
  };

  const isValidStep1 = profile.name && profile.name.length >= 2 && profile.age && profile.age > 0;
  const isValidStep2 = profile.weight && profile.weight > 0 && profile.height && profile.height > 0;

  return (
    <SafeAreaView style={styles.container}>
      <Container onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
          {/* Header / Progress */}
          <View style={styles.header}>
            {step > 1 && !isFinishing ? (
              <TouchableOpacity onPress={prevStep} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            ) : <View style={{ width: 24 }} />}
            
            <View style={styles.progressDots}>
              {[1, 2, 3].map(i => (
                <View key={i} style={[styles.dot, step >= i && styles.dotActive]} />
              ))}
            </View>
            <View style={{ width: 24 }} />
          </View>

          <KeyboardAvoidingView 
            style={{ flex: 1 }} 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.content}>
          {isFinishing ? (
            <View style={styles.loadingBanner}>
              <Ionicons name="sync" size={18} color={Colors.accent.cyan} />
              <Text style={styles.loadingText}>Sincronizando configuración...</Text>
            </View>
          ) : (
            <>
          {step === 1 && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>Vamos a ordenar tu día</Text>
              <Text style={styles.subtitle}>Identifícate. ¿Cómo prefieres que te llamemos?</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Tu nombre</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. Alex"
                  placeholderTextColor={Colors.text.muted}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  value={profile.name}
                  onChangeText={(text) => setProfile({ ...profile, name: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Edad (Años)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 28"
                  placeholderTextColor={Colors.text.muted}
                  keyboardType="numeric"
                  returnKeyType="done"
                  blurOnSubmit={true}
                  value={profile.age ? profile.age.toString() : ''}
                  onChangeText={(text) => setProfile({ ...profile, age: parseInt(text) || 0 })}
                />
              </View>

              <TouchableOpacity 
                style={[styles.nextBtn, !isValidStep1 && styles.nextBtnDisabled]} 
                disabled={!isValidStep1} 
                onPress={nextStep}
              >
                <LinearGradient
                  colors={isValidStep1 ? [Colors.accent.purple, Colors.accent.cyan] : [Colors.bg.secondary, Colors.bg.secondary]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.btnGradient}
                >
                  <Text style={styles.btnText}>Siguiente</Text>
                  <Ionicons name="arrow-forward" size={20} color={isValidStep1 ? Colors.text.inverse : Colors.text.muted} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>Métricas Físicas</Text>
              <Text style={styles.subtitle}>Ajustando salud y descanso para ti.</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Peso Actual (kg)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 75"
                  placeholderTextColor={Colors.text.muted}
                  keyboardType="numeric"
                  returnKeyType="done"
                  blurOnSubmit={true}
                  value={profile.weight ? profile.weight.toString() : ''}
                  onChangeText={(text) => setProfile({ ...profile, weight: parseFloat(text) || 0 })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Estatura (cm)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 175"
                  placeholderTextColor={Colors.text.muted}
                  keyboardType="numeric"
                  returnKeyType="done"
                  blurOnSubmit={true}
                  value={profile.height ? profile.height.toString() : ''}
                  onChangeText={(text) => setProfile({ ...profile, height: parseFloat(text) || 0 })}
                />
              </View>

              <TouchableOpacity 
                style={[styles.nextBtn, !isValidStep2 && styles.nextBtnDisabled]} 
                disabled={!isValidStep2} 
                onPress={nextStep}
              >
                <LinearGradient
                  colors={isValidStep2 ? [Colors.accent.purple, Colors.accent.cyan] : [Colors.bg.secondary, Colors.bg.secondary]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.btnGradient}
                >
                  <Text style={styles.btnText}>Siguiente</Text>
                  <Ionicons name="arrow-forward" size={20} color={isValidStep2 ? Colors.text.inverse : Colors.text.muted} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>Tu objetivo</Text>
              <Text style={styles.subtitle}>Selecciona tu objetivo primordial. El motor de IA adaptará tu sistema.</Text>
              
              <View style={styles.goalsContainer}>
                {GOALS.map(goal => (
                  <TouchableOpacity 
                    key={goal.id}
                    style={[
                      styles.goalCard,
                      selectedGoal === goal.label && styles.goalCardActive
                    ]}
                    onPress={() => handleFinish(goal.label)}
                    disabled={isFinishing}
                  >
                    <LinearGradient
                      colors={selectedGoal === goal.label 
                        ? [Colors.accent.cyan + '40', Colors.accent.purple + '20'] 
                        : [Colors.bg.card, Colors.bg.secondary]}
                      style={styles.goalGradient}
                    >
                      <Ionicons 
                        name={goal.icon as any} 
                        size={32} 
                        color={selectedGoal === goal.label ? Colors.accent.cyan : Colors.text.muted} 
                      />
                      <Text style={[
                        styles.goalText,
                        selectedGoal === goal.label && styles.goalTextActive
                      ]}>{goal.label}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          </>
          )}
            </View>

          </KeyboardAvoidingView>
        </View>
      </Container>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.canvas,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  backButton: {
    padding: Spacing.xs,
  },
  progressDots: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.xs,
    backgroundColor: Colors.border.default,
  },
  dotActive: {
    backgroundColor: Colors.accent.cyan,
    width: 24,
  },
  content: {
    flex: 1,
    padding: Spacing.xl,
    justifyContent: 'center',
  },
  stepContainer: {
    flex: 1,
  },
  title: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.xxl,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontFamily: FontFamily.techRegular,
    fontSize: FontSize.base,
    color: Colors.text.muted,
    marginBottom: Spacing.xxl,
  },
  inputGroup: {
    marginBottom: Spacing.xl,
  },
  label: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.accent.purple,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    color: Colors.text.primary,
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.lg,
    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
  },
  nextBtn: {
    marginTop: 'auto',
    marginBottom: Spacing.xl,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(34, 211, 238, 0.3)',
  },
  nextBtnDisabled: {
    opacity: 0.5,
  },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  btnText: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.lg,
    color: Colors.text.inverse,
  },
  goalsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: Spacing.xl,
  },
  goalCard: {
    width: '48%',
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: Colors.bg.card,
  },
  goalCardActive: {
    borderColor: Colors.accent.cyan,
    boxShadow: '0 0 10px rgba(34, 211, 238, 0.5)',
  },
  goalGradient: {
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  goalText: {
    color: Colors.text.muted,
    fontFamily: FontFamily.techSemi,
    fontSize: 12,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  goalTextActive: {
    color: Colors.text.primary,
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.bg.card,
  },
  loadingText: {
    color: Colors.accent.cyan,
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    marginTop: Spacing.xl,
    letterSpacing: 2,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default OnboardingScreen;
