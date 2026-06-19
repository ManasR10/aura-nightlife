// Font scale extracted from Lovable design (text-[n] classes + font-* classes)

export const FONT_SIZE = {
  xs:      10, // text-[10px]
  sm:      11, // text-[11px]
  base:    12, // text-xs
  md:      13, // text-[13px]
  body:    14, // text-sm
  bodyLg:  15, // text-[15px]
  lg:      16, // text-base
  xl:      18, // text-lg
  xxl:     20, // text-xl
  heading: 22, // text-2xl (approx)
  title:   24, // text-2xl
  display: 28, // text-3xl (approx)
  hero:    32, // text-3xl
  logo:    40, // text-4xl / text-5xl
} as const;

export const FONT_WEIGHT = {
  regular:   '400' as const,
  medium:    '500' as const,
  semibold:  '600' as const,
  bold:      '700' as const,
  extrabold: '800' as const,
} as const;

// System font stack — matches Lovable's body font declaration
// (-apple-system on iOS, Roboto on Android, both excellent for dark UI)
export const FONT_FAMILY = undefined; // uses OS default
