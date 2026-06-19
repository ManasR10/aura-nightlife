/**
 * venues.ts — mobile-side venue service.
 *
 * Calls Cloud Functions (never Places API directly — key stays server-side).
 * Falls back to Firestore cache if function call fails.
 */
import { fnDefault } from '../firebase/fns';
import firestore from '@react-native-firebase/firestore';

export interface VenueResult {
  placeId: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  rating: number | null;
  userRatingCount: number | null;
  priceLevel: string | null;
  types: string[];
  isOpen: boolean | null;
  currentOpeningHours: string[] | null;
  phone: string | null;
  website: string | null;
  attributes: {
    liveMusic: boolean;
    servesCocktails: boolean;
    goodForGroups: boolean;
    outdoorSeating: boolean;
  };
  photos: string[];
  source: 'google_places';
  // Discovery metadata — written by seedMumbaiVenueCatalogue
  city?: string;
  zone?: string;
  nightlifeCategory?: 'club' | 'bar' | 'lounge' | 'rooftop' | 'cafe';
  vibeTags?: string[];
  adminVibeTags?: string[];
  discoveryEnabled?: boolean;
  discoveryPriority?: number;
}

export interface NearbyVenuesParams {
  latitude: number;
  longitude: number;
  radiusMetres?: number;
  maxResults?: number;
}

/**
 * Fetch nearby nightlife venues via Cloud Function (cached in Firestore).
 */
export async function getNearbyVenues(
  params: NearbyVenuesParams,
): Promise<VenueResult[]> {
  try {
    const fn = fnDefault.httpsCallable('searchNearbyVenues');
    const result = await fn({
      ...params,
      includedTypes: ['bar', 'night_club'],
    });
    return (result.data as { venues: VenueResult[] }).venues ?? [];
  } catch (err) {
    console.warn('getNearbyVenues function failed, reading Firestore cache:', err);
    return getVenuesFromCache();
  }
}

/**
 * Text search via Cloud Function.
 */
export async function searchVenues(
  query: string,
  location?: { latitude: number; longitude: number },
): Promise<VenueResult[]> {
  try {
    const fn = fnDefault.httpsCallable('searchVenuesByText');
    const result = await fn({ query, ...location });
    return (result.data as { venues: VenueResult[] }).venues ?? [];
  } catch (err) {
    console.warn('searchVenues failed:', err);
    return [];
  }
}

/**
 * Get a single venue from Firestore by placeId.
 */
export async function getVenueById(placeId: string): Promise<VenueResult | null> {
  try {
    const snap = await firestore().collection('venues').doc(placeId).get();
    if (!snap.exists) return null;
    return snap.data() as VenueResult;
  } catch (err) {
    console.warn('getVenueById failed:', err);
    return null;
  }
}

/**
 * Trending venues — sorted by live score descending.
 * Used when location is unavailable: shows what's hot right now city-wide.
 */
export async function getTrendingVenues(limit = 20): Promise<VenueResult[]> {
  try {
    // Fetch top live scores from venueLive
    const liveSnap = await firestore()
      .collection('venueLive')
      .orderBy('liveScore', 'desc')
      .limit(limit)
      .get();

    if (liveSnap.empty) {
      // No live data yet — fall back to all cached venues
      return getVenuesFromCache(limit);
    }

    const venueIds = liveSnap.docs.map((d) => d.id);

    // Fetch the actual venue docs in parallel
    const venueSnaps = await Promise.all(
      venueIds.map((id) => firestore().collection('venues').doc(id).get()),
    );

    const venues: VenueResult[] = [];
    for (const snap of venueSnaps) {
      if (snap.exists()) venues.push(snap.data() as VenueResult);
    }

    // If we got fewer than 8 from live data, pad with cached venues
    if (venues.length < 8) {
      const cached = await getVenuesFromCache(limit);
      const existing = new Set(venues.map((v) => v.placeId));
      for (const v of cached) {
        if (!existing.has(v.placeId)) venues.push(v);
        if (venues.length >= limit) break;
      }
    }

    return venues;
  } catch (err) {
    console.warn('getTrendingVenues failed, using cache:', err);
    return getVenuesFromCache(limit);
  }
}

/**
 * Fallback: read all venues from Firestore cache directly.
 */
async function getVenuesFromCache(limit = 30): Promise<VenueResult[]> {
  try {
    const snap = await firestore()
      .collection('venues')
      .limit(limit)
      .get();
    return snap.docs.map((d) => d.data() as VenueResult);
  } catch {
    return [];
  }
}
