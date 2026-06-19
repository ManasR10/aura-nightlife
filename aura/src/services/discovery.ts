/**
 * discovery.ts — loads the full Firestore venue catalogue and attaches
 * computed distance so upstream callers can sort and rank however they want.
 *
 * The catalogue is Firestore /venues (seeded by seedMumbaiVenueCatalogue).
 * Distance is computed client-side from the user's GPS — no server round-trip.
 */
import firestore from '@react-native-firebase/firestore';
import type { VenueResult } from './venues';
import { getTrendingVenues } from './venues';

// Types

export interface CatalogueVenue extends VenueResult {
  distanceKm: number;
}

// Haversine distance

export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Main loader

/**
 * Load the full Mumbai venue catalogue from Firestore.
 *
 * Ordering:
 *   - When userLocation is provided: nearby first, then by discoveryPriority
 *   - When no location: by discoveryPriority desc
 *
 * Falls back to getTrendingVenues if Firestore is empty (pre-seeding).
 */
export async function loadCatalogue(
  userLocation: { lat: number; lng: number } | null,
  limit = 80,
): Promise<CatalogueVenue[]> {
  try {
    const snap = await firestore()
      .collection('venues')
      .orderBy('lastFetchedAt', 'desc')
      .limit(limit)
      .get();

    if (snap.empty) {
      // Pre-seed fallback
      const fallback = await getTrendingVenues(40);
      return attachDistance(fallback, userLocation);
    }

    const venues = snap.docs
      .map((d) => d.data() as VenueResult)
      .filter((v) => v.discoveryEnabled !== false);

    const withDist = attachDistance(venues, userLocation);

    withDist.sort((a, b) => {
      if (userLocation) {
        // Same-distance bucket (< 1 km diff): rank by priority
        if (Math.abs(a.distanceKm - b.distanceKm) < 1.0) {
          const pA = a.discoveryPriority ?? 50;
          const pB = b.discoveryPriority ?? 50;
          return pB - pA;
        }
        return a.distanceKm - b.distanceKm;
      }
      // No location: pure priority
      return (b.discoveryPriority ?? 50) - (a.discoveryPriority ?? 50);
    });

    return withDist;
  } catch (err) {
    console.warn('loadCatalogue error:', err);
    const fallback = await getTrendingVenues(40);
    return attachDistance(fallback, userLocation);
  }
}

// Helpers

function attachDistance(
  venues: VenueResult[],
  userLocation: { lat: number; lng: number } | null,
): CatalogueVenue[] {
  return venues.map((v) => ({
    ...v,
    distanceKm: userLocation
      ? haversineKm(userLocation.lat, userLocation.lng, v.location.lat, v.location.lng)
      : 999,
  }));
}

/** Format km for display: "0.3 km" | "1.2 km" | "12 km" */
export function formatDistance(km: number): string {
  if (km >= 999) return '';
  if (km < 1)   return `${Math.round(km * 10) / 10} km`;
  if (km < 10)  return `${Math.round(km * 10) / 10} km`;
  return `${Math.round(km)} km`;
}
