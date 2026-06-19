/**
 * Environment configuration template.
 *
 * Setup (one-time per developer machine):
 *   cp src/env.example.ts src/env.ts
 *   # then fill in the real values below in src/env.ts
 *
 * src/env.ts is gitignored — your real keys will never be committed.
 *
 *  Where to find each value
 *
 * PLACES_PHOTO_API_KEY
 *   Google Cloud Console → APIs & Services → Credentials
 *   Use the same key as your Cloud Functions, restricted to:
 *     Android: com.nightlife.auraapp
 *     iOS:     com.nightlife.auraapp
 *   Enable: "Places API (New)"
 *
 * GOOGLE_WEB_CLIENT_ID
 *   Firebase Console → Authentication → Sign-in method → Google
 *   → Web SDK configuration → Web client ID
 *   Looks like: 245062000701-xxxx.apps.googleusercontent.com
 *
 * SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
 *   Dev-only. Credentials for the "Seed test admin" button shown in __DEV__
 *   builds (calls the seedPseudoAdmin Cloud Function). Leave empty unless you
 *   are provisioning a local venue admin — never commit real values.
 */

export const PLACES_PHOTO_API_KEY = '';
export const GOOGLE_WEB_CLIENT_ID = '';

// Dev-only — set locally, never commit real values
export const SEED_ADMIN_EMAIL    = '';
export const SEED_ADMIN_PASSWORD = '';
