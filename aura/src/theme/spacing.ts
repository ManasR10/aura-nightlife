// 4 px base scale matching Tailwind spacing used in Lovable

export const SPACING = {
  xs:   4,  // p-1 / gap-1
  sm:   8,  // p-2 / gap-2
  md:   12, // p-3 / gap-3
  base: 16, // p-4 / gap-4 — default horizontal padding
  lg:   20, // p-5
  xl:   24, // p-6
  xxl:  32, // p-8
  xxxl: 48, // p-12
} as const;

export const RADIUS = {
  sm:   8,   // rounded-lg
  md:   12,  // rounded-xl
  lg:   16,  // rounded-2xl
  xl:   20,  // rounded-3xl
  full: 999, // rounded-full
} as const;
