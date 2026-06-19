/**
 * App-level configuration.
 *
 * Keys are read from src/env.ts (gitignored).
 * Copy src/env.example.ts → src/env.ts and fill in real values.
 * Leave src/env.ts empty to keep optional features (photos, Google Sign-In)
 * gracefully disabled during local development.
 */
import { PLACES_PHOTO_API_KEY } from './env';

export { PLACES_PHOTO_API_KEY };

/**
 * Returns the public URL for a Places API (New) photo resource name.
 * Resource names come from the photos[] array in /venues Firestore docs.
 * Returns '' when no key is configured so callers fall back to FALLBACK_COVER.
 */
export function placesPhotoUrl(resourceName: string, width = 800): string {
  if (!resourceName || !PLACES_PHOTO_API_KEY) return '';
  return `https://places.googleapis.com/v1/${resourceName}/media?maxWidthPx=${width}&key=${PLACES_PHOTO_API_KEY}`;
}
