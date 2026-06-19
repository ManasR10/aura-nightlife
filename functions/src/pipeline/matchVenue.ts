/**
 * matchVenue — links a scraped event to a Firestore venue (/venues/{placeId}).
 *
 * Matching order:
 *   1. Exact normalized name match against cached venues
 *   2. Fuzzy name + locality match
 *   3. Geocode address → nearest cached venue within 300 m
 *   4. Places text search using scraped name + locality
 *
 * Returns { venueId, confidenceScore } or { venueId: null, confidenceScore: 0 }.
 */
import { getFirestore } from 'firebase-admin/firestore';
import { upsertVenueFromPlace } from '../places/upsertVenue';
import type { VenueDoc } from '../types';
import type { NormalizedEvent } from './normalizeEvent';

const PLACES_TEXT_SEARCH = 'https://places.googleapis.com/v1/places:searchText';
const GEOCODE_API = 'https://maps.googleapis.com/maps/api/geocode/json';
const CONFIDENCE_THRESHOLD = 0.80;

// ── Name normalization ────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'bar', 'club', 'lounge', 'cafe', 'pub', 'restaurant',
  'mumbai', 'at', 'by', 'and', '&', 'hotel', 'resort', '-', ',',
]);

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .join(' ')
    .trim();
}

// ── String similarity (simple token overlap) ──────────────────────────────────

function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeName(a).split(' ').filter(Boolean));
  const tb = new Set(normalizeName(b).split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  for (const t of ta) {
    if (tb.has(t)) overlap++;
  }
  return (2 * overlap) / (ta.size + tb.size);
}

// ── Haversine distance in metres ──────────────────────────────────────────────

function distanceMetres(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Main matcher ──────────────────────────────────────────────────────────────

export interface MatchResult {
  venueId: string | null;
  confidenceScore: number;
}

export async function matchVenue(
  event: NormalizedEvent,
  apiKey: string,
): Promise<MatchResult> {
  const db = getFirestore();

  // Load all cached venues (reasonable for MVP — typically < 500 venues)
  const venuesSnap = await db.collection('venues').get();
  const venues = venuesSnap.docs.map((d) => d.data() as VenueDoc);

  // ── Step 1: Exact normalized name ─────────────────────────────────────────
  const normQuery = normalizeName(event.rawVenueName);
  for (const venue of venues) {
    if (normalizeName(venue.name) === normQuery && normQuery.length > 3) {
      return { venueId: venue.placeId, confidenceScore: 0.95 };
    }
  }

  // ── Step 2: Fuzzy name + locality ─────────────────────────────────────────
  let bestFuzzy: { venue: VenueDoc; score: number } | null = null;
  for (const venue of venues) {
    const nameSim = tokenSimilarity(event.rawVenueName, venue.name);
    // Boost if locality matches
    const localityBoost =
      event.locality && venue.address.toLowerCase().includes(event.locality.toLowerCase())
        ? 0.10
        : 0;
    const score = nameSim + localityBoost;
    if (score > (bestFuzzy?.score ?? 0)) {
      bestFuzzy = { venue, score };
    }
  }

  if (bestFuzzy && bestFuzzy.score >= CONFIDENCE_THRESHOLD) {
    return { venueId: bestFuzzy.venue.placeId, confidenceScore: bestFuzzy.score };
  }

  // ── Step 3: Geocode address → nearest cached venue ────────────────────────
  if (event.rawAddress) {
    try {
      const geoRes = await fetch(
        `${GEOCODE_API}?address=${encodeURIComponent(`${event.rawAddress}, Mumbai`)}&key=${apiKey}`,
      );
      if (geoRes.ok) {
        const geo = await geoRes.json() as {
          results?: Array<{
            geometry: { location: { lat: number; lng: number } };
          }>;
        };
        const loc = geo.results?.[0]?.geometry?.location;
        if (loc) {
          let closestVenue: VenueDoc | null = null;
          let closestDist = Infinity;

          for (const venue of venues) {
            const dist = distanceMetres(loc.lat, loc.lng, venue.location.lat, venue.location.lng);
            if (dist < closestDist) {
              closestDist = dist;
              closestVenue = venue;
            }
          }

          if (closestVenue && closestDist <= 300) {
            const nameSim = tokenSimilarity(event.rawVenueName, closestVenue.name);
            const geoScore = 0.60 + (1 - closestDist / 300) * 0.20 + nameSim * 0.10;
            if (geoScore >= CONFIDENCE_THRESHOLD) {
              return { venueId: closestVenue.placeId, confidenceScore: geoScore };
            }
          }
        }
      }
    } catch (err) {
      console.warn('Geocode failed:', err);
    }
  }

  // ── Step 4: Places text search ────────────────────────────────────────────
  try {
    const searchQuery = event.locality
      ? `${event.rawVenueName} ${event.locality} Mumbai`
      : `${event.rawVenueName} Mumbai nightlife`;

    const res = await fetch(PLACES_TEXT_SEARCH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.shortFormattedAddress,places.types,places.regularOpeningHours',
      },
      body: JSON.stringify({
        textQuery: searchQuery,
        pageSize: 3,
      }),
    });

    if (res.ok) {
      const data = await res.json() as { places?: Array<{
        id: string;
        displayName?: { text: string };
        location: { latitude: number; longitude: number };
        shortFormattedAddress?: string;
        types?: string[];
        regularOpeningHours?: { openNow: boolean; weekdayDescriptions?: string[] };
        photos?: Array<{ name: string }>;
      }> };

      const candidates = data.places ?? [];
      for (const candidate of candidates) {
        const nameSim = tokenSimilarity(event.rawVenueName, candidate.displayName?.text ?? '');
        if (nameSim >= 0.60) {
          // Upsert this venue into Firestore
          await upsertVenueFromPlace({
            id: candidate.id,
            displayName: candidate.displayName,
            location: candidate.location,
            shortFormattedAddress: candidate.shortFormattedAddress,
            types: candidate.types,
            regularOpeningHours: candidate.regularOpeningHours,
          });
          const confidence = 0.70 + nameSim * 0.20;
          if (confidence >= CONFIDENCE_THRESHOLD) {
            return { venueId: candidate.id, confidenceScore: confidence };
          }
        }
      }
    }
  } catch (err) {
    console.warn('Places text search for matching failed:', err);
  }

  // Unmatched — flag for manual review
  return { venueId: null, confidenceScore: bestFuzzy?.score ?? 0 };
}
