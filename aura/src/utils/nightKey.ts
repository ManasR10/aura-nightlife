export function getNightKey(nowMs = Date.now()): string {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(nowMs + IST_OFFSET_MS);
  const h = nowIST.getUTCHours();
  const m = nowIST.getUTCMinutes();
  if (h < 3 || (h === 3 && m < 30)) {
    nowIST.setUTCDate(nowIST.getUTCDate() - 1);
  }
  return nowIST.toISOString().slice(0, 10);
}
