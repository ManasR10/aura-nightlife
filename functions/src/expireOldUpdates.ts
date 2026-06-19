/**
 * expireOldUpdates — runs every 30 minutes via Cloud Scheduler.
 * Deletes live updates in Realtime Database that have passed their expiresAt
 * timestamp (updates expire 2 hours after posting).
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getDatabase } from 'firebase-admin/database';

export const expireOldUpdates = onSchedule('every 30 minutes', async () => {
  const rtdb = getDatabase();
  const now = Date.now();

  const venuesSnap = await rtdb.ref('liveUpdates').get();
  if (!venuesSnap.exists()) return;

  const updates: Record<string, null> = {};

  venuesSnap.forEach((venueNode) => {
    venueNode.forEach((updateNode) => {
      const data = updateNode.val() as { expiresAt: number };
      if (data.expiresAt <= now) {
        updates[`liveUpdates/${venueNode.key}/${updateNode.key}`] = null;
      }
    });
  });

  if (Object.keys(updates).length > 0) {
    await rtdb.ref().update(updates);
    console.log(`Expired ${Object.keys(updates).length} live updates.`);
  }
});
