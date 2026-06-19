/**
 * updateEventStatus — scheduled every 30 minutes.
 *
 * Moves events through their lifecycle automatically:
 *   upcoming  → ongoing   when startAt <= now
 *   ongoing   → ended     when endAt < now, OR startAt + 6 h < now (no endAt set)
 *
 * Only processes 'manual' events created via adminCreateEvent.
 * Scraped events (BookMyShow etc.) have their own pipeline for status updates.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const db = getFirestore();

export const updateEventStatus = onSchedule(
  {
    schedule:  'every 30 minutes',
    timeZone:  'Asia/Kolkata',
    region:    'asia-south1',
  },
  async () => {
    const now = Timestamp.now();
    const nowMs = now.toMillis();
    // Events without an explicit endAt are considered ended 6 hours after startAt
    const DEFAULT_DURATION_MS = 6 * 60 * 60 * 1000;

    const batch = db.batch();
    let writes = 0;

    // upcoming → ongoing
    const toOngoing = await db.collection('events')
      .where('status', '==', 'upcoming')
      .where('source', '==', 'manual')
      .where('startAt', '<=', now)
      .limit(50)
      .get();

    for (const doc of toOngoing.docs) {
      batch.update(doc.ref, { status: 'ongoing' });
      writes++;
    }

    // ongoing → ended
    const toEnd = await db.collection('events')
      .where('status', '==', 'ongoing')
      .where('source', '==', 'manual')
      .limit(50)
      .get();

    for (const doc of toEnd.docs) {
      const d = doc.data();
      const startMs: number = d.startAt?.toMillis?.() ?? nowMs;
      const endMs: number | null = d.endAt?.toMillis?.() ?? null;
      const effectiveEndMs = endMs ?? (startMs + DEFAULT_DURATION_MS);

      if (nowMs >= effectiveEndMs) {
        batch.update(doc.ref, { status: 'ended' });
        writes++;
      }
    }

    if (writes > 0) {
      await batch.commit();
      console.log(`updateEventStatus: ${writes} events updated`);
    } else {
      console.log('updateEventStatus: no changes needed');
    }
  },
);
