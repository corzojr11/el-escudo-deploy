import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { supabase } from '../../utils/supabase';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Step = 'email' | 'success';

const ForgotPasswordModal: React.FC<Props> = ({ visible, onClose }) => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setStep('email');
    setEmail('');
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSendResetLink = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Ingresa tu correo electrónico.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // El flujo de recuperación ahora es nativo de Supabase Auth.
      // El usuario recibe un enlace seguro por correo para definir una nueva contraseña.
      const { error: supaError } = await supabase.auth.resetPasswordForEmail(
        trimmedEmail,
        {
          redirectTo: 'https://el-escudo.vercel.app/auth/callback?next=/reset-password',
        }
      );
      if (supaError) {
        setError(supaError.message || 'Error enviando el enlace de recuperación.');
      } else {
        setStep('success');
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
              Te enviaremos un enlace seguro a tu correo para restablecer tu contraseña.
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

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleSendResetLink}
              disabled={loading || !email.trim()}
            >
              <LinearGradient
                colors={[Colors.accent.cyan, '#0891B2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGradient}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.text.inverse} size="small" />
                ) : (
                  <Text style={styles.btnText}>ENVIAR ENLACE SEGURO</Text>
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
              Si tu correo está registrado, recibirás un enlace seguro para restablecer tu contraseña.
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
