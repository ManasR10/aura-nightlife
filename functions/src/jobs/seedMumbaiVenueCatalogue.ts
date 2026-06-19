/**
 * seedMumbaiVenueCatalogue — callable that populates /venues with Mumbai
 * nightlife spots across all major zones.
 *
 * For each zone it calls the Places API (New) Nearby Search for
 * bars + night_clubs, deduplicates by placeId, derives discovery metadata
 * (zone, nightlifeCategory, vibeTags, discoveryPriority), then upserts to
 * /venues using merge so admin-enriched fields are preserved.
 *
 * Invoke once from the Firebase Console or CLI:
 *   firebase functions:call seedMumbaiVenueCatalogue
 * Safe to re-run — all upserts are idempotent via { merge: true }.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const PLACES_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.location',
  'places.types',
  'places.rating',
  'places.userRatingCount',
  'places.regularOpeningHours',
  'places.priceLevel',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.shortFormattedAddress',
  'places.photos',
  'places.goodForGroups',
  'places.liveMusic',
  'places.servesCocktails',
  'places.outdoorSeating',
].join(',');

// ── Mumbai nightlife zones ─────────────────────────────────────────────────────

interface MumbaiZone {
  name: string;
  lat: number;
  lng: number;
  radiusMetres: number;
  priorityBoost: number; // zones with more nightlife get a higher default priority
}

const MUMBAI_ZONES: MumbaiZone[] = [
  { name: 'Bandra West',   lat: 19.0596, lng: 72.8295, radiusMetres: 1200, priorityBoost: 10 },
  { name: 'Lower Parel',   lat: 18.9944, lng: 72.8268, radiusMetres: 1200, priorityBoost: 10 },
  { name: 'Andheri West',  lat: 19.1197, lng: 72.8468, radiusMetres: 1500, priorityBoost:  8 },
  { name: 'BKC',           lat: 19.0640, lng: 72.8676, radiusMetres: 1000, priorityBoost:  8 },
  { name: 'Khar West',     lat: 19.0728, lng: 72.8353, radiusMetres:  800, priorityBoost:  6 },
  { name: 'Juhu',          lat: 19.0989, lng: 72.8267, radiusMetres: 1000, priorityBoost:  6 },
  { name: 'Colaba',        lat: 18.9219, lng: 72.8323, radiusMetres: 1000, priorityBoost:  7 },
  { name: 'Worli',         lat: 19.0176, lng: 72.8182, radiusMetres: 1000, priorityBoost:  7 },
  { name: 'Powai',         lat: 19.1197, lng: 72.9049, radiusMetres: 1200, priorityBoost:  5 },
  { name: 'Fort',          lat: 18.9340, lng: 72.8366, radiusMetres:  800, priorityBoost:  5 },
  { name: 'Andheri East',  lat: 19.1128, lng: 72.8712, radiusMetres: 1200, priorityBoost:  4 },
  { name: 'Versova',       lat: 19.1307, lng: 72.8166, radiusMetres: 1000, priorityBoost:  4 },
];

// ── Places API shape ──────────────────────────────────────────────────────────

interface PlacesApiPlace {
  id: string;
  displayName?: { text: string };
  location: { latitude: number; longitude: number };
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { openNow: boolean; weekdayDescriptions?: string[] };
  priceLevel?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  shortFormattedAddress?: string;
  photos?: Array<{ name: string }>;
  goodForGroups?: boolean;
  liveMusic?: boolean;
  servesCocktails?: boolean;
  outdoorSeating?: boolean;
}

// ── Derivation helpers ────────────────────────────────────────────────────────

function normalizePriceLevel(raw: string | undefined): string | null {
  const map: Record<string, string> = {
    PRICE_LEVEL_FREE: 'Free',
    PRICE_LEVEL_INEXPENSIVE: '₹',
    PRICE_LEVEL_MODERATE: '₹₹',
    PRICE_LEVEL_EXPENSIVE: '₹₹₹',
    PRICE_LEVEL_VERY_EXPENSIVE: '₹₹₹₹',
  };
  return raw ? (map[raw] ?? null) : null;
}

function deriveNightlifeCategory(
  types: string[],
): 'club' | 'bar' | 'lounge' | 'rooftop' | 'cafe' {
  if (types.includes('night_club'))                       return 'club';
  if (types.includes('rooftop_bar'))                     return 'rooftop';
  if (types.includes('lounge'))                          return 'lounge';
  if (types.includes('wine_bar') || types.includes('cocktail_bar')) return 'bar';
  if (types.includes('cafe'))                            return 'cafe';
  return 'bar';
}

function deriveVibeTags(
  types: string[],
  attrs: { liveMusic: boolean; servesCocktails: boolean; goodForGroups: boolean; outdoorSeating: boolean },
  priceLevel: string | null,
): string[] {
  const tags = new Set<string>();

  if (types.some((t) => ['night_club', 'dance_club'].includes(t))) {
    tags.add('high-energy');
    tags.add('big-group');
  }
  if (types.some((t) => ['bar', 'cocktail_bar', 'wine_bar'].includes(t))) {
    tags.add('chill');
  }
  if (types.some((t) => ['lounge', 'wine_bar', 'cocktail_bar', 'rooftop_bar'].includes(t))) {
    tags.add('date-night');
  }

  if (attrs.liveMusic)       tags.add('high-energy');
  if (attrs.servesCocktails) tags.add('date-night');
  if (attrs.goodForGroups)   tags.add('big-group');
  if (attrs.outdoorSeating)  tags.add('chill');

  if (priceLevel === '₹' || priceLevel === '₹₹') tags.add('budget');

  return [...tags];
}

function deriveDiscoveryPriority(
  types: string[],
  rating: number | null,
  userRatingCount: number | null,
  zonePriorityBoost: number,
): number {
  let score = 50 + zonePriorityBoost;
  if (rating != null)         score += Math.round((rating - 3.5) * 10); // -15 to +15
  if (userRatingCount != null && userRatingCount > 500)  score += 10;
  else if (userRatingCount != null && userRatingCount > 100) score += 5;
  if (types.includes('night_club')) score += 5;
  return Math.max(0, Math.min(100, score));
}

// ── Sleep helper ──────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

// ── Callable ──────────────────────────────────────────────────────────────────

export const seedMumbaiVenueCatalogue = onCall(
  {
    region:         'asia-south1',
    secrets:        ['PLACES_API_KEY'],
    timeoutSeconds: 300,
    maxInstances:   1,
    memory:         '256MiB',
  },
  async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

    const { zones: zonesToSeed, dryRun = false } =
      (req.data ?? {}) as { zones?: string[]; dryRun?: boolean };

    const apiKey = process.env.PLACES_API_KEY;
    if (!apiKey) throw new HttpsError('internal', 'PLACES_API_KEY secret not configured.');

    const db = getFirestore();

    // Super-admin only — this callable runs hundreds of paid Places API
    // requests and rewrites every venue doc. Not for ordinary users.
    const superSnap = await db.collection('superAdmins').doc(req.auth.uid).get();
    if (!superSnap.exists) {
      throw new HttpsError('permission-denied', 'seedMumbaiVenueCatalogue requires super-admin privilege.');
    }

    // Deduplicate across zones
    const seen = new Map<string, PlacesApiPlace & { zone: string; priorityBoost: number }>();

    const activeZones = zonesToSeed
      ? MUMBAI_ZONES.filter((z) => zonesToSeed.includes(z.name))
      : MUMBAI_ZONES;

    for (const zone of activeZones) {
      const body = {
        includedTypes: ['bar', 'night_club'],
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: zone.lat, longitude: zone.lng },
            radius: zone.radiusMetres,
          },
        },
      };

      try {
        const res = await fetch(PLACES_NEARBY_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': FIELD_MASK,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          console.warn(`Places API failed for zone ${zone.name}:`, await res.text());
        } else {
          const data = await res.json() as { places?: PlacesApiPlace[] };
          for (const place of data.places ?? []) {
            if (!seen.has(place.id)) {
              seen.set(place.id, { ...place, zone: zone.name, priorityBoost: zone.priorityBoost });
            }
            // If already seen, keep the first zone assignment (usually the more central zone)
          }
        }
      } catch (err) {
        console.warn(`Fetch error for zone ${zone.name}:`, err);
      }

      // Respect Places API rate limits — max 10 QPS
      await sleep(300);
    }

    if (dryRun) {
      return { dryRun: true, found: seen.size, zones: activeZones.map((z) => z.name) };
    }

    // ── Upsert all deduped venues ──────────────────────────────────────────
    const batch    = db.batch();
    let batchCount = 0;
    let written    = 0;

    const now = Timestamp.now();

    for (const [placeId, place] of seen.entries()) {
      const types   = place.types ?? [];
      const attrs   = {
        liveMusic:       place.liveMusic       ?? false,
        servesCocktails: place.servesCocktails ?? false,
        goodForGroups:   place.goodForGroups   ?? false,
        outdoorSeating:  place.outdoorSeating  ?? false,
      };
      const priceLevel = normalizePriceLevel(place.priceLevel);

      const doc = {
        placeId,
        name:             place.displayName?.text ?? '',
        address:          place.shortFormattedAddress ?? '',
        location:         { lat: place.location.latitude, lng: place.location.longitude },
        rating:           place.rating           ?? null,
        userRatingCount:  place.userRatingCount  ?? null,
        priceLevel,
        types,
        isOpen:           place.regularOpeningHours?.openNow ?? null,
        currentOpeningHours: place.regularOpeningHours?.weekdayDescriptions ?? null,
        phone:            place.nationalPhoneNumber ?? null,
        website:          place.websiteUri       ?? null,
        attributes:       attrs,
        photos:           (place.photos ?? []).slice(0, 5).map((p) => p.name),
        source:           'google_places' as const,
        lastFetchedAt:    now,
        // Discovery metadata
        city:                 'Mumbai',
        zone:                 place.zone,
        nightlifeCategory:    deriveNightlifeCategory(types),
        vibeTags:             deriveVibeTags(types, attrs, priceLevel),
        adminVibeTags:        [],
        discoveryEnabled:     true,
        discoveryPriority:    deriveDiscoveryPriority(types, place.rating ?? null, place.userRatingCount ?? null, place.priorityBoost),
      };

      const ref = db.collection('venues').doc(placeId);
      // merge: true preserves admin-set fields (adminVibeTags, bannerUrl, etc.)
      // but we use set with merge so discoveryEnabled/vibeTags get written on first seed
      batch.set(ref, doc, { merge: true });
      batchCount++;
      written++;

      // Firestore batch limit is 500
      if (batchCount === 499) {
        await batch.commit();
        batchCount = 0;
      }
    }

    if (batchCount > 0) await batch.commit();

    return {
      written,
      zones:   activeZones.map((z) => z.name),
      message: `Seeded ${written} Mumbai nightlife venues across ${activeZones.length} zones.`,
    };
  },
);
