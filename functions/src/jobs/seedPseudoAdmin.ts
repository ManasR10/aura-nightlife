/**
 * seedPseudoAdmin — one-shot callable that creates a test venue admin.
 *
 * Call once from Firebase Console → Functions → seedPseudoAdmin → Test.
 * Safe to call multiple times (idempotent — skips existing Auth user).
 *
 * Creates:
 *   Firebase Auth user      (credentials supplied by caller via request.data)
 *   /users/{uid}            role: venue_admin, profileCompleted, onboardingCompleted
 *   /venueAdmins/{uid}      managedVenueIds: ['demo-venue-corner-room']
 *   /venues/demo-venue-corner-room   a usable demo venue doc
 */
import { onCall } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const DEMO_VENUE_ID  = 'demo-venue-corner-room';
// Callers may override email/password/name via request.data for flexibility.
// Defaults are dev-only placeholders — rotate or override before any real use.
// No hardcoded fallback credentials — callers must supply email/password
// via request.data or SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD env vars.
const DEFAULT_EMAIL  = process.env.SEED_ADMIN_EMAIL    ?? '';
const DEFAULT_PWD    = process.env.SEED_ADMIN_PASSWORD ?? '';
const DEFAULT_NAME   = 'Corner Room Admin';

export const seedPseudoAdmin = onCall(
  { region: 'asia-south1' },
  async (req) => {
    if (!req.auth) throw new Error('Must be signed in.');

    const db   = getFirestore();
    const auth = getAuth();

    // Hard-gated on /superAdmins/{uid}. Heuristic project-name checks are
    // fragile; this requires explicit privilege regardless of environment.
    const superSnap = await db.collection('superAdmins').doc(req.auth.uid).get();
    if (!superSnap.exists) {
      throw new Error('seedPseudoAdmin requires super-admin privilege.');
    }

    // Accept caller-supplied credentials; fall back to env/defaults
    const { email = DEFAULT_EMAIL, password = DEFAULT_PWD, displayName = DEFAULT_NAME } =
      (req.data ?? {}) as { email?: string; password?: string; displayName?: string };

    if (!email || !password) {
      throw new Error('Pass { email, password } in request.data or set SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD env vars.');
    }

    // 1. Create (or find) the Firebase Auth user
    let uid: string;
    try {
      const existing = await auth.getUserByEmail(email);
      uid = existing.uid;
    } catch {
      // user-not-found → create
      const created = await auth.createUser({
        email,
        password,
        displayName,
        emailVerified: true,
      });
      uid = created.uid;
    }

    const now = Timestamp.now();

    // 2. /users/{uid}
    await db.collection('users').doc(uid).set({
      uid,
      phoneNumber:        '',
      displayName,
      profilePhoto:       '',
      upiId:              '',
      rewardsBalance:     0,
      totalEarned:        0,
      role:               'venue_admin',
      profileCompleted:   true,
      onboardingCompleted:true,
      fcmToken:           '',
      preferences: {
        auraVibes:        [],
        nightTypes:       [],
        crowdPreference:  '',
        travelDistance:   '',
      },
      createdAt:   now,
      lastLoginAt: now,
    }, { merge: true });

    // 3. /venueAdmins/{uid}
    await db.collection('venueAdmins').doc(uid).set({
      uid,
      managedVenueIds: [DEMO_VENUE_ID],
      email,
      displayName,
      createdAt:       now,
    }, { merge: true });

    // 4. /venues/demo-venue-corner-room
    await db.collection('venues').doc(DEMO_VENUE_ID).set({
      placeId:      DEMO_VENUE_ID,
      name:         'Corner Room',
      address:      'Bandra West, Mumbai, Maharashtra',
      location:     { lat: 19.0548, lng: 72.8402 },
      rating:       4.4,
      userRatingCount: 312,
      priceLevel:   '₹₹',
      types:        ['bar', 'night_club'],
      isOpen:       true,
      currentOpeningHours: [
        'Monday: Closed',
        'Tuesday: 6:00 PM – 1:30 AM',
        'Wednesday: 6:00 PM – 1:30 AM',
        'Thursday: 6:00 PM – 1:30 AM',
        'Friday: 6:00 PM – 1:30 AM',
        'Saturday: 6:00 PM – 1:30 AM',
        'Sunday: 6:00 PM – 1:30 AM',
      ],
      phone:   '+91 98200 00000',
      website: 'https://cornerroom.in',
      attributes: {
        liveMusic:       false,
        servesCocktails: true,
        goodForGroups:   true,
        outdoorSeating:  false,
      },
      photos:        [],   // no Places API photos; admin can add via adminPhotos field
      source:        'google_places',
      lastFetchedAt: now,
      lastEnrichedAt: now,
    }, { merge: true });

    return {
      success:  true,
      uid,
      email,
      venueId:  DEMO_VENUE_ID,
      venueName:'Corner Room',
      message:  'Pseudo admin ready. Log in via Venue Login on the Entry screen.',
    };
  },
);
