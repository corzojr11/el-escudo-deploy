import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { BorderRadius, Spacing } from '../theme/spacing';
import { useAppStore } from '../store';

// OMNI_CACHE_BREAKER_V3_CLEAN_CONSOLE_FORCED
const DAYS_ES   = ['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'];
const MONTHS_ES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
                   'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Returns a time-appropriate greeting icon, text, and current hour.
 * @returns Greeting configuration based on current time of day.
 */
function getGreeting(): { icon: IoniconName; text: string; h: number } {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return { icon: 'sunny-outline',        text: 'Buenos días',   h };
  if (h >= 12 && h < 18) return { icon: 'partly-sunny-outline', text: 'Buenas tardes', h };
  if (h >= 18 && h < 21) return { icon: 'at-outline', text: 'Buenas tardes', h };
  return                       { icon: 'moon-outline',         text: 'Buenas noches', h };
}

/**
 * Returns a motivational subtitle based on the current hour.
 * @param h - Current hour (0-23)
 * @returns Contextual motivational message.
 */
function getSubtitle(h: number): string {
  if (h >= 5  && h < 12) return 'Empieza fuerte — ¿cuál es tu primera misión?';
  if (h >= 12 && h < 15) return 'A mitad del día — Mantén el ritmo alto.';
  if (h >= 15 && h < 18) return 'Cerrando la tarde — Último empuje técnico.';
  if (h >= 18 && h < 21) return 'Final de jornada — Analizando resultados.';
  return 'Noche de reflexión — Prepárate para el mañana.';
}

/**
 * Props for the GreetingCard component.
 */
interface GreetingCardProps {
  /** User's display name. Defaults to `'Usuario'`. */
  name?: string;
}

/**
 * Capitalizes the first letter of a name and lowercases the rest.
 * @param name - Raw name string
 * @returns Humanized name (e.g., "john doe" → "John")
 */
const humanizeName = (name: string) => {
  if (!name) return 'Usuario';
  const firstName = name.trim().split(' ')[0];
  return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
};

/**
 * GreetingCard — Time-aware greeting widget with user personalization.
 *
 * Displays a contextual greeting based on the current time of day, including:
 * - Time-appropriate icon (sun, moon, etc.)
 * - Greeting text ("Buenos días", "Buenas noches", etc.)
 * - Motivational subtitle
 * - Current date in Spanish
 * - User's first name (humanized)
 * - Daily AI quote and cost summary
 *
 * @component
 * @param {GreetingCardProps} props - Component props
 * @param {string} [props.name='Usuario'] - User's display name
 * @example
 * ```tsx
 * <GreetingCard name="Carlos" />
 * ```
 */
const GreetingCard: React.FC<GreetingCardProps> = ({ name = 'Usuario' }) => {
  const { icon, text, h } = useMemo(getGreeting, []);
  const dailyQuote = useAppStore(state => state.dailyQuote);
  const aiCostCop = useAppStore(state => state.aiCostCop);
  const now  = useMemo(() => new Date(), []);
  const date = `${DAYS_ES[now.getDay()]} ${now.getDate()} ${MONTHS_ES[now.getMonth()]}`;
  
  const displayName = useMemo(() => humanizeName(name), [name]);

  const Wrapper = Platform.OS === 'web' ? View : BlurView;

  return (
    <Wrapper intensity={60} tint="dark" style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={20} color={Colors.accent.gold} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.greeting}>
            {text}, <Text style={styles.name}>{displayName}</Text>
          </Text>
          <Text style={styles.subtitle}>{getSubtitle(h)}</Text>
          {dailyQuote ? (
            <Text style={styles.quote}>"{dailyQuote}"</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.bottomRow}>
        <Text style={styles.date}>{date.toUpperCase()}</Text>
        <View style={styles.statusPill}>
          <Text style={styles.costText}>IA: ${aiCostCop.toFixed(4)} COP</Text>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>EN LÍNEA</Text>
        </View>
      </View>
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg.card,
    borderRadius:    BorderRadius.xl,
    borderWidth:     1,
    borderColor:     Colors.border.glass,
    padding:         Spacing.lg,
    overflow:        'hidden',
    boxShadow: '0 10px 20px rgba(0,0,0,0.3)',
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.md,
  },
  iconBox: {
    width:           44,
    height:          44,
    borderRadius:    14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth:     1,
    borderColor:     'rgba(255, 255, 255, 0.08)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  textCol: {
    flex: 1,
  },
  greeting: {
    fontFamily: FontFamily.tech,
    fontSize:   20,
    color:      Colors.accent.titanium,
    letterSpacing: -0.5,
  },
  name: {
    color: Colors.text.primary,
  },
  subtitle: {
    fontFamily: FontFamily.techRegular,
    fontSize:   FontSize.sm,
    color:      Colors.text.muted,
    marginTop:  4,
  },
  quote: {
    fontFamily: FontFamily.techRegular,
    fontSize:   FontSize.sm - 1,
    color:      Colors.accent.cyan,
    fontStyle:  'italic',
    marginTop:  8,
    opacity:    0.9,
  },
  divider: {
    height:          1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical:  Spacing.md,
  },
  bottomRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  date: {
    fontFamily:    FontFamily.mono,
    fontSize:      11,
    color:         Colors.text.muted,
    letterSpacing: 2,
  },
  statusPill: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    backgroundColor: 'rgba(0, 255, 157, 0.05)',
    borderWidth:     1,
    borderColor:     'rgba(0, 255, 157, 0.1)',
    borderRadius:    20,
    paddingVertical:   4,
    paddingHorizontal: 10,
  },
  costText: {
    fontFamily:    FontFamily.mono,
    fontSize:      9,
    color:         Colors.accent.cyan,
    fontWeight:    '700',
    borderRightWidth: 1,
    borderRightColor: 'rgba(0, 255, 157, 0.2)',
    paddingRight: 6,
    marginRight: 2,
  },
  statusDot: {
    width:           6,
    height:          6,
    borderRadius:    BorderRadius.xxs,
    backgroundColor: Colors.accent.green,
    boxShadow: '0 0 4px rgba(16, 185, 129, 1)',
  },
  statusText: {
    fontFamily:    FontFamily.mono,
    fontSize:      9,
    color:         Colors.accent.green,
    fontWeight:    '700',
    letterSpacing: 1,
  },
});

export default GreetingCard;


