import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { BorderRadius, Spacing } from '../theme/spacing';
import { apiGet } from '../api/requests';
import type { SleepWindow } from '../store/types';

/**
 * Represents a circadian bio-anchor (e.g., sunlight exposure, meal time).
 */
interface BioAnchor {
  anchor: string;
  title: string;
  description: string;
  time: string;
  delta_hours?: number;
  delta_minutes?: number;
}

/**
 * Full response shape from the /api/v1/bio-anchors endpoint.
 */
interface BioAnchorsResponse {
  wake_target: string;
  sleep_debt_hours: number;
  optimal_wake: string;
  sleep_windows: SleepWindow[];
  bio_anchors: BioAnchor[];
  message: string;
  detail?: string;
}

/**
 * Maps bio-anchor names to Ionicons icon identifiers.
 */
const anchorIconMap: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  'Luz Solar': 'sunny',
  'Almuerzo': 'restaurant',
  'Ducha TÃ©rmica': 'water',
};

/**
 * Maps bio-anchor names to accent colors for visual differentiation.
 */
const anchorColorMap: Record<string, string> = {
  'Luz Solar': '#FFD700',
  'Almuerzo': '#00E5FF',
  'Ducha TÃ©rmica': '#7C3AED',
};

/**
 * BioTimeline â€” Displays the user's circadian rhythm anchors and optimal sleep windows.
 *
 * Fetches data from `GET /api/v1/bio-anchors` and renders a vertical timeline showing
 * key biological anchors (sunlight, meals, thermal showers) alongside calculated sleep
 * windows based on the user's target wake time.
 *
 * @component
 * @example
 * ```tsx
 * <BioTimeline />
 * ```
 */
const BioTimeline: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bioData, setBioData] = useState<BioAnchorsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchBioAnchors = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiGet('/api/v1/bio-anchors');

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (!cancelled) {
            setError(errorData.detail || 'No se pudo cargar el ritmo biolÃ³gico');
            setBioData(null);
          }
          return;
        }

        const data: BioAnchorsResponse = await response.json();
        if (!cancelled) {
          setBioData(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Error de conexiÃ³n. IntÃ©ntalo de nuevo.');
          setBioData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchBioAnchors();

    return () => {
      cancelled = true;
    };
  }, []);

  const parseTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  if (loading && !bioData) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="sync" size={14} color={Colors.accent.cyan} />
          <Text style={styles.headerTitle}>RITMOS CIRCADIANOS</Text>
        </View>
        <Text style={styles.summaryMessage}>Sincronizando ritmos y anclajes biolÃ³gicos...</Text>
        <View style={styles.sectionLabel}>
          <Ionicons name="alarm" size={10} color={Colors.accent.cyan} />
          <Text style={styles.sectionLabelText}>VENTANA DE SUEÃ‘O Ã“PTIMA</Text>
        </View>
        <View style={styles.sleepWindowCard}>
          <Text style={styles.loadingText}>Calculando ventana ideal...</Text>
        </View>
        <View style={styles.sectionLabel}>
          <Ionicons name="time" size={10} color={Colors.accent.green} />
          <Text style={styles.sectionLabelText}>ANCLAJES BIOLÃ“GICOS</Text>
        </View>
        <View style={styles.timelinePlaceholder}>
          <Text style={styles.loadingText}>Cargando anclajes...</Text>
        </View>
      </View>
    );
  }

  if (error || !bioData) {
    return (
      <View style={[styles.container, styles.containerError]}>
        <View style={styles.header}>
          <Ionicons name="warning" size={14} color={Colors.accent.red} />
          <Text style={[styles.headerTitle, styles.headerTitleError]}>
            ERROR DE CONEXIÃ“N
          </Text>
        </View>
        <Text style={styles.errorMessage}>{error || 'No hay datos disponibles'}</Text>
      </View>
    );
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const sortedAnchors = [...bioData.bio_anchors].sort(
    (a, b) => parseTime(a.time) - parseTime(b.time)
  );

  const bestWindow = bioData.sleep_windows[0];
  const bestSleepTime = (bestWindow as any)?.sleepTime || (bestWindow as any)?.sleep_time || '';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="pulse" size={14} color={Colors.accent.green} />
        <Text style={styles.headerTitle}>
          RITMOS CIRCADIANOS
        </Text>
      </View>

      {bioData.message && (
        <Text style={styles.summaryMessage}>{bioData.message}</Text>
      )}

      <View style={styles.sectionLabel}>
        <Ionicons name="alarm" size={10} color={Colors.accent.cyan} />
        <Text style={styles.sectionLabelText}>VENTANA DE SUEÃ‘O Ã“PTIMA</Text>
      </View>

      {bestWindow && (
        <View style={styles.sleepWindowCard}>
          <View style={styles.sleepWindowRow}>
            <Ionicons name="moon" size={16} color="#7C3AED" />
            <View style={styles.sleepWindowInfo}>
              <Text style={styles.sleepWindowTitle}>Dormir a las {bestSleepTime}</Text>
              <Text style={styles.sleepWindowSubtitle}>
                {bestWindow.cycles} ciclos · {bestWindow.hours}h de sueño
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.sectionLabel}>
        <Ionicons name="time" size={10} color={Colors.accent.green} />
        <Text style={styles.sectionLabelText}>ANCLAJES BIOLÃ“GICOS</Text>
      </View>

      <View style={styles.timeline}>
        {sortedAnchors.map((anchor, i) => {
          const isPast = currentMinutes >= parseTime(anchor.time);
          const color = anchorColorMap[anchor.anchor] || Colors.accent.cyan;
          const icon = anchorIconMap[anchor.anchor] || 'pulse';

          return (
            <View key={i} style={styles.anchorRow}>
              <View style={styles.timelineCol}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: color },
                    !isPast && styles.dotFuture,
                  ]}
                >
                  <Ionicons name={icon} size={12} color={isPast ? '#000' : 'rgba(255,255,255,0.5)'} />
                </View>
                {i < sortedAnchors.length - 1 && (
                  <View style={[styles.line, isPast ? styles.linePast : styles.lineFuture]} />
                )}
              </View>

              <View style={styles.anchorCard}>
                <View style={styles.anchorHeader}>
                  <Text style={styles.anchorLabel}>{anchor.title}</Text>
                  <Text style={styles.anchorTime}>{anchor.time}</Text>
                </View>
                <Text style={styles.anchorDescription}>{anchor.description}</Text>
              </View>
            </View>
          );
        })}
      </View>
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
  timelinePlaceholder: {
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  containerError: {
    borderColor: Colors.accent.red + '60',
    backgroundColor: 'rgba(255, 69, 58, 0.04)',
  },
  loadingText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    marginTop: Spacing.xs,
  },
  errorMessage: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    marginTop: Spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.xs,
    color: Colors.accent.green,
    letterSpacing: 1.5,
  },
  headerTitleError: {
    color: Colors.accent.red,
  },
  summaryMessage: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  sectionLabelText: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.text.muted,
    letterSpacing: 1.5,
  },
  sleepWindowCard: {
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  sleepWindowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sleepWindowInfo: {
    flex: 1,
  },
  sleepWindowTitle: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
  },
  sleepWindowSubtitle: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    marginTop: 2,
  },
  timeline: {
    gap: 0,
  },
  anchorRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  timelineCol: {
    alignItems: 'center',
    width: 28,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotFuture: {
    opacity: 0.4,
  },
  line: {
    width: 2,
    flex: 1,
    minHeight: 20,
  },
  linePast: {
    backgroundColor: 'rgba(0, 255, 157, 0.2)',
  },
  lineFuture: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  anchorCard: {
    flex: 1,
    paddingVertical: Spacing.xs,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  anchorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  anchorLabel: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
  },
  anchorTime: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  anchorDescription: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    marginTop: 4,
    lineHeight: 16,
  },
});

export default BioTimeline;


