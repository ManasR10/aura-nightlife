/**
 * publishEvents — writes normalized + deduplicated events to Firestore /events.
 *
 * Also saves raw payloads to /scrapeRaw for debugging and reprocessing.
 */
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { NormalizedEvent } from './normalizeEvent';
import { toEventDoc } from './normalizeEvent';
import type { ScrapeRawDoc, EventSource } from '../types';
import type { RawScrapedEvent } from '../types';

/**
 * Saves raw scraped payloads to /scrapeRaw.
 */
export async function saveRawEvents(
  source: EventSource,
  payloads: RawScrapedEvent[],
  error: string | null = null,
): Promise<void> {
  const db = getFirestore();
  const batch = db.batch();

  const doc: ScrapeRawDoc = {
    source,
    payload: payloads,
    scrapedAt: Timestamp.now(),
    processed: false,
    error,
  };

  const ref = db.collection('scrapeRaw').doc(`${source}-${Date.now()}`);
  batch.set(ref, doc);
  await batch.commit();
}

/**
 * Writes normalized + venue-matched events to /events.
 * Uses eventId as document ID for idempotent upserts.
 */
export async function publishEvents(
  events: Array<{
    normalized: NormalizedEvent;
    venueId: string | null;
    confidenceScore: number;
  }>,
): Promise<{ written: number; skipped: number }> {
  const db = getFirestore();
  let written = 0;
  const skipped = 0;

  const batch = db.batch();

  for (const { normalized, venueId, confidenceScore } of events) {
    const eventDoc = toEventDoc(normalized, venueId, confidenceScore);
    const ref = db.collection('events').doc(eventDoc.eventId);
    batch.set(ref, eventDoc, { merge: true });
    written++;
  }

  if (written > 0) await batch.commit();

  // Mark raw docs as processed
  const rawSnap = await db
    .collection('scrapeRaw')
    .where('processed', '==', false)
    .limit(20)
    .get();

  if (!rawSnap.empty) {
    const markBatch = db.batch();
    for (const doc of rawSnap.docs) {
      markBatch.update(doc.ref, { processed: true });
    }
    await markBatch.commit();
  }

  return { written, skipped };
}

/**
 * Expire events that have ended more than 24 hours ago.
 */
export async function expireEndedEvents(): Promise<number> {
  const db = getFirestore();
  const cutoff = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);

  const snap = await db
    .collection('events')
    .where('status', '==', 'ended')
    .where('endAt', '<', cutoff)
    .limit(100)
    .get();

  if (snap.empty) return 0;

  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
  return snap.size;
}
