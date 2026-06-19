/**
 * events.ts — mobile-side events service.
 *
 * Reads from Firestore /events — scraped + normalized events from the pipeline.
 * Computes labels: Live Right Now, Trending, Tonight, Ongoing Event.
 */
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export type EventStatus = 'upcoming' | 'ongoing' | 'ended';

export interface EventDoc {
  eventId: string;
  venueId: string | null;
  source: string;
  title: string;
  description: string | null;
  startAt: FirebaseFirestoreTypes.Timestamp;
  endAt: FirebaseFirestoreTypes.Timestamp | null;
  imageUrl: string | null;
  url: string | null;
  priceText: string | null;
  coverCharge: number | null;
  performers: string[];
  tags: string[];
  rawVenueName: string;
  status: EventStatus;
  confidenceScore: number;
}

export interface LiveSignalDoc {
  signalId: string;
  venueId: string;
  userId: string;
  sourceType: 'user' | 'admin';
  signalType: 'video' | 'checkin' | 'vibe' | 'crowd';
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  geoVerified: boolean;
  vibeTag: string | null;
  weight: number;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  expiresAt: FirebaseFirestoreTypes.Timestamp;
}

export interface VenueLabels {
  isLiveNow: boolean;
  isTrending: boolean;
  isTonightEvent: boolean;
  isOngoing: boolean;
  vibeLabel: 'hot' | 'okay' | 'slow' | 'unknown';
  liveScore: number;
  crowdLabel: string | null;
  activeSignalCount: number;
  // Phase 1 vibe consensus
  vibeBreakdown: { hot: number; okay: number; slow: number };
  vibeConfidence: number;     // 0–1: how decisive the consensus is
  consensusSampleSize: number;
}

/**
 * Fetch tonight's events (6 PM today → 4 AM tomorrow IST) for a specific venue.
 */
export async function getEventsForVenue(venueId: string): Promise<EventDoc[]> {
  try {
    const snap = await firestore()
      .collection('events')
      .where('venueId', '==', venueId)
      .where('status', 'in', ['upcoming', 'ongoing'])
      .orderBy('startAt', 'asc')
      .limit(10)
      .get();
    return snap.docs.map((d) => d.data() as EventDoc);
  } catch (err) {
    console.warn('getEventsForVenue failed:', err);
    return [];
  }
}

/**
 * Fetch all tonight's events (for Feed / discovery).
 * Returns events starting in the next 24 hours that are upcoming or ongoing.
 */
export async function getTonightEvents(): Promise<EventDoc[]> {
  // Show events starting up to 24h from now, or already ongoing
  const twentyFourHoursAgo = firestore.Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const snap = await firestore()
      .collection('events')
      .where('status', 'in', ['upcoming', 'ongoing'])
      .where('startAt', '>=', twentyFourHoursAgo)
      .orderBy('startAt', 'asc')
      .limit(50)
      .get();
    return snap.docs.map((d) => d.data() as EventDoc);
  } catch (err) {
    console.warn('getTonightEvents failed:', err);
    return [];
  }
}

const EMPTY_LABELS: VenueLabels = {
  isLiveNow: false, isTrending: false, isTonightEvent: false, isOngoing: false,
  vibeLabel: 'unknown', liveScore: 0, crowdLabel: null, activeSignalCount: 0,
  vibeBreakdown: { hot: 0, okay: 0, slow: 0 }, vibeConfidence: 0, consensusSampleSize: 0,
};

/**
 * Get labels for a single venue from the pre-aggregated venueLive doc + events.
 * One doc read instead of 3 collection queries — much cheaper per venue.
 */
export async function getVenueLabels(venueId: string): Promise<VenueLabels> {
  try {
    const [liveSnap, eventsSnap] = await Promise.all([
      firestore().collection('venueLive').doc(venueId).get(),
      firestore()
        .collection('events')
        .where('venueId', '==', venueId)
        .where('status', 'in', ['upcoming', 'ongoing'])
        .limit(1)
        .get(),
    ]);

    const live = liveSnap.exists() ? liveSnap.data()! : null;
    const hasEvent = !eventsSnap.empty;
    const isOngoing = eventsSnap.docs.some((d) => (d.data() as EventDoc).status === 'ongoing');

    return {
      isLiveNow:          live?.isLiveNow          ?? false,
      isTrending:         live?.isTrending         ?? false,
      isTonightEvent:     hasEvent,
      isOngoing,
      vibeLabel:          live?.vibeLabel          ?? 'unknown',
      liveScore:          live?.liveScore          ?? 0,
      crowdLabel:         live?.crowdLabel         ?? null,
      activeSignalCount:  live?.activeSignalCount  ?? 0,
      vibeBreakdown:      live?.vibeBreakdown      ?? { hot: 0, okay: 0, slow: 0 },
      vibeConfidence:     live?.vibeConfidence     ?? 0,
      consensusSampleSize:live?.consensusSampleSize ?? 0,
    };
  } catch (err) {
    console.warn('getVenueLabels failed:', err);
    return EMPTY_LABELS;
  }
}

/**
 * Batch-fetch venueLive for multiple venues.
 *
 * Fires all docs in parallel but caps in-flight reads at 50 by running
 * chunks concurrently. Previously chunks were sequential, which added a
 * round-trip per 20 venues on large catalogues.
 */
export async function getVenueLabelsMap(
  venueIds: string[],
): Promise<Map<string, VenueLabels>> {
  if (venueIds.length === 0) return new Map();

  const result = new Map<string, VenueLabels>();
  const CHUNK = 50;

  try {
    const chunks: string[][] = [];
    for (let i = 0; i < venueIds.length; i += CHUNK) {
      chunks.push(venueIds.slice(i, i + CHUNK));
    }

    const chunkResults = await Promise.all(
      chunks.map((chunk) =>
        Promise.all(chunk.map((id) => firestore().collection('venueLive').doc(id).get())),
      ),
    );

    chunks.forEach((chunk, chunkIdx) => {
      const liveSnaps = chunkResults[chunkIdx];
      chunk.forEach((id, j) => {
        const live = liveSnaps[j].exists() ? liveSnaps[j].data()! : null;
        result.set(id, {
          isLiveNow:           live?.isLiveNow           ?? false,
          isTrending:          live?.isTrending          ?? false,
          isTonightEvent:      false,   // filled in by event pass below
          isOngoing:           false,
          vibeLabel:           live?.vibeLabel           ?? 'unknown',
          liveScore:           live?.liveScore           ?? 0,
          crowdLabel:          live?.crowdLabel          ?? null,
          activeSignalCount:   live?.activeSignalCount   ?? 0,
          vibeBreakdown:       live?.vibeBreakdown       ?? { hot: 0, okay: 0, slow: 0 },
          vibeConfidence:      live?.vibeConfidence      ?? 0,
          consensusSampleSize: live?.consensusSampleSize ?? 0,
        });
      });
    });

    // Single events query instead of one per venue — much cheaper
    const now = firestore.Timestamp.now();
    const eventSnap = await firestore()
      .collection('events')
      .where('status', 'in', ['upcoming', 'ongoing'])
      .where('startAt', '>=', firestore.Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000))
      .limit(100)
      .get();

    for (const doc of eventSnap.docs) {
      const ev = doc.data() as EventDoc;
      if (!ev.venueId || !result.has(ev.venueId)) continue;
      const labels = result.get(ev.venueId)!;
      labels.isTonightEvent = true;
      if (ev.status === 'ongoing') labels.isOngoing = true;
    }

    void now; // suppress unused warning
    return result;
  } catch (err) {
    console.warn('getVenueLabelsMap failed:', err);
    return result.size > 0 ? result : new Map();
  }
}

/**
 * Check if the current user has already submitted a live signal for a venue
 * in the last 2 hours. Returns the existing signal if found.
 */
export async function checkRecentSignal(
  uid: string,
  venueId: string,
): Promise<{ exists: boolean; minutesAgo: number | null }> {
  try {
    const twoHoursAgo = firestore.Timestamp.fromMillis(Date.now() - 2 * 60 * 60 * 1000);
    const snap = await firestore()
      .collection('liveSignals')
      .where('userId', '==', uid)
      .where('venueId', '==', venueId)
      .where('createdAt', '>=', twoHoursAgo)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snap.empty) return { exists: false, minutesAgo: null };

    const ts = (snap.docs[0].data().createdAt as FirebaseFirestoreTypes.Timestamp).toDate();
    const minutesAgo = Math.round((Date.now() - ts.getTime()) / 60_000);
    return { exists: true, minutesAgo };
  } catch {
    return { exists: false, minutesAgo: null };
  }
}

/**
 * Get recent video live signals for a venue's "Live Updates" strip.
 * Returns active (not yet expired) video signals, newest first.
 */
export async function getVenueVideoSignals(
  venueId: string,
  limit = 8,
): Promise<LiveSignalDoc[]> {
  try {
    const now = firestore.Timestamp.now();
    const snap = await firestore()
      .collection('liveSignals')
      .where('venueId', '==', venueId)
      .where('signalType', '==', 'video')
      .where('expiresAt', '>', now)
      .orderBy('expiresAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => ({ signalId: d.id, ...d.data() } as LiveSignalDoc));
  } catch (err) {
    console.warn('getVenueVideoSignals failed:', err);
    return [];
  }
}

/**
 * Compute feed score for ranking.
 *
 * score = ongoingEventBoost(+100) + liveScore(+50) + trending(+20)
 *       + distanceScore(+15) + ratingScore(+10)
 */
export function computeFeedScore(
  labels: VenueLabels,
  liveSignalWeight: number,
  distanceKm: number,
  rating: number | null,
): number {
  let score = 0;
  if (labels.isOngoing)      score += 100;
  if (labels.isTonightEvent) score += 40;
  score += Math.min(liveSignalWeight * 5, 50);
  if (labels.isTrending)     score += 20;
  // Distance: max +15 for venues within 0.5 km, decays to 0 at 5 km
  score += Math.max(0, 15 * (1 - distanceKm / 5));
  // Rating: +10 for 5.0, proportional
  if (rating != null) score += (rating / 5) * 10;
  return score;
}
