import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';

const ERROR_LOG_KEY = '@el_escudo_error_logs';
const MAX_ERROR_LOGS = 20;

export interface ErrorLogEntry {
  timestamp: string;
  screenName?: string;
  message: string;
  stack?: string;
}

const errorLogs: ErrorLogEntry[] = [];

export function getErrorLogs(): ErrorLogEntry[] {
  return [...errorLogs];
}

export function clearErrorLogs(): void {
  errorLogs.length = 0;
}

interface Props {
  children: ReactNode;
  screenName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);

    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      screenName: this.props.screenName,
      message: error.message,
      stack: errorInfo.componentStack || undefined,
    };

    errorLogs.push(entry);
    if (errorLogs.length > MAX_ERROR_LOGS) {
      errorLogs.shift();
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      const screenName = (this.props as Props).screenName;
      return (
        <View style={styles.container}>
          <Ionicons name="bug-outline" size={48} color={Colors.accent.red} />
          <Text style={styles.title}>
            {screenName ? `ERROR EN ${screenName.toUpperCase()}` : 'ERROR INESPERADO'}
          </Text>
          <Text style={styles.message}>
            {screenName
              ? `No se pudo cargar ${screenName}. Intenta reintentar.`
              : 'Algo salió mal. Intenta recargar la aplicación.'}
          </Text>
          <TouchableOpacity onPress={this.handleRetry} style={styles.retryButton}>
            <Text style={styles.retryText}>REINTENTAR</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.bg.primary,
  },
  title: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.lg,
    color: Colors.text.primary,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
  message: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    color: Colors.text.muted,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.accent.green,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  retryText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.base,
    color: Colors.text.inverse,
  },
});
