/**
 * submitLiveSignal — callable Cloud Function.
 *
 * Accepts a user or admin live signal (video / check-in / vibe / crowd),
 * verifies the user's GPS location against the venue's geofence, stores
 * the signal in /liveSignals, then triggers a live-state recalculation.
 *
 * Called by the app immediately after a user uploads media or taps a
 * vibe button from the venue detail screen.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getNightKey } from './nightKey';

// Lazy accessor — calling getFirestore() at import time requires initializeApp()
// to have run first, which is true in production (index.ts) but not in tests
// that just import a pure helper from this file.
const db = () => getFirestore();

// Signal weights used for liveScore calculation
const WEIGHTS: Record<string, number> = {
  video_user:  5,   // geo-verified user video
  video_admin: 3,   // admin-posted venue video
  checkin:     2,
  vibe:        1,
  crowd:       1,
};

// Haversine distance (metres)

function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Live state recalculation
//
// Two concepts kept separate:
//   liveScore   → how ACTIVE is this venue right now? (counts all signals)
//   vibeLabel   → what MOOD/ENERGY are users reporting? (consensus of vibeTags)
//
// Effective weight per signal:
//   effectiveWeight = baseWeight × freshnessMultiplier × trustMultiplier
//
// freshnessMultiplier:  0–15 min → 1.0 | 15–45 → 0.75 | 45–90 → 0.45 | 90–120 → 0.2
// trustMultiplier:      geo-verified user video → 1.0 | admin video → 0.85 |
//                       admin vibe-only → 0.7  | other → 0.4

export async function recalculateVenueLive(venueId: string): Promise<void> {
  const TWO_HOURS_MS  = 2  * 60 * 60 * 1000;
  const THIRTY_MIN_MS = 30 * 60 * 1000;
  const now = Date.now();

  const snap = await db()
    .collection('liveSignals')
    .where('venueId', '==', venueId)
    .where('createdAt', '>=', Timestamp.fromMillis(now - TWO_HOURS_MS))
    .get();

  // Per-bucket vibe scores
  let hotScore  = 0;
  let okayScore = 0;
  let slowScore = 0;

  // Activity totals
  let liveScore         = 0;
  let activeSignalCount = 0;
  let recentCount       = 0;
  let lastUserUpdateAt:  Timestamp | null = null;
  let lastVenueUpdateAt: Timestamp | null = null;

  for (const doc of snap.docs) {
    const s        = doc.data();
    const ageMs    = now - (s.createdAt as Timestamp).toMillis();
    const baseW    = (s.weight as number) ?? 1;

    // Freshness decay
    const fresh =
      ageMs < 15 * 60_000 ? 1.0 :
      ageMs < 45 * 60_000 ? 0.75 :
      ageMs < 90 * 60_000 ? 0.45 : 0.2;

    // Source trust
    const trust =
      s.signalType === 'video' && s.geoVerified && s.sourceType === 'user' ? 1.0 :
      s.signalType === 'video' && s.sourceType === 'admin'                  ? 0.85 :
      s.sourceType === 'admin'                                               ? 0.7  :
      s.geoVerified                                                          ? 0.55 : 0.3;

    const eff = baseW * fresh * trust;

    // Vibe bucket — only tagged signals contribute
    if      (s.vibeTag === 'hot')  hotScore  += eff;
    else if (s.vibeTag === 'okay') okayScore += eff;
    else if (s.vibeTag === 'slow') slowScore += eff;

    // Activity (all signals, regardless of vibeTag)
    liveScore += eff;
    activeSignalCount++;
    if (ageMs < THIRTY_MIN_MS) recentCount++;

    if (s.sourceType === 'user') {
      if (!lastUserUpdateAt  || (s.createdAt as Timestamp) > lastUserUpdateAt)  lastUserUpdateAt  = s.createdAt as Timestamp;
    } else if (s.sourceType === 'admin') {
      if (!lastVenueUpdateAt || (s.createdAt as Timestamp) > lastVenueUpdateAt) lastVenueUpdateAt = s.createdAt as Timestamp;
    }
  }

  // Ongoing event — small context boost, not dominant
  const eventSnap = await db()
    .collection('events')
    .where('venueId', '==', venueId)
    .where('status', '==', 'ongoing')
    .limit(1)
    .get();

  if (!eventSnap.empty) {
    hotScore  += 1.5;   // events suggest energy
    okayScore += 0.5;
    liveScore += 6;     // activity boost for ongoing event
  }

  // Vibe consensus
  const totalVibeScore = hotScore + okayScore + slowScore;

  let vibeLabel: 'hot' | 'okay' | 'slow' | 'unknown' = 'unknown';
  let vibeConfidence  = 0;

  if (totalVibeScore >= 0.5) {
    const max = Math.max(hotScore, okayScore, slowScore);
    vibeConfidence = max / totalVibeScore;              // how decisive the consensus is
    vibeLabel      = max === hotScore  ? 'hot'  :
                     max === okayScore ? 'okay' : 'slow';
  }

  // Activity labels
  const crowdLabel =
    liveScore >= 20 ? 'packed' :
    liveScore >= 8  ? 'moderate' :
    liveScore >= 1  ? 'quiet' : null;

  const nowTs = Timestamp.now();

  await db().collection('venueLive').doc(venueId).set({
    venueId,
    // Activity
    liveScore,
    isLiveNow:           liveScore >= 2,
    isTrending:          recentCount >= 3,
    crowdLabel,
    activeSignalCount,
    lastUserUpdateAt,
    lastVenueUpdateAt,
    updatedAt:           nowTs,
    // Vibe consensus
    vibeLabel,
    vibeBreakdown:       { hot: hotScore, okay: okayScore, slow: slowScore },
    vibeConfidence,
    consensusSampleSize: activeSignalCount,
    lastConsensusAt:     nowTs,
  }, { merge: true });
}

// Cloud Function

export const VALID_VIBE_TAGS = ['hot', 'okay', 'slow'] as const;
export type VibeTag = typeof VALID_VIBE_TAGS[number];

// Reject location fixes older than this — prevents replay of stale GPS coords.
export const LOCATION_FRESHNESS_MS = 60 * 1000;
// Max signals per user per venue per hour — prevents spam-inflating activity scores.
export const SIGNAL_RATE_LIMIT_PER_HOUR = 6;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/** Pure helper exported for unit tests. */
export function isValidVibeTag(s: unknown): s is VibeTag {
  return typeof s === 'string' && (VALID_VIBE_TAGS as readonly string[]).includes(s);
}

/** Pure helper exported for unit tests. Returns true if the fix is fresh. */
export function isLocationFresh(locationTimestamp: unknown, now: number = Date.now()): boolean {
  if (typeof locationTimestamp !== 'number') return false;
  const age = now - locationTimestamp;
  return age >= 0 && age <= LOCATION_FRESHNESS_MS;
}

interface SubmitSignalData {
  venueId:            string;
  userLat:            number;
  userLng:            number;
  signalType:         'video' | 'checkin' | 'vibe' | 'crowd';
  mediaRef?:          string;             // video download URL
  thumbnailRef?:      string;             // JPEG thumbnail download URL (separate upload)
  vibeTag?:           string;             // 'hot' | 'okay' | 'slow'
  locationTimestamp?: number;             // unix ms; required (all signals here are user)
}

export const submitLiveSignal = onCall(
  { region: 'asia-south1' },
  async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

    const {
      venueId, userLat, userLng, signalType,
      mediaRef, thumbnailRef, vibeTag, locationTimestamp,
    } = req.data as SubmitSignalData;

    // Public callable always writes user signals. Admin/official posts go
    // through adminSubmitSignal which validates the caller against
    // venueAdmins/{uid} before tagging the signal as admin-sourced.
    const sourceType = 'user' as const;

    if (!venueId || userLat == null || userLng == null || !signalType) {
      throw new HttpsError('invalid-argument', 'venueId, userLat, userLng, signalType required.');
    }

    if (vibeTag != null && !isValidVibeTag(vibeTag)) {
      throw new HttpsError('invalid-argument', `vibeTag must be one of: ${VALID_VIBE_TAGS.join(', ')}.`);
    }

    // User signals must include a fresh GPS fix to prevent replay attacks.
    // Admin signals don't carry user GPS so they bypass this check.
    if (sourceType === 'user' && !isLocationFresh(locationTimestamp)) {
      throw new HttpsError(
        'failed-precondition',
        'Location fix is stale. Please refresh your location and try again.',
      );
    }

    const uid = req.auth.uid;

    // Rate limit (user signals only)
    // Admin signals come from venue dashboards and have their own throttling.
    if (sourceType === 'user') {
      const windowStart = Timestamp.fromMillis(Date.now() - RATE_LIMIT_WINDOW_MS);
      const recentSnap = await db().collection('liveSignals')
        .where('userId',    '==', uid)
        .where('venueId',   '==', venueId)
        .where('createdAt', '>=', windowStart)
        .count()
        .get();

      if (recentSnap.data().count >= SIGNAL_RATE_LIMIT_PER_HOUR) {
        throw new HttpsError(
          'resource-exhausted',
          `Too many signals for this venue. Try again later.`,
        );
      }
    }

    // Fetch venue for geofence check
    const venueSnap = await db().collection('venues').doc(venueId).get();
    if (!venueSnap.exists) throw new HttpsError('not-found', `Venue ${venueId} not found.`);

    const venue = venueSnap.data()!;
    const geofenceRadius: number = venue.geofenceRadius ?? 200;
    const { lat: venueLat, lng: venueLng } = venue.location as { lat: number; lng: number };

    const distMeters = haversineMeters(userLat, userLng, venueLat, venueLng);
    const geoVerified = distMeters <= geofenceRadius;

    // Video and checkin signals require geo verification
    if (!geoVerified && (signalType === 'video' || signalType === 'checkin')) {
      throw new HttpsError(
        'permission-denied',
        `Must be within ${geofenceRadius}m of the venue. You are ${Math.round(distMeters)}m away.`,
      );
    }

    // Determine weight
    // sourceType is always 'user' here; admin signals go via adminSubmitSignal.
    const weightKey = signalType === 'video' ? 'video_user' : signalType;
    const weight = WEIGHTS[weightKey] ?? 1;

    // Write live signal
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + 2 * 60 * 60 * 1000);

    const signalRef = db().collection('liveSignals').doc();
    await signalRef.set({
      signalId:      signalRef.id,
      venueId,
      userId:        uid,
      sourceType,
      signalType,
      mediaUrl:     mediaRef ?? null,
      thumbnailUrl: signalType === 'video' ? (thumbnailRef ?? null) : null,
      geoVerified,
      vibeTag:      vibeTag ?? null,
      weight,
      viewCount:    0,
      createdAt:    now,
      expiresAt,
    });

    // Advance check-in session for geo-verified user videos
    let sessionLevel: number | null = null;
    let cooldownRemainingSecs = 0;

    if (signalType === 'video' && geoVerified) {
      const nightKey = getNightKey();
      const sessionRef = db().collection('checkInSessions').doc(`${uid}_${venueId}_${nightKey}`);
      const sessionSnap = await sessionRef.get();

      if (sessionSnap.exists) {
        const s = sessionSnap.data()!;
        const level = s.level as number;
        const now2 = Timestamp.now();

        if (level === 1 && s.rewardStatus === 'locked') {
          await sessionRef.update({
            level: 2,
            lastClipAt: now2,
            clips: FieldValue.arrayUnion({ signalId: signalRef.id, uploadedAt: now2 }),
          });
          sessionLevel = 2;
        } else if (level === 2 && s.rewardStatus === 'locked') {
          const lastClipAt = s.lastClipAt as Timestamp | null;
          const elapsedMs = lastClipAt ? now2.toMillis() - lastClipAt.toMillis() : Infinity;
          const cooldownMs = 30 * 60 * 1000;

          if (elapsedMs >= cooldownMs) {
            await sessionRef.update({
              level: 3,
              lastClipAt: now2,
              rewardStatus: 'unlocked',
              clips: FieldValue.arrayUnion({ signalId: signalRef.id, uploadedAt: now2 }),
            });
            sessionLevel = 3;
          } else {
            // Cooldown not over — signal written, session stays at 2
            cooldownRemainingSecs = Math.ceil((cooldownMs - elapsedMs) / 1000);
            sessionLevel = 2;
          }
        } else {
          sessionLevel = level;
        }
      }
    }

    // Recalculate live state
    await recalculateVenueLive(venueId);

    return { success: true, signalId: signalRef.id, geoVerified, sessionLevel, cooldownRemainingSecs };
  },
);
