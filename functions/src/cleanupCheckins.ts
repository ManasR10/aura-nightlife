/**
 * cleanupCheckins — daily scheduled job.
 * Archives (deletes) check-in documents older than 24 hours that are
 * already verified, keeping Firestore lean. Unverified check-ins older
 * than 2 hours are also removed (abandoned submissions).
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const BATCH_SIZE = 400; // Firestore batch limit is 500

export const cleanupCheckins = onSchedule('every 24 hours', async () => {
  const db = getFirestore();
  const now = Date.now();

  const cutoffVerified = Timestamp.fromMillis(now - 24 * 60 * 60 * 1000);
  const cutoffUnverified = Timestamp.fromMillis(now - 2 * 60 * 60 * 1000);

  let totalDeleted = 0;

  // 1. Verified check-ins older than 24 h
  const verifiedSnap = await db.collection('checkins')
    .where('verified', '==', true)
    .where('timestamp', '<', cutoffVerified)
    .limit(BATCH_SIZE)
    .get();

  // 2. Unverified check-ins older than 2 h
  const unverifiedSnap = await db.collection('checkins')
    .where('verified', '==', false)
    .where('timestamp', '<', cutoffUnverified)
    .limit(BATCH_SIZE)
    .get();

  const toDelete = [...verifiedSnap.docs, ...unverifiedSnap.docs];

  if (toDelete.length === 0) {
    console.log('No check-ins to clean up.');
    return;
  }

  // Delete in batches
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    toDelete.slice(i, i + BATCH_SIZE).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    totalDeleted += Math.min(BATCH_SIZE, toDelete.length - i);
  }

  console.log(`Cleaned up ${totalDeleted} check-in documents.`);
});
