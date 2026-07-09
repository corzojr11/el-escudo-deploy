import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Alert, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { PressableScale } from '../PressableScale';
import { ExpoWebSpeechRecognition, ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

interface CommandInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: (text?: string) => void;
  onToggleRecipes: () => void;
  showRecipes: boolean;
  isProcessing: boolean;
  suggestion?: {
    label: string;
    onPress: () => void;
  } | null;
}

export const CommandInput: React.FC<CommandInputProps> = ({
  value,
  onChangeText,
  onSubmit,
  onToggleRecipes,
  showRecipes,
  isProcessing,
  suggestion,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));
  const recognitionRef = useRef<ExpoWebSpeechRecognition | null>(null);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).stop();
    }
  }, [isRecording, pulseAnim]);

  const startRecording = useCallback(async () => {
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permiso requerido', 'NAVIR necesita acceso al micrófono para reconocer voz.');
        return;
      }

      const recognition = new ExpoWebSpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.interimResults = false;
      recognition.continuous = false;

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript.trim().length > 0) {
          onChangeText(transcript.trim());
          onSubmit(transcript.trim());
        } else {
          Alert.alert('No entendí', 'Intenta de nuevo o escribe tu comando.');
        }
        setIsRecording(false);
      };

      recognition.onerror = () => {
        Alert.alert('Error', 'No se pudo procesar el audio. Intenta de nuevo.');
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      Alert.alert('Error', 'No se pudo iniciar el reconocimiento de voz.');
      setIsRecording(false);
    }
  }, [onChangeText, onSubmit]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  return (
    <View style={styles.inputWrap}>
      {suggestion && (
        <TouchableOpacity style={styles.suggestionChip} onPress={suggestion.onPress} activeOpacity={0.8}>
          <Ionicons name="sparkles" size={12} color={Colors.accent.cyan} />
          <Text style={styles.suggestionText}>{suggestion.label}</Text>
        </TouchableOpacity>
      )}
      <View style={styles.inputBar}>
        {!showRecipes && (
          <TouchableOpacity onPress={onToggleRecipes} style={styles.showRecipesBtn} activeOpacity={0.7}>
            <Ionicons name="list" size={18} color={Colors.text.muted} />
          </TouchableOpacity>
        )}
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.chatInput}
            placeholder="Escribe un comando..."
            placeholderTextColor={Colors.text.muted}
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={() => onSubmit()}
            autoCorrect={false}
            autoCapitalize="none"
            editable={!isProcessing && !isRecording}
          />
          <TouchableOpacity
            onPressIn={startRecording}
            onPressOut={stopRecording}
            style={[styles.micBtn, isRecording && styles.micBtnActive]}
            activeOpacity={0.7}
            disabled={isProcessing}
          >
            <Animated.View style={{ transform: [{ scale: isRecording ? pulseAnim : 1 }] }}>
              <Ionicons name="mic" size={16} color={isRecording ? Colors.accent.red : Colors.text.muted} />
            </Animated.View>
          </TouchableOpacity>
          <PressableScale
            style={[styles.sendBtn, (!value.trim() || isProcessing || isRecording) && styles.sendBtnDisabled]}
            onPress={() => onSubmit()}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={Colors.accent.green} />
            ) : (
              <Ionicons name="send" size={16} color={value.trim() && !isRecording ? '#000' : Colors.text.muted} />
            )}
          </PressableScale>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  inputWrap: { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, gap: 8 },
  inputBar: { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, paddingBottom: Platform.OS === 'ios' ? Spacing.lg : Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  showRecipesBtn: { padding: Spacing.xs, justifyContent: 'center', alignItems: 'center' },
  inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#121214', borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border.default, paddingHorizontal: Spacing.md, paddingVertical: 4, gap: Spacing.xs },
  chatInput: { flex: 1, height: 40, color: Colors.text.primary, fontFamily: FontFamily.mono, fontSize: FontSize.sm },
  micBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  micBtnActive: { backgroundColor: Colors.accent.red + '20' },
  sendBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.accent.green, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: Colors.border.subtle },
  suggestionChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(0, 229, 255, 0.08)', borderWidth: 1, borderColor: Colors.accent.cyan + '30', borderRadius: 999, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  suggestionText: { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.accent.cyan, letterSpacing: 0.5 },
});


