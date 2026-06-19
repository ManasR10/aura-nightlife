/**
 * Age gating for AURA — a nightlife app where the legal drinking age in our
 * launch markets (Mumbai/Delhi/Bangalore) is 21+. The signup gate and the
 * onboarding consent checkbox must agree.
 */

export const MIN_AGE = 21;

/** Whole years between `dob` and `at` (defaults to now), counting birthdays. */
export function yearsOld(dob: Date, at: Date = new Date()): number {
  let years = at.getFullYear() - dob.getFullYear();
  const m = at.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < dob.getDate())) {
    years -= 1;
  }
  return years;
}

/** True if `dobStr` (YYYY-MM-DD) parses cleanly and the person is MIN_AGE+. */
export function meetsMinAge(dobStr: string, at: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dobStr.trim())) return false;
  const dob = new Date(dobStr + 'T00:00:00');
  if (Number.isNaN(dob.getTime())) return false;
  if (dob > at) return false;
  return yearsOld(dob, at) >= MIN_AGE;
}
