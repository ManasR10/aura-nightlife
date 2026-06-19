/**
 * validateContribution — atomic check-in + reward creation.
 *
 * Called from ClaimRewardScreen after GPS is confirmed client-side.
 * The client sends { venueId, upiId, userLat, userLng } in a single call.
 *
 * Server steps:
 *   1. Geofence — user must be within venue radius
 *   2. Daily rate-limit — max MAX_PER_DAY verified check-ins per user per day
 *   3. Per-venue nightly limit — max MAX_PER_VENUE per user per venue per night
 *   4. Create /checkins/{id} as verified=true (payout-ready)
 *   5. Create /rewards/{id} with UPI ID and status='pending'
 *
 * Payout is executed by processUpiPayout (Phase 4, triggered on reward create).
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { VenueDoc } from './types';

const MAX_PER_DAY   = 5;   // max check-ins per user across all venues per day
const MAX_PER_VENUE = 2;   // max check-ins per user per venue per night
const REWARD_INR    = 10;
const GEOFENCE_M    = 200; // default radius in metres — per-venue override in Phase 2

// Strict UPI VPA: at least one allowed char before '@', alphabetic handle after.
// Matches handles like name@okaxis, 9876543210@paytm.
export const UPI_ID_REGEX = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{2,63}$/;

/** Pure helper exported for unit tests. */
export function isValidUpiId(s: string): boolean {
  return UPI_ID_REGEX.test(s.trim());
}

/** Great-circle distance in metres; exported for unit tests. */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return distanceMetres(lat1, lng1, lat2, lng2);
}

function distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface ContributionData {
  venueId: string;
  upiId:   string;
  userLat: number;
  userLng: number;
}

export const validateContribution = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

  const { venueId, upiId, userLat, userLng } = request.data as ContributionData;

  if (!venueId || !upiId?.trim() || userLat == null || userLng == null) {
    throw new HttpsError('invalid-argument', 'venueId, upiId, userLat, userLng are all required.');
  }
  const trimmedUpi = upiId.trim();
  if (!isValidUpiId(trimmedUpi)) {
    throw new HttpsError('invalid-argument', 'upiId must be a valid UPI ID (e.g. name@okaxis).');
  }

  const uid = request.auth.uid;
  const db  = getFirestore();

  // 1. Geofence
  const venueSnap = await db.collection('venues').doc(venueId).get();
  if (!venueSnap.exists) throw new HttpsError('not-found', 'Venue not found.');

  const venue   = venueSnap.data() as VenueDoc;
  const radius  = GEOFENCE_M;
  const dist    = distanceMetres(userLat, userLng, venue.location.lat, venue.location.lng);

  if (dist > radius) {
    throw new HttpsError(
      'failed-precondition',
      `You are ${Math.round(dist)} m from ${venue.name} (max ${radius} m). Move closer and try again.`,
    );
  }

  // 2. Daily rate-limit
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const dailySnap = await db.collection('checkins')
    .where('userId',   '==', uid)
    .where('verified', '==', true)
    .where('timestamp', '>=', Timestamp.fromDate(todayStart))
    .get();

  if (dailySnap.size >= MAX_PER_DAY) {
    throw new HttpsError('resource-exhausted', `Daily limit of ${MAX_PER_DAY} check-ins reached. Come back tomorrow!`);
  }

  // 3. Per-venue nightly limit (8 PM → now)
  const nightStart = new Date();
  nightStart.setHours(20, 0, 0, 0);
  if (new Date() < nightStart) {
    // Before 8 PM: use midnight of previous night as window start
    nightStart.setDate(nightStart.getDate() - 1);
  }

  const venueNightSnap = await db.collection('checkins')
    .where('userId',   '==', uid)
    .where('venueId',  '==', venueId)
    .where('verified', '==', true)
    .where('timestamp', '>=', Timestamp.fromDate(nightStart))
    .get();

  if (venueNightSnap.size >= MAX_PER_VENUE) {
    throw new HttpsError('resource-exhausted', `You've already checked in here ${MAX_PER_VENUE} times tonight.`);
  }

  // 4. Atomic write: checkin + reward
  const checkinRef = db.collection('checkins').doc();
  const rewardRef  = db.collection('rewards').doc();
  const now        = FieldValue.serverTimestamp();

  const batch = db.batch();

  batch.set(checkinRef, {
    userId:       uid,
    venueId,
    timestamp:    now,
    verified:     true,
    rewardAmount: REWARD_INR,
    mediaUrls:    [],
    vibeRating:   0,
    crowdRating:  0,
    caption:      '',
  });

  // Note: upiId is intentionally NOT stored on the reward doc — it's read from
  // /users/{uid} at payout time. This prevents UPI ID enumeration if a venue
  // admin account is compromised.
  batch.set(rewardRef, {
    userId:    uid,
    checkinId: checkinRef.id,
    amount:    REWARD_INR,
    status:    'pending',
    paidAt:    null,
    createdAt: now,
  });

  await batch.commit();

  return {
    checkinId: checkinRef.id,
    rewardId:  rewardRef.id,
    amount:    REWARD_INR,
  };
});
