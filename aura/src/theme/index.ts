export { COLORS } from './colors';
export type { ColorKey } from './colors';
export { SPACING, RADIUS } from './spacing';
export { FONT_SIZE, FONT_WEIGHT } from './typography';

// Legacy aliases kept for backward compatibility with existing components
export const FONTS = {
  title:   28,
  heading: 20,
  body:    15,
  caption: 12,
} as const;
