/**
 * searchNearbyVenues — callable Cloud Function.
 *
 * 1. Checks Firestore /venues for cached venues near the coordinates (< 1 h old).
 * 2. If cache is warm, returns from Firestore — no Places API call.
 * 3. If cold or stale, calls Places API (New) Nearby Search, upserts results
 *    to Firestore, then returns them.
 *
 * Called from the mobile app with:
 *   { latitude, longitude, radiusMetres?, includedTypes?, maxResults? }
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { upsertVenueFromPlace } from './places/upsertVenue';
import type { VenueDoc } from './types';

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
].join(',');

// How long a cached venue is considered fresh
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

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
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const searchNearbyVenues = onCall(
  { secrets: ['PLACES_API_KEY'] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in.');
    }

    const {
      latitude,
      longitude,
      radiusMetres = 2000,
      includedTypes = ['bar', 'night_club'],
      maxResults = 20,
    } = request.data as {
      latitude: number;
      longitude: number;
      radiusMetres?: number;
      includedTypes?: string[];
      maxResults?: number;
    };

    if (latitude == null || longitude == null) {
      throw new HttpsError('invalid-argument', 'latitude and longitude are required.');
    }
    if (radiusMetres < 100 || radiusMetres > 50_000) {
      throw new HttpsError('invalid-argument', 'radiusMetres must be between 100 and 50000.');
    }

    const radiusKm = radiusMetres / 1000;
    const db = getFirestore();
    const oneHourAgo = Timestamp.fromMillis(Date.now() - CACHE_TTL_MS);

    // 1. Try Firestore cache
    const cacheSnap = await db
      .collection('venues')
      .where('lastFetchedAt', '>', oneHourAgo)
      .limit(50)
      .get();

    const cached = cacheSnap.docs
      .map((d) => d.data() as VenueDoc)
      .filter((v) => haversineKm(latitude, longitude, v.location.lat, v.location.lng) <= radiusKm)
      .slice(0, maxResults);

    if (cached.length >= Math.min(maxResults, 5)) {
      return { venues: cached, source: 'cache' };
    }

    // 2. Cache cold — call Places API
    const apiKey = process.env.PLACES_API_KEY;
    if (!apiKey) throw new HttpsError('internal', 'Places API key not configured.');

    const body = {
      includedTypes,
      maxResultCount: Math.min(maxResults, 20),
      locationRestriction: {
        circle: {
          center: { latitude, longitude },
          radius: radiusMetres,
        },
      },
    };

    const response = await fetch(PLACES_NEARBY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Places API error:', err);
      // Fall back to stale cache rather than crashing
      if (cached.length > 0) return { venues: cached, source: 'stale_cache' };
      throw new HttpsError('internal', 'Places API request failed.');
    }

    const data = await response.json() as { places?: PlacesApiPlace[] };
    const places = data.places ?? [];

    // 3. Upsert to Firestore in parallel
    await Promise.all(places.map((p) => upsertVenueFromPlace(p)));

    // 4. Return fresh docs from Firestore
    const freshSnap = await db
      .collection('venues')
      .where('lastFetchedAt', '>', Timestamp.fromMillis(Date.now() - 10_000))
      .limit(maxResults)
      .get();

    const fresh = freshSnap.docs.map((d) => d.data() as VenueDoc);
    return { venues: fresh.length > 0 ? fresh : places.map((p) => ({
      placeId: p.id,
      name: p.displayName?.text ?? '',
      address: p.shortFormattedAddress ?? '',
      location: { lat: p.location.latitude, lng: p.location.longitude },
      rating: p.rating ?? null,
      userRatingCount: p.userRatingCount ?? null,
      isOpen: p.regularOpeningHours?.openNow ?? null,
    })), source: 'places_api' };
  },
);

// Keep VenueResult export for backward compat
export type { VenueDoc as VenueResult };
