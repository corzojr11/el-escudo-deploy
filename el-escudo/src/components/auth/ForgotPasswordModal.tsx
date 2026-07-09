import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { apiPost } from '../../api/requests';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Step = 'email' | 'code' | 'password' | 'success';

const ForgotPasswordModal: React.FC<Props> = ({ visible, onClose }) => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setStep('email');
    setEmail('');
    setCode('');
    setDevCode('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSendCode = async () => {
    if (!email.trim()) {
      setError('Ingresa tu correo electrónico.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost('/api/v1/auth/forgot-password', { email: email.trim() });
      const data = await res.json();
      if (res.ok) {
        if (data.dev_code) {
          setDevCode(data.dev_code);
        }
        setStep('code');
      } else {
        setError(data.detail || 'Error enviando código.');
      }
    } catch (e: any) {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = () => {
    if (!code.trim() || code.trim().length !== 6) {
      setError('Ingresa el código de 6 dígitos.');
      return;
    }
    setError(null);
    setStep('password');
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost('/api/v1/auth/reset-password', {
        email: email.trim(),
        code: code.trim(),
        new_password: newPassword,
      });
      const data = await res.json();
      if (res.ok) {
        setStep('success');
      } else {
        setError(data.detail || 'Error restableciendo contraseña.');
      }
    } catch (e: any) {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'email':
        return (
          <>
            <Text style={styles.modalTitle}>RECUPERAR ACCESO</Text>
            <Text style={styles.modalSubtitle}>
              Ingresa tu correo y te enviaremos un código de recuperación.
            </Text>

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
                editable={!loading}
              />
            </View>

            {error && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={16} color="#F87171" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.actionBtn} onPress={handleSendCode} disabled={loading}>
              <LinearGradient
                colors={[Colors.accent.cyan, '#0891B2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGradient}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.text.inverse} size="small" />
                ) : (
                  <Text style={styles.btnText}>ENVIAR CÓDIGO</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </>
        );

      case 'code':
        return (
          <>
            <Text style={styles.modalTitle}>VERIFICAR CÓDIGO</Text>
            <Text style={styles.modalSubtitle}>
              {devCode
                ? `Código de desarrollo: ${devCode}\nIngrésalo abajo para continuar.`
                : 'Ingresa el código de 6 dígitos que enviamos a tu correo.'}
            </Text>

            <View style={styles.inputWrapper}>
              <Ionicons name="keypad-outline" size={20} color={Colors.text.muted} />
              <TextInput
                style={styles.input}
                placeholder="000000"
                placeholderTextColor={Colors.text.muted}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                editable={!loading}
              />
            </View>

            {error && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={16} color="#F87171" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.actionBtn} onPress={handleVerifyCode} disabled={loading}>
              <LinearGradient
                colors={[Colors.accent.cyan, '#0891B2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGradient}
              >
                <Text style={styles.btnText}>VERIFICAR</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { marginTop: Spacing.md }]}
              onPress={() => setStep('email')}
            >
              <Text style={[styles.btnText, { color: Colors.text.muted }]}>REENVIAR CÓDIGO</Text>
            </TouchableOpacity>
          </>
        );

      case 'password':
        return (
          <>
            <Text style={styles.modalTitle}>NUEVA CONTRASEÑA</Text>
            <Text style={styles.modalSubtitle}>Crea una contraseña segura.</Text>

            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.text.muted} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.text.muted}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>

            <View style={[styles.inputWrapper, { marginTop: Spacing.md }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Colors.text.muted} />
              <TextInput
                style={styles.input}
                placeholder="Confirmar contraseña"
                placeholderTextColor={Colors.text.muted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>

            {error && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={16} color="#F87171" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleResetPassword}
              disabled={loading}
            >
              <LinearGradient
                colors={[Colors.accent.green, '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGradient}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.text.inverse} size="small" />
                ) : (
                  <Text style={styles.btnText}>ACTUALIZAR CONTRASEÑA</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </>
        );

      case 'success':
        return (
          <>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={64} color={Colors.accent.green} />
            </View>
            <Text style={styles.modalTitle}>¡LISTO!</Text>
            <Text style={styles.modalSubtitle}>
              Tu contraseña fue actualizada. Ahora puedes iniciar sesión.
            </Text>
            <TouchableOpacity style={styles.actionBtn} onPress={handleClose}>
              <LinearGradient
                colors={[Colors.accent.green, '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGradient}
              >
                <Text style={styles.btnText}>ENTENDIDO</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.backdrop} onTouchEnd={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text style={styles.modalTitle}>{step === 'success' ? '' : 'SEGURIDAD'}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Colors.text.muted} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>{renderStep()}</View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    backgroundColor: '#0A0A0B',
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  closeBtn: {
    padding: Spacing.sm,
  },
  modalTitle: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.xl,
    color: Colors.text.primary,
    letterSpacing: 2,
  },
  modalSubtitle: {
    fontFamily: FontFamily.techRegular,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginBottom: Spacing.xl,
    textAlign: 'center',
    lineHeight: 20,
  },
  content: {
    alignItems: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: Spacing.md,
    width: '100%',
    marginBottom: Spacing.lg,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    color: Colors.text.primary,
    fontFamily: FontFamily.mono,
    fontSize: FontSize.base,
  },
  actionBtn: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginTop: Spacing.md,
  },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
  },
  btnText: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.base,
    color: Colors.text.inverse,
    letterSpacing: 1,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.2)',
    width: '100%',
  },
  errorText: {
    color: '#F87171',
    fontFamily: FontFamily.techRegular,
    fontSize: FontSize.xs,
    marginLeft: 8,
    flex: 1,
  },
  successIcon: {
    marginBottom: Spacing.lg,
  },
});

export default ForgotPasswordModal;
