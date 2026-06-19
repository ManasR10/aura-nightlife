/**
 * refreshVenueDetails — scheduled Cloud Function.
 *
 * Runs every 24 hours. Re-fetches full Place Details for all venues
 * in Firestore that were last enriched > 22 hours ago.
 * Updates opening hours, rating, attributes.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { fetchAndUpsertVenueDetail } from '../places/upsertVenue';
import type { VenueDoc } from '../types';

const REFRESH_INTERVAL_MS = 22 * 60 * 60 * 1000; // 22 hours
const BATCH_CONCURRENCY = 3; // Stay well within Places API rate limits

export const refreshVenueDetails = onSchedule(
  {
    schedule: 'every 24 hours',
    timeZone: 'Asia/Kolkata',
    region: 'asia-south1',
    secrets: ['PLACES_API_KEY'],
    timeoutSeconds: 540,
    memory: '256MiB',
  },
  async () => {
    const apiKey = process.env.PLACES_API_KEY;
    if (!apiKey) {
      console.error('PLACES_API_KEY not set');
      return;
    }

    const db = getFirestore();
    const staleThreshold = Timestamp.fromMillis(Date.now() - REFRESH_INTERVAL_MS);

    // Find venues that haven't been enriched recently
    const snap = await db
      .collection('venues')
      .where('lastEnrichedAt', '<', staleThreshold)
      .limit(100)
      .get();

    // Also pick up venues that have never been enriched
    const neverEnrichedSnap = await db
      .collection('venues')
      .where('lastEnrichedAt', '==', null)
      .limit(50)
      .get();

    const toRefresh = [
      ...snap.docs.map((d) => (d.data() as VenueDoc).placeId),
      ...neverEnrichedSnap.docs.map((d) => (d.data() as VenueDoc).placeId),
    ];

    const unique = [...new Set(toRefresh)];
    console.log(`refreshVenueDetails: refreshing ${unique.length} venues`);

    let refreshed = 0;
    let failed = 0;

    for (let i = 0; i < unique.length; i += BATCH_CONCURRENCY) {
      const batch = unique.slice(i, i + BATCH_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((placeId) => fetchAndUpsertVenueDetail(placeId, apiKey)),
      );
      for (const result of results) {
        if (result.status === 'fulfilled') refreshed++;
        else {
          failed++;
          console.warn('Failed to refresh venue:', result.reason);
        }
      }
      // Polite rate limiting between batches
      if (i + BATCH_CONCURRENCY < unique.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    console.log(`refreshVenueDetails done. refreshed=${refreshed}, failed=${failed}`);
  },
);
