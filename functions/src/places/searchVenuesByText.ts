/**
 * searchVenuesByText — callable Cloud Function.
 *
 * Contract:
 *   1. Search Firestore /venues catalogue first (name / address / zone substring).
 *   2. If ≥ 5 catalogue hits — return them, skip Places API entirely.
 *   3. Otherwise fall back to Places API text search (no type restriction).
 *   4. Upsert any new Places results into /venues so the catalogue grows.
 *   5. Return catalogue hits first, then new Places results.
 *
 * This makes /venues the master catalogue. Places enriches it, not replaces it.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { upsertVenueFromPlace } from './upsertVenue';
import type { VenueDoc } from '../types';

const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

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

export const searchVenuesByText = onCall(
  { secrets: ['PLACES_API_KEY'] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

    const {
      query,
      latitude,
      longitude,
      radiusMetres = 10_000,
      maxResults   = 20,
    } = request.data as {
      query: string;
      latitude?: number;
      longitude?: number;
      radiusMetres?: number;
      maxResults?: number;
    };

    if (!query?.trim()) throw new HttpsError('invalid-argument', 'query is required.');

    const db = getFirestore();
    const q  = query.trim().toLowerCase();

    // ── 1. Firestore catalogue search ─────────────────────────────────────────
    // Scan up to 200 docs server-side and filter by substring match.
    // Fast enough for <300 venue catalogues; revisit with Algolia if >5 k venues.
    const catalogueSnap = await db.collection('venues').limit(200).get();
    const catalogueHits = catalogueSnap.docs
      .map((d) => d.data() as VenueDoc & { zone?: string; nightlifeCategory?: string })
      .filter((v) =>
        v.name.toLowerCase().includes(q) ||
        (v.address ?? '').toLowerCase().includes(q) ||
        (v.zone ?? '').toLowerCase().includes(q) ||
        (v.nightlifeCategory ?? '').includes(q),
      );

    if (catalogueHits.length >= 5) {
      return { venues: catalogueHits.slice(0, maxResults), source: 'catalogue' };
    }

    // ── 2. Places API fallback ────────────────────────────────────────────────
    const apiKey = process.env.PLACES_API_KEY;
    if (!apiKey) {
      return { venues: catalogueHits, source: 'catalogue_partial' };
    }

    // No `includedType` — let the query + location bias determine relevance.
    // Appending "bar OR club nightlife" gives context without restricting types.
    const body: Record<string, unknown> = {
      textQuery: `${query.trim()} nightlife Mumbai`,
      pageSize:  Math.min(maxResults, 20),
    };

    if (latitude != null && longitude != null) {
      body['locationBias'] = {
        circle: { center: { latitude, longitude }, radius: radiusMetres },
      };
    }

    const response = await fetch(TEXT_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'X-Goog-Api-Key':  apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('Places Text Search error:', await response.text());
      return { venues: catalogueHits, source: 'catalogue_fallback' };
    }

    const data   = await response.json() as { places?: PlacesApiPlace[] };
    const places = data.places ?? [];

    // ── 3. Upsert new results into /venues (grows catalogue organically) ──────
    const catalogueIds = new Set(catalogueHits.map((v) => v.placeId));
    const newPlaces    = places.filter((p) => !catalogueIds.has(p.id));
    await Promise.all(newPlaces.map((p) => upsertVenueFromPlace(p)));

    // ── 4. Merge: catalogue hits first, new Places results appended ───────────
    const placesVenues = newPlaces.map((p) => ({
      placeId:            p.id,
      name:               p.displayName?.text ?? '',
      address:            p.shortFormattedAddress ?? '',
      location:           { lat: p.location.latitude, lng: p.location.longitude },
      rating:             p.rating ?? null,
      userRatingCount:    p.userRatingCount ?? null,
      priceLevel:         normalizePriceLevel(p.priceLevel),
      types:              p.types ?? [],
      isOpen:             p.regularOpeningHours?.openNow ?? null,
      currentOpeningHours:p.regularOpeningHours?.weekdayDescriptions ?? null,
      phone:              p.nationalPhoneNumber ?? null,
      website:            p.websiteUri ?? null,
      photos:             (p.photos ?? []).slice(0, 5).map((ph) => ph.name),
      attributes: {
        liveMusic:       p.liveMusic       ?? false,
        servesCocktails: p.servesCocktails ?? false,
        goodForGroups:   p.goodForGroups   ?? false,
        outdoorSeating:  p.outdoorSeating  ?? false,
      },
      source: 'google_places' as const,
    }));

    return {
      venues: [...catalogueHits, ...placesVenues].slice(0, maxResults),
      source: 'mixed',
    };
  },
);
