/**
 * El Escudo — Color System v5
 * Matte, flat, minimal — Vercel/Linear dark mode aesthetic
 * Now supports dark and light themes
 */

export const darkColors = {
  bg: {
    canvas:    '#0A0A0B',
    primary:   '#0A0A0B',
    secondary: '#121214',
    card:      'rgba(18, 18, 20, 0.80)',
    input:     '#0A0A0B',
    modal:     '#121214',
    chip:      '#27272A',
    chipActive:'#18181B',
    overlay:   'rgba(0, 0, 0, 0.85)',
  },
  border: {
    subtle:   '#1A1A1C',
    default:  '#2C2C2E',
    strong:   '#3A3A3C',
    glass:    'rgba(255, 255, 255, 0.1)',
    green:    '#00FF9D',
    gold:     '#FFD700',
    red:      '#FF3131',
    cyan:     '#00E5FF',
  },
  text: {
    primary:   '#FAFAFA',
    secondary: '#D1D1D6',
    muted:     '#636366',
    inverse:   '#0A0A0B',
    green:     '#00FF9D',
    gold:      '#FFD700',
    cyan:      '#00E5FF',
    red:       '#FF3131',
  },
  accent: {
    green:    '#00FF9D',
    gold:     '#FFD700',
    cyan:     '#00E5FF',
    red:      '#FF3131',
    orange:   '#FF8C00',
    purple:   '#7C3AED',
    indigo:   '#6366F1',
    white:    '#FAFAFA',
    titanium: '#E5E5E7',
  },
  transparent: 'transparent',
} as const;

export const lightColors = {
  bg: {
    canvas:    '#F5F5F7',
    primary:   '#FFFFFF',
    secondary: '#F0F0F2',
    card:      'rgba(255, 255, 255, 0.90)',
    input:     '#FFFFFF',
    modal:     '#FFFFFF',
    chip:      '#E5E5E7',
    chipActive:'#D4D4D8',
    overlay:   'rgba(0, 0, 0, 0.50)',
  },
  border: {
    subtle:   '#E5E5E7',
    default:  '#D4D4D8',
    strong:   '#A1A1AA',
    glass:    'rgba(0, 0, 0, 0.05)',
    green:    '#00C87A',
    gold:     '#D4A800',
    red:      '#CC2929',
    cyan:     '#00B8D4',
  },
  text: {
    primary:   '#18181B',
    secondary: '#3F3F46',
    muted:     '#71717A',
    inverse:   '#FFFFFF',
    green:     '#00C87A',
    gold:      '#D4A800',
    cyan:      '#00B8D4',
    red:       '#CC2929',
  },
  accent: {
    green:    '#00C87A',
    gold:     '#D4A800',
    cyan:     '#00B8D4',
    red:      '#CC2929',
    orange:   '#E67E00',
    purple:   '#6D28D9',
    indigo:   '#4F46E5',
    white:    '#FFFFFF',
    titanium: '#18181B',
  },
  transparent: 'transparent',
} as const;

export type ColorTheme = typeof darkColors;

export const Colors = darkColors;
