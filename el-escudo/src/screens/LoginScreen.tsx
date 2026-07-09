import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { BorderRadius, Spacing } from '../theme/spacing';
import { supabase } from '../utils/supabase';
import ForgotPasswordModal from '../components/auth/ForgotPasswordModal';

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [forgotModalVisible, setForgotModalVisible] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAuth = async () => {
    if (!email || !password) {
      setErrorMessage('Por favor completa todos los campos.');
      return;
    }

    if (isRegistering && password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        Alert.alert('Éxito', 'Cuenta creada. Revisa tu correo si hace falta confirmar.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message === 'Invalid login credentials' 
        ? 'Usuario o contraseña incorrectos' 
        : error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[Colors.bg.canvas, '#09090B', '#020617']}
        style={StyleSheet.absoluteFill}
      />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Logo / Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="shield-checkmark" size={48} color={Colors.accent.green} />
            </View>
            <Text style={styles.title}>EL ESCUDO</Text>
            <Text style={styles.subtitle}>Tu vida, más ordenada</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.formTitle}>
              {isRegistering ? 'CREAR CUENTA' : 'ENTRAR'}
            </Text>

            {errorMessage && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color="#F87171" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>CORREO</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color={Colors.text.muted} />
                <TextInput
                  style={styles.input}
                  placeholder="usuario@el-escudo.os"
                  placeholderTextColor={Colors.text.muted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>CONTRASEÑA</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.text.muted} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.text.muted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons 
                    name={showPassword ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color={showPassword ? Colors.accent.green : Colors.text.muted} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {isRegistering && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>REPETIR CONTRASEÑA</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="shield-outline" size={20} color={Colors.text.muted} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={Colors.text.muted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                  />
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleAuth}
              disabled={loading}
            >
              <LinearGradient
                colors={[Colors.accent.green, '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGradient}
              >
                {loading ? (
                  <>
                    <ActivityIndicator color={Colors.text.inverse} size="small" />
                    <Text style={[styles.btnText, { marginLeft: 8 }]}>ENTRANDO...</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.btnText}>
                      {isRegistering ? 'CREAR CUENTA' : 'ENTRAR'}
                    </Text>
                    <Ionicons name="flash" size={18} color={Colors.text.inverse} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {!isRegistering && (
              <TouchableOpacity
                style={styles.forgotBtn}
                onPress={() => setForgotModalVisible(true)}
              >
                <Text style={styles.forgotText}>¿OLVIDASTE TU CONTRASEÑA?</Text>
              </TouchableOpacity>
            )}

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>O</Text>
              <View style={styles.line} />
            </View>

            <TouchableOpacity
              style={[styles.switchBtn, isRegistering && styles.switchBtnActive]}
              onPress={() => {
                setIsRegistering(!isRegistering);
                setErrorMessage(null);
              }}
            >
              <Text style={styles.switchText}>
                {isRegistering
                  ? '¿YA TIENES CUENTA? ENTRA'
                  : '¿NUEVO POR AQUÍ? CREA CUENTA'}
              </Text>
            </TouchableOpacity>

          </View>
        </View>
      </KeyboardAvoidingView>

      <ForgotPasswordModal
        visible={forgotModalVisible}
        onClose={() => setForgotModalVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.xl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxl * 2,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.accent.green + '40',
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.tech,
    fontSize: 32,
    color: Colors.text.primary,
    letterSpacing: 4,
  },
  subtitle: {
    fontFamily: FontFamily.techRegular,
    fontSize: FontSize.xs,
    color: Colors.accent.green,
    letterSpacing: 2,
    marginTop: 4,
  },
  form: {
    backgroundColor: 'rgba(17, 24, 39, 0.7)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  formTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.lg,
    color: Colors.text.primary,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.2)',
  },
  errorText: {
    color: '#F87171',
    fontFamily: FontFamily.techRegular,
    fontSize: FontSize.xs,
    marginLeft: 8,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.accent.green,
    marginBottom: Spacing.xs,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: Spacing.md,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    color: Colors.text.primary,
    fontFamily: FontFamily.mono,
    fontSize: FontSize.base,
  },
  eyeBtn: {
    padding: Spacing.sm,
  },
  actionBtn: {
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)',
  },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  btnText: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.base,
    color: Colors.text.inverse,
    letterSpacing: 1,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    color: Colors.text.muted,
    fontFamily: FontFamily.mono,
    fontSize: 10,
    marginHorizontal: Spacing.md,
  },
  switchBtn: {
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  switchBtnActive: {
    borderColor: Colors.accent.green + '40',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  forgotBtn: {
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  forgotText: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.xs,
    color: Colors.accent.cyan,
    letterSpacing: 1,
  },
  switchText: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.xs,
    color: Colors.accent.green,
    letterSpacing: 1,
  },

});

export default LoginScreen;

