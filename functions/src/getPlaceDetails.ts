/**
 * getPlaceDetails — callable Cloud Function.
 *
 * Wraps Places API (New) Place Details so the API key stays server-side.
 *
 * Called from the mobile app with: { placeId }
 *
 * Returns enriched venue detail for VenueDetailScreen.
 *
 * Environment variable required:
 *   PLACES_API_KEY — set via: firebase functions:secrets:set PLACES_API_KEY
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { VenueDoc } from './types';

// Advanced + Preferred tier fields for the detail view
const FIELD_MASK = [
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
  'reviews',
  'editorialSummary',
  'paymentOptions',
  'accessibilityOptions',
].join(',');

export interface PlaceDetails extends VenueDoc {
  editorialSummary: string | null;
  openingHoursText: string[] | null; // human-readable hours for each day
  reviews: PlaceReview[];
  photoReferences: string[]; // up to 5 photo resource names
}

export interface PlaceReview {
  authorName: string;
  rating: number;
  text: string;
  publishTime: string;
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

export const getPlaceDetails = onCall(
  { secrets: ['PLACES_API_KEY'] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in.');
    }

    const { placeId } = request.data as { placeId: string };
    if (!placeId) {
      throw new HttpsError('invalid-argument', 'placeId is required.');
    }

    const apiKey = process.env.PLACES_API_KEY;
    if (!apiKey) {
      throw new HttpsError('internal', 'Places API key not configured.');
    }

    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;

    const response = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Places API details error:', err);
      if (response.status === 404) {
        throw new HttpsError('not-found', 'Place not found.');
      }
      throw new HttpsError('internal', 'Places API request failed.');
    }

    const p = await response.json() as PlacesApiPlaceDetail;

    const { Timestamp } = await import('firebase-admin/firestore');
    const now = Timestamp.now();
    const details: PlaceDetails = {
      placeId:            p.id,
      name:               p.displayName?.text ?? '',
      address:            p.shortFormattedAddress ?? '',
      location:           { lat: p.location.latitude, lng: p.location.longitude },
      types:              p.types ?? [],
      rating:             p.rating ?? null,
      userRatingCount:    p.userRatingCount ?? null,
      isOpen:             p.regularOpeningHours?.openNow ?? null,
      priceLevel:         normalizePriceLevel(p.priceLevel),
      phone:              p.nationalPhoneNumber ?? null,
      website:            p.websiteUri ?? null,
      photos:             (p.photos ?? []).slice(0, 5).map((ph) => ph.name),
      attributes:         { liveMusic: false, servesCocktails: false, goodForGroups: false, outdoorSeating: false },
      currentOpeningHours:p.regularOpeningHours?.weekdayDescriptions ?? null,
      source:             'google_places',
      lastFetchedAt:      now,
      lastEnrichedAt:     now,
      photoReferences:    (p.photos ?? []).slice(0, 5).map((ph) => ph.name),
      editorialSummary:   p.editorialSummary?.text ?? null,
      openingHoursText:   p.regularOpeningHours?.weekdayDescriptions ?? null,
      reviews: (p.reviews ?? []).slice(0, 5).map((r) => ({
        authorName:  r.authorAttribution?.displayName ?? 'Anonymous',
        rating:      r.rating,
        text:        r.text?.text ?? '',
        publishTime: r.publishTime ?? '',
      })),
    };

    // ── Persist Google-owned fields back to /venues (fire-and-forget) ─────────
    // Uses { merge: true } so admin-managed fields (adminVibeTags, openingNote,
    // promotions, bannerUrl, discoveryEnabled, discoveryPriority) are never touched.
    const { getFirestore } = await import('firebase-admin/firestore');
    getFirestore()
      .collection('venues')
      .doc(p.id)
      .set(
        {
          // Google-owned layer only
          name:               details.name,
          address:            details.address,
          location:           details.location,
          rating:             details.rating,
          userRatingCount:    details.userRatingCount,
          priceLevel:         details.priceLevel,
          types:              details.types,
          isOpen:             details.isOpen,
          currentOpeningHours:details.currentOpeningHours,
          phone:              details.phone,
          website:            details.website,
          photos:             details.photos,
          source:             'google_places',
          lastFetchedAt:      now,
          lastEnrichedAt:     now,
        },
        { merge: true },
      )
      .catch((err) => console.warn('getPlaceDetails /venues upsert failed:', err));

    return details;
  },
);

// ── Internal shape from Places API (New) ─────────────────────────────────────

interface PlacesApiPlaceDetail {
  id: string;
  displayName?: { text: string; languageCode: string };
  location: { latitude: number; longitude: number };
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: {
    openNow: boolean;
    weekdayDescriptions: string[];
  };
  priceLevel?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  shortFormattedAddress?: string;
  editorialSummary?: { text: string };
  photos?: Array<{ name: string }>;
  reviews?: Array<{
    authorAttribution?: { displayName: string };
    rating: number;
    text?: { text: string };
    publishTime?: string;
  }>;
}
