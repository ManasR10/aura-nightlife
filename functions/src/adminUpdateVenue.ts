/**
 * adminUpdateVenue — callable Cloud Function.
 *
 * Allows a venue admin to update the admin-editable fields of their
 * assigned venue(s). Validates that the caller's UID exists in
 * /venueAdmins/{uid}.managedVenueIds before allowing the write.
 *
 * Admin-editable fields (enrichment only — no identity/truth fields):
 *   instagramHandle, phone, website, dressCode, ageLimit, coverCharge,
 *   openingNote, promotions, adminPhotos, bannerUrl
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

const db = getFirestore();

// Fields admins are allowed to write — enforced server-side
const ALLOWED_FIELDS = new Set([
  'instagramHandle',
  'phone',
  'website',
  'dressCode',
  'ageLimit',
  'coverCharge',
  'openingNote',
  'promotions',
  'adminPhotos',
  'bannerUrl',
]);

interface AdminUpdateData {
  venueId: string;
  updates: Record<string, unknown>;
}

export const adminUpdateVenue = onCall(
  { region: 'asia-south1' },
  async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

    const { venueId, updates } = req.data as AdminUpdateData;
    if (!venueId || !updates || typeof updates !== 'object') {
      throw new HttpsError('invalid-argument', 'venueId and updates are required.');
    }

    const uid = req.auth.uid;

    // ── Verify admin ownership ─────────────────────────────────────────────
    const adminSnap = await db.collection('venueAdmins').doc(uid).get();
    if (!adminSnap.exists) {
      throw new HttpsError('permission-denied', 'Not a venue admin.');
    }

    const adminDoc = adminSnap.data()!;
    const managedIds: string[] = adminDoc.managedVenueIds ?? [];

    if (!managedIds.includes(venueId)) {
      throw new HttpsError('permission-denied', 'You do not manage this venue.');
    }

    // ── Strip any disallowed fields ───────────────────────────────────────
    const safeUpdates: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(updates)) {
      if (ALLOWED_FIELDS.has(key)) {
        safeUpdates[key] = val;
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      throw new HttpsError('invalid-argument', 'No valid fields to update.');
    }

    safeUpdates['lastAdminUpdateAt'] = FieldValue.serverTimestamp();

    await db.collection('venues').doc(venueId).update(safeUpdates);

    return { success: true, updated: Object.keys(safeUpdates) };
  },
);

// ── Admin signal submission (venue-posted content, no geo required) ───────────

interface AdminSignalData {
  venueId:       string;
  // 'vibe' updates carry no media — mediaRef is optional for that type only
  signalType:    'video' | 'checkin' | 'vibe';
  mediaRef?:     string | null;
  thumbnailRef?: string | null;  // JPEG thumbnail uploaded separately by the client
  vibeTag?:      string;
}

export const adminSubmitSignal = onCall(
  { region: 'asia-south1' },
  async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

    const { venueId, mediaRef, thumbnailRef, signalType, vibeTag } = req.data as AdminSignalData;

    if (!venueId || !signalType) {
      throw new HttpsError('invalid-argument', 'venueId and signalType are required.');
    }
    if (signalType === 'video' && !mediaRef) {
      throw new HttpsError('invalid-argument', 'mediaRef is required for video signals.');
    }

    const uid = req.auth.uid;

    // Verify admin owns this venue
    const adminSnap = await db.collection('venueAdmins').doc(uid).get();
    if (!adminSnap.exists) throw new HttpsError('permission-denied', 'Not a venue admin.');

    const managedIds: string[] = adminSnap.data()!.managedVenueIds ?? [];
    if (!managedIds.includes(venueId)) {
      throw new HttpsError('permission-denied', 'You do not manage this venue.');
    }

    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + 2 * 60 * 60 * 1000);
    // weight: admin video=3, admin vibe/checkin=2
    const weight = signalType === 'video' ? 3 : 2;

    const signalRef = db.collection('liveSignals').doc();
    await signalRef.set({
      signalId:     signalRef.id,
      venueId,
      userId:       uid,
      sourceType:   'admin',
      signalType,
      mediaUrl:     mediaRef ?? null,
      thumbnailUrl: signalType === 'video' ? (thumbnailRef ?? null) : null,
      geoVerified:  true,
      vibeTag:      vibeTag ?? null,
      weight,
      viewCount:    0,
      createdAt:    now,
      expiresAt,
    });

    // Update venueLive
    const { recalculateVenueLive } = await import('./submitLiveSignal');
    await recalculateVenueLive(venueId);

    // Stamp venue admin update time
    await db.collection('venueLive').doc(venueId).set(
      { lastVenueUpdateAt: Timestamp.now() },
      { merge: true },
    );

    return { success: true, signalId: signalRef.id };
  },
);
