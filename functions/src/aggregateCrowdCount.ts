/**
 * aggregateCrowdCount — triggered when activeUsers under a venue changes
 * in Realtime Database. Recalculates the live crowd count.
 *
 * RTDB path: /liveCrowds/{venueId}/activeUsers/{userId}
 *
 * Prune stale users (last seen > 45 min ago) at the same time so counts
 * stay accurate even if app is backgrounded without a clean exit.
 */
import { onValueWritten } from 'firebase-functions/v2/database';
import { getDatabase } from 'firebase-admin/database';

const STALE_THRESHOLD_MS = 45 * 60 * 1000; // 45 minutes

export const aggregateCrowdCount = onValueWritten(
  '/liveCrowds/{venueId}/activeUsers/{userId}',
  async (event) => {
    const venueId = event.params.venueId;
    const rtdb = getDatabase();
    const crowdRef = rtdb.ref(`liveCrowds/${venueId}`);

    const snap = await crowdRef.get();
    if (!snap.exists()) return;

    const activeUsers: Record<string, number> = snap.child('activeUsers').val() ?? {};
    const now = Date.now();

    // Remove stale users
    const staleKeys = Object.entries(activeUsers)
      .filter(([, ts]) => now - ts > STALE_THRESHOLD_MS)
      .map(([uid]) => uid);

    const updates: Record<string, number | null> = {};
    for (const uid of staleKeys) {
      updates[`liveCrowds/${venueId}/activeUsers/${uid}`] = null;
    }

    // Recount
    const liveCount = Object.keys(activeUsers).length - staleKeys.length;
    updates[`liveCrowds/${venueId}/count`] = Math.max(0, liveCount);
    updates[`liveCrowds/${venueId}/lastUpdated`] = now;

    await rtdb.ref().update(updates);
  },
);
