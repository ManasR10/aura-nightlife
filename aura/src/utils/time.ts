/**
 * Relative-time formatting helpers — the canonical "Xm/h/d ago" used across
 * feed cards, venue detail, admin tabs, etc.
 */

/**
 * Format a timestamp as a short relative string: "Just now", "5m ago",
 * "3h ago", "2d ago". Accepts:
 *   - a number (unix ms)
 *   - a Date
 *   - any object with `toMillis()` (e.g. Firestore Timestamp)
 */
export function timeAgo(input: number | Date | { toMillis: () => number }): string {
  const ms =
    typeof input === 'number'         ? input :
    input instanceof Date             ? input.getTime() :
                                        input.toMillis();
  const mins = Math.floor((Date.now() - ms) / 60_000);
  return minutesToAgo(mins);
}

/** Same shape as `timeAgo` but you already have minutes elapsed. */
export function minutesToAgo(mins: number): string {
  if (mins < 1)    return 'Just now';
  if (mins < 60)   return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}
