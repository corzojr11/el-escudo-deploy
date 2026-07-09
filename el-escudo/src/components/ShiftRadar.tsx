import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { BorderRadius, Spacing } from '../theme/spacing';
import { apiGet } from '../api/requests';

/**
 * Represents a work shift with day, start/end times, and optional remaining duration.
 */
interface ShiftInfo {
  day: string;
  start: string;
  end: string;
  remaining_hours?: number;
  starts_in_hours?: number;
}

/**
 * Full response shape from the /api/v1/current-status endpoint.
 */
interface CurrentStatusResponse {
  status: 'in_shift' | 'free';
  shift?: ShiftInfo;
  next_shift?: ShiftInfo;
  message_short?: string;
  detail?: string;
}

/**
 * ShiftRadar — Displays the user's current work shift status and countdown.
 *
 * Fetches real-time shift data from `GET /api/v1/current-status` and renders a compact
 * widget showing whether the user is currently on shift or free, along with remaining time
 * or time until the next shift starts.
 *
 * @component
 * @example
 * ```tsx
 * <ShiftRadar />
 * ```
 */
const ShiftRadar: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusData, setStatusData] = useState<CurrentStatusResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchStatus = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiGet('/api/v1/current-status');

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (!cancelled) {
            setError(errorData.detail || 'No se pudo cargar el estado del turno');
            setStatusData(null);
          }
          return;
        }

        const data: CurrentStatusResponse = await response.json();
        if (!cancelled) {
          setStatusData(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Error de conexión. Inténtalo de nuevo.');
          setStatusData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading && !statusData) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.iconFree}>
            <Ionicons name="sync" size={20} color={Colors.accent.cyan} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.statusLabel}>SINCRONIZANDO TURNO</Text>
            <Text style={styles.statusMessage}>Preparando tu estado actual...</Text>
          </View>
        </View>
        <View style={styles.footer}>
          <Ionicons name="time-outline" size={14} color={Colors.accent.cyan} />
          <Text style={styles.footerText}>Se actualizará en segundo plano</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.containerError]}>
        <View style={styles.header}>
          <View style={styles.iconError}>
            <Ionicons name="warning" size={20} color={Colors.accent.red} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.statusLabel, styles.statusLabelError]}>ERROR DE CONEXIÓN</Text>
            <Text style={styles.statusMessage}>{error}</Text>
          </View>
        </View>
      </View>
    );
  }

  const isInShift = statusData?.status === 'in_shift';
  const shiftInfo = isInShift ? statusData?.shift : null;
  const nextShiftInfo = statusData?.status === 'free' ? statusData?.next_shift : null;
  const hasNoShifts = statusData?.status === 'free' && !nextShiftInfo;

  return (
    <View style={[styles.container, isInShift && styles.containerWorking]}>
      <View style={styles.header}>
        <View style={[styles.iconCircle, isInShift ? styles.iconWorking : styles.iconFree]}>
          <Ionicons
            name={isInShift ? 'briefcase' : hasNoShifts ? 'calendar-clear' : 'alarm'}
            size={20}
            color={isInShift ? '#000' : Colors.accent.cyan}
          />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.statusLabel, isInShift && styles.statusLabelWorking]}>
            {isInShift ? 'EN TURNO ACTIVO' : 'ESTADO DE TURNO'}
          </Text>
          {isInShift ? (
            <Text style={styles.statusMessage}>
              Estás en tu turno
            </Text>
          ) : nextShiftInfo ? (
            <Text style={styles.statusMessage}>
              Libre. Próximo turno: {nextShiftInfo.day} a las {nextShiftInfo.start}
            </Text>
          ) : (
            <Text style={styles.statusMessage}>Sin turnos programados</Text>
          )}
        </View>
      </View>

      {isInShift && shiftInfo && (
        <View style={styles.footer}>
          <Ionicons name="hourglass" size={14} color={Colors.accent.green} />
          <Text style={styles.footerText}>
            Termina a las {shiftInfo.end} · Quedan {shiftInfo.remaining_hours}h
          </Text>
        </View>
      )}

      {nextShiftInfo && (
        <View style={styles.footer}>
          <Ionicons name="time-outline" size={14} color={Colors.accent.cyan} />
          <Text style={styles.footerText}>
            Comienza en {nextShiftInfo.starts_in_hours}h
          </Text>
        </View>
      )}

      {isInShift && (
        <View style={styles.progressBarBg}>
          <View style={styles.progressBarFill} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  containerError: {
    borderColor: Colors.accent.red + '60',
    backgroundColor: 'rgba(255, 69, 58, 0.04)',
  },
  containerWorking: {
    borderColor: Colors.accent.green + '60',
    backgroundColor: 'rgba(0, 255, 157, 0.04)',
  },
  loadingText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    marginTop: Spacing.xs,
  },
  iconError: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
  },
  statusLabelError: {
    color: Colors.accent.red,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWorking: {
    backgroundColor: Colors.accent.green,
  },
  iconFree: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
  },
  headerText: {
    flex: 1,
  },
  statusLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.text.muted,
    letterSpacing: 1.5,
  },
  statusLabelWorking: {
    color: Colors.accent.green,
  },
  statusMessage: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  footerText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  progressBarBg: {
    height: 3,
    backgroundColor: Colors.border.subtle,
    borderRadius: BorderRadius.xxs,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    width: '60%',
    backgroundColor: Colors.accent.green,
    borderRadius: BorderRadius.xxs,
  },
});

export default ShiftRadar;
