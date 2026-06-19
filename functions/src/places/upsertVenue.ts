// Writes/refreshes a venue at /venues/{placeId}. Internal only (searchNearbyVenues,
// searchVenuesByText, refreshVenueDetails) so the Places key never leaves the server.
// Always merge:true — otherwise a Google/seed refresh clobbers admin-owned fields
// like promotions, coverCharge, dressCode, adminVibeTags.
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { VenueDoc } from '../types';

const FIELD_MASK_DETAIL = [
  'id',
  'displayName',
  'location',
  'types',
  'rating',
  'userRatingCount',
  'regularOpeningHours',
  'priceLevel',
  'nationalPhoneNumber',
  'websiteUri',
  'shortFormattedAddress',
  'photos',
  'goodForGroups',
  'liveMusic',
  'servesCocktails',
  'outdoorSeating',
].join(',');

// Internal Places API shape

interface PlacesApiVenue {
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

// Price normalizer

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

// Main export

/**
 * Upserts a venue from a raw Places API place object.
 * Preserves lastEnrichedAt if the doc already existed.
 */
export async function upsertVenueFromPlace(place: PlacesApiVenue): Promise<void> {
  const db = getFirestore();
  const ref = db.collection('venues').doc(place.id);
  const existing = await ref.get();

  const doc: VenueDoc = {
    placeId: place.id,
    name: place.displayName?.text ?? '',
    address: place.shortFormattedAddress ?? '',
    location: {
      lat: place.location.latitude,
      lng: place.location.longitude,
    },
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    priceLevel: normalizePriceLevel(place.priceLevel),
    types: place.types ?? [],
    isOpen: place.regularOpeningHours?.openNow ?? null,
    currentOpeningHours: place.regularOpeningHours?.weekdayDescriptions ?? null,
    phone: place.nationalPhoneNumber ?? null,
    website: place.websiteUri ?? null,
    attributes: {
      liveMusic: place.liveMusic ?? false,
      servesCocktails: place.servesCocktails ?? false,
      goodForGroups: place.goodForGroups ?? false,
      outdoorSeating: place.outdoorSeating ?? false,
    },
    photos: (place.photos ?? []).slice(0, 5).map((p) => p.name),
    source: 'google_places',
    lastFetchedAt: Timestamp.now(),
    lastEnrichedAt: existing.exists ? (existing.data() as VenueDoc).lastEnrichedAt : null,
  };

  await ref.set(doc, { merge: true });
}

/**
 * Fetches full venue details from Places API and upserts to Firestore.
 * Used by the refreshVenueDetails scheduled job.
 */
export async function fetchAndUpsertVenueDetail(
  placeId: string,
  apiKey: string,
): Promise<void> {
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
  const response = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK_DETAIL,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Places detail fetch failed for ${placeId}: ${text}`);
  }

  const place = await response.json() as PlacesApiVenue;
  await upsertVenueFromPlace(place);

  // Mark enriched
  const db = getFirestore();
  await db.collection('venues').doc(placeId).update({
    lastEnrichedAt: Timestamp.now(),
  });
}
