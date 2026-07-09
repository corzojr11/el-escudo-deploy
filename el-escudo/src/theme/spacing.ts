/**
 * El Escudo — Spacing & Layout Constants
 */

export const Spacing = {
  xxs: 2,
  xs:  4,
  sm:  8,
  md:  12,
  base: 16,
  lg:  20,
  xl:  24,
  xxl: 32,
  xxxl: 48,
} as const;

export const BorderRadius = {
  none: 0,
  xxs:  2,
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  xxl:  32,
  full: 999,
} as const;

export const Layout = {
  inputBarHeight:    64,
  hudHeight:         56,
  messagePaddingH:   16,
  messagePaddingV:   10,
  maxBubbleWidth:    '82%',
} as const;
