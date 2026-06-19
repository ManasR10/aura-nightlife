/**
 * startCheckIn — GPS-verified check-in callable.
 *
 * Creates a checkInSessions doc at level 1 if the user is within geofence.
 * Idempotent: if a session already exists for this night+venue, returns
 * the current state without overwriting.
 *
 * Session ID format: `{uid}_{venueId}_{nightKey}` (nightKey resets at 03:30 IST)
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getNightKey } from './nightKey';

const db = getFirestore();

function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const startCheckIn = onCall(
  { region: 'asia-south1' },
  async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

    const { venueId, userLat, userLng } = req.data as {
      venueId: string;
      userLat: number;
      userLng: number;
    };

    if (!venueId || userLat == null || userLng == null) {
      throw new HttpsError('invalid-argument', 'venueId, userLat, userLng required.');
    }

    const uid = req.auth.uid;

    // Geofence check
    const venueSnap = await db.collection('venues').doc(venueId).get();
    if (!venueSnap.exists) throw new HttpsError('not-found', `Venue ${venueId} not found.`);

    const venue = venueSnap.data()!;
    const geofenceRadius: number = venue.geofenceRadius ?? 200;
    const venueName: string = venue.name ?? '';
    const { lat: venueLat, lng: venueLng } = venue.location as { lat: number; lng: number };

    const distMeters = haversineMeters(userLat, userLng, venueLat, venueLng);
    if (distMeters > geofenceRadius) {
      throw new HttpsError(
        'permission-denied',
        `Must be within ${geofenceRadius}m of the venue. You are ${Math.round(distMeters)}m away.`,
      );
    }

    const nightKey = getNightKey();
    const sessionId = `${uid}_${venueId}_${nightKey}`;
    const sessionRef = db.collection('checkInSessions').doc(sessionId);
    const sessionSnap = await sessionRef.get();

    // Idempotent — return existing session state
    if (sessionSnap.exists) {
      const data = sessionSnap.data()!;
      const lastClipAt = data.lastClipAt as Timestamp | null;
      const cooldownMs = 30 * 60 * 1000;
      const cooldownRemainingSecs = lastClipAt
        ? Math.max(0, Math.ceil((lastClipAt.toMillis() + cooldownMs - Date.now()) / 1000))
        : 0;
      return {
        level: data.level as number,
        rewardStatus: data.rewardStatus as string,
        lastClipAtMs: lastClipAt?.toMillis() ?? null,
        cooldownRemainingSecs,
        alreadyCheckedIn: true,
      };
    }

    // New session
    const now = Timestamp.now();
    await sessionRef.set({
      uid,
      venueId,
      venueName,
      nightKey,
      level: 1,
      checkedInAt: now,
      clips: [],
      lastClipAt: null,
      rewardStatus: 'locked',
      rewardId: null,
    });

    return {
      level: 1,
      rewardStatus: 'locked',
      lastClipAtMs: null,
      cooldownRemainingSecs: 0,
      alreadyCheckedIn: false,
    };
  },
);
