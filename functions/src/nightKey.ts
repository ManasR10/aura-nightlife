/**
 * nightKey — the date string that identifies a nightlife session.
 *
 * Nights run from ~6 PM to 3:30 AM IST (spanning midnight).
 * If the current IST time is before 03:30, we're still in the previous night.
 *
 * Returns: 'YYYY-MM-DD' (date the night *started*)
 */
export function getNightKey(nowMs = Date.now()): string {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(nowMs + IST_OFFSET_MS);

  // Before 03:30 IST → still part of the previous calendar night
  const h = nowIST.getUTCHours();
  const m = nowIST.getUTCMinutes();
  if (h < 3 || (h === 3 && m < 30)) {
    nowIST.setUTCDate(nowIST.getUTCDate() - 1);
  }

  return nowIST.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}
