/**
 * El Escudo — Typography System
 */

import { Platform } from 'react-native';

export const FontFamily = {
  mono:        'SpaceMono_400Regular',
  monoStack:   "'Space Mono', 'Courier New', Courier, monospace",
  // Space Grotesk — for numbers and headings (premium tech feel)
  tech:        'SpaceGrotesk_700Bold',
  techSemi:    'SpaceGrotesk_600SemiBold',
  techRegular: 'SpaceGrotesk_400Regular',
  sans: Platform.select({
    ios:     'System',
    android: 'Roboto',
    web:     "'Inter', system-ui, -apple-system, sans-serif",
    default: 'System',
  }) as string,
} as const;


export const FontSize = {
  xs:   11,
  sm:   13,
  base: 14,
  md:   16,
  lg:   18,
  xl:   22,
  xxl:  28,
} as const;

export const FontWeight = {
  regular: '400' as const,
  bold:    '700' as const,
} as const;

export const LineHeight = {
  tight:  1.2,
  normal: 1.5,
  loose:  1.8,
} as const;

export const LetterSpacing = {
  tight: -0.5,
  normal: 0,
  wide:   1.5,
  wider:  3,
} as const;
