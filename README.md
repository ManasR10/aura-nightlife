# AURA

> Real-time nightlife intelligence for India.
> Know what's happening at venues *right now*, earn instant UPI rewards for posting live updates.

🌐 **Website:** [nightlifeaura.com](https://nightlifeaura.com/)

AURA solves the **pre-nightlife decision problem** — the 8–11 PM window when people are deciding where to go out. Instead of stale, post-event social proof, AURA surfaces what's happening at venues *right now* through user-submitted live signals, and rewards contributors with instant UPI cash.

A full-stack product across two surfaces: a **React Native** app (iOS + Android, consumer + venue-admin) and a **Firebase** backend (38 Cloud Functions, Firestore, Realtime DB, Storage, FCM), targeting Mumbai for beta.

### Highlights

- 📍 **Geofenced check-ins** — server-side haversine validation rejects fake check-ins
- 💸 **Instant UPI rewards** — Razorpay Payout integration with a privacy-by-design payout flow
- 🔴 **Live venue state** — weighted live-score from user signals, auto-expiring updates
- 🗺️ **Venue discovery** — Google Places-backed catalogue with vibe tags + ranked listings
- ⚙️ **Event ingestion pipeline** — multi-source scrape → normalize → dedupe → venue-match → publish
- 🛡️ **Security-first** — role-based access, least-privilege Firestore/Storage/RTDB rules, unit-tested validators

> **Status:** Beta-ready. UPI payouts and live event scraping are code-complete but gated behind feature flags pending production credentials / proxy infrastructure (see [§ What's done vs Phase 2](#whats-done-vs-phase-2)).

---

## Repository layout

```
xs/
├── aura/                        React Native mobile app (iOS + Android)
│   ├── src/                     Screens, components, services, utils, theme
│   ├── android/                 Gradle, AndroidManifest, debug keystore
│   ├── ios/                     Xcode project, Info.plist, PrivacyInfo.xcprivacy
│   └── __tests__/               Jest tests
│
├── functions/                   Firebase Cloud Functions (TypeScript, Node 22)
│   ├── src/                     38 callable + scheduled + Firestore-triggered functions
│   └── __tests__/               Jest tests for security-critical validators
│
├── firestore.rules              Firestore security rules
├── storage.rules                Cloud Storage rules
├── database.rules.json          Realtime Database rules
├── firestore.indexes.json       Firestore composite indexes
├── firebase.json                Firebase project config
├── .firebaserc                  Firebase project alias (replace with your own project ID)
│
├── .github/workflows/ci.yml     CI (tsc + lint + jest, two jobs)
└── README.md                    This file
```

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22.x | Required by Firebase Functions runtime |
| npm | 10.x | Comes with Node 22 |
| Ruby | 3.x | iOS CocoaPods install |
| Bundler | 2.x | `gem install bundler` |
| Xcode | ≥ 15 | iOS builds, macOS only |
| Android Studio | latest stable | Android builds + emulator |
| JDK | 17 | Required by AGP |
| Firebase CLI | latest | `npm i -g firebase-tools` |
| Google Cloud SDK | latest | `brew install --cask google-cloud-sdk` — needed for some GCP ops |
| gh (optional) | latest | `brew install gh` — GitHub repo management |
| `keytool` | bundled with JDK | Generates SHA fingerprints |
| `adb` | bundled with Android Studio | Device debugging |

---

## First-time setup

> **Before you start:** the Firebase + GCP project the codebase references (`aura-app-ee15d`, project number `245062000701`) lives on the original developer's personal Google account and is **not** being transferred. Create your own Firebase project (Blaze plan, region `asia-south1` for Firestore + Functions, `asia-southeast1` for Realtime DB) using the same bundle ID `com.nightlife.auraapp`. Enable Phone + Email + Google sign-in, Firestore, Realtime DB, Cloud Storage, Cloud Messaging. In GCP, enable Places API (New), Maps SDKs (Android + iOS), Geocoding API, and Play Integrity API. Then update `.firebaserc` with your new project ID.

```bash
# 1. Clone and install
git clone <repo-url> aura-nightlife
cd aura-nightlife
npm install                          # top-level monorepo dispatcher
cd aura && npm install
cd ios && bundle install && bundle exec pod install && cd ..
cd ../functions && npm install
cd ..

# 2. Create the local env file (gitignored)
cp aura/src/env.example.ts aura/src/env.ts
#    Edit aura/src/env.ts and paste:
#      PLACES_PHOTO_API_KEY — your GCP Console → APIs & Services → Credentials
#                             (restrict to com.nightlife.auraapp Android + iOS)
#      GOOGLE_WEB_CLIENT_ID — your Firebase Console → Authentication → Sign-in
#                             method → Google → Web client ID
#    Leave empty during initial bring-up — the Continue-with-Google button
#    auto-hides when the client ID is empty.

# 3. Download Firebase config files from YOUR new project
#    (see § Firebase client config below)

# 4. Point firebase-tools at YOUR project
firebase login
firebase use <your-project-id>       # replace, then update .firebaserc
```

---

## Firebase client config

These files are **gitignored** and must be downloaded once per developer machine.

### Android — `aura/android/app/google-services.json`

1. Firebase Console → ⚙️ **Project Settings** → **Your apps** → Android app `com.nightlife.auraapp`
2. Click **google-services.json**
3. Save it to `aura/android/app/google-services.json`

### iOS — `aura/ios/GoogleService-Info.plist`

1. Same Project Settings page → iOS app `com.nightlife.auraapp`
2. Click **GoogleService-Info.plist**
3. Save it to `aura/ios/GoogleService-Info.plist`
4. After saving, open `aura/ios/aura.xcworkspace` in Xcode and confirm the file is in the `aura` group (Xcode usually picks it up automatically; if not, drag it into the project navigator).

**The app will not build without both files.**

---

## Adding your debug SHA to Firebase

Phone-OTP authentication fails with `[auth/app-not-authorized]` if your debug-signing certificate isn't registered in Firebase. Do this once per developer machine.

```bash
# Extract both SHAs from the debug keystore (committed in the repo)
cd aura/android/app
keytool -list -v -keystore debug.keystore \
  -alias androiddebugkey -storepass android -keypass android \
  | grep -E "SHA1|SHA-?256"
```

Copy both fingerprints. Then:

1. Firebase Console → ⚙️ Project Settings → Your apps → Android app
2. **Add fingerprint** → paste SHA-1
3. **Add fingerprint** → paste SHA-256
4. **Re-download `google-services.json`** (it now contains the SHA hash) and replace your local copy
5. Rebuild the app

If you generate your own debug keystore (Android Studio does this if `debug.keystore` is missing), repeat with your fingerprints.

---

## Play Integrity API (for phone OTP)

Firebase phone auth on Android validates request authenticity via Google's Play Integrity API. If it's not enabled on the GCP project, you get `[auth/app-not-authorized] Invalid app info in play_integrity_token` even when SHAs are registered.

1. Go to https://console.cloud.google.com/apis/library/playintegrity.googleapis.com (make sure your new project is selected in the top bar)
2. Click **Enable**
3. Wait ~2 minutes for propagation

**Sideloaded debug-signed APKs are not always trusted by Play Integrity.** Workarounds:

- **For development / trusted testers:** add their numbers as fixed-OTP test numbers — Firebase Console → Authentication → Sign-in method → Phone → "Phone numbers for testing". Up to 10 entries. No SMS sent; the fixed OTP always works.
- **For real Play Store distribution:** upload the APK to the Play Console internal testing track at least once. Play Integrity needs a known version-code + signing-cert pair to verify.

---

## Bootstrap a super-admin

Several Cloud Functions are gated on a `/superAdmins/{uid}` document. Without it, you cannot run `seedMumbaiEvents`, `seedMumbaiVenueCatalogue`, `seedPseudoAdmin`, or create platform-wide rewards.

1. Sign into the AURA app at least once with your phone number — this creates your Firebase Auth UID and `/users/{uid}` doc.
2. Find your UID: Firebase Console → Authentication → Users tab → copy your UID.
3. Firestore Console → Start a new collection `superAdmins` → Document ID = your UID → any payload (e.g. `{ "addedAt": <timestamp> }`).

Repeat for anyone else who needs super-admin powers.

---

## Day-to-day commands

Run from the **repo root** unless noted:

```bash
# Mobile app
npm run app:start             # Metro bundler
npm run app:android           # Build + install on connected device/emulator
npm run app:ios               # Build + run on iOS simulator (macOS only)
npm run app:test              # jest
npm run app:lint              # eslint

# Cloud Functions
npm run functions:build           # tsc → functions/lib/
npm run functions:build:watch     # incremental tsc
npm run functions:serve           # Firebase emulator (functions only)
npm run functions:deploy          # Deploy all functions to asia-south1
npm run functions:lint            # eslint, max-warnings 0

# Cloud Functions tests (run from functions/)
cd functions && npm test
```

---

## Building a release APK

### Debug-signed APK (for trusted-tester sideload)

```bash
cd aura/android
./gradlew clean
./gradlew assembleRelease
# → aura/android/app/build/outputs/apk/release/app-release.apk  (~73 MB)
```

Falls back to the committed `debug.keystore` when no release keystore env vars are set. Fine for sharing with trusted testers via Drive / WhatsApp / Firebase App Distribution.

**Testers must uninstall any previous APK** before installing a new one if the signing key changes.

### Release-signed APK (Play Store)

1. Generate a release keystore (once, store securely — losing this means losing all your existing Play Store installs):
   ```bash
   keytool -genkey -v -keystore aura-release.keystore \
     -alias aura-release -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Save the keystore outside the repo. Add the following to `~/.gradle/gradle.properties` (or as CI secrets):
   ```properties
   AURA_RELEASE_STORE_FILE=/absolute/path/to/aura-release.keystore
   AURA_RELEASE_STORE_PASSWORD=…
   AURA_RELEASE_KEY_ALIAS=aura-release
   AURA_RELEASE_KEY_PASSWORD=…
   ```
3. Build:
   ```bash
   cd aura/android
   ./gradlew assembleRelease
   ./gradlew bundleRelease    # AAB for Play Store upload
   ```
4. Register the **release SHA-1 and SHA-256** in Firebase Console (same way as the debug SHAs) and re-download `google-services.json`.
5. If using Play App Signing, Google re-signs your AAB with their key. Grab the SHAs from **Play Console → Setup → App integrity** and register those in Firebase too.

---

## Distributing to testers

### Manual (small group)

Build the release APK, share it via Drive / WhatsApp / Telegram / WeTransfer. Testers enable **Settings → Apps → Special access → Install unknown apps** for their browser, then tap to install.

### Firebase App Distribution (recommended for >2 testers)

```bash
firebase appdistribution:distribute \
  /Users/.../aura/android/app/build/outputs/apk/release/app-release.apk \
  --app 1:245062000701:android:<from-firebase-console> \
  --groups trusted-testers \
  --release-notes "Beta build $(date +%Y-%m-%d)"
```

Get the app ID from Firebase Console → Project Settings → Your apps → Android → App ID.

---

## Deploying backend changes

```bash
# Functions
npm run functions:deploy

# Rules — DEPLOY EVERY TIME YOU EDIT firestore.rules / storage.rules / database.rules.json
firebase deploy --only firestore:rules,storage,database

# Indexes
firebase deploy --only firestore:indexes

# Everything at once
firebase deploy
```

**Rules deployment is manual.** CI does not auto-deploy. If you edit rules and don't deploy, the client app silently breaks with `permission-denied` on the next launch. This is the #1 source of mysterious bugs in this repo.

---

## Troubleshooting

### Cloud Function deploys fail with "permission denied"

You aren't an editor on the GCP project, or `firebase login` is stale.
```bash
firebase logout
firebase login
firebase use <your-project-id>
```

### Scrapers return 0 events

This is **expected** — BookMyShow, Insider, and Timeout block requests from GCP IPs. The fallback is `seedMumbaiEvents` (a callable that writes 10 recurring Mumbai events to Firestore). Re-run it weekly:
```bash
firebase functions:call seedMumbaiEvents
```
Or use Firebase Console → Functions → seedMumbaiEvents → Test. (You must be a super-admin.)

To unblock real scraping in production, get an **Eventbrite Platform API token** (free) and set it:
```bash
firebase functions:secrets:set EVENTBRITE_TOKEN
```
For BookMyShow/Insider, you need a **residential proxy** provider — those sites block all cloud IPs.

---

## Phone OTP testing workflow

For each new tester:

1. Firebase Console → **Authentication** → **Sign-in method** → **Phone** (click Edit)
2. Scroll to **Phone numbers for testing (optional)**
3. Add: phone number (in E.164 format, e.g. `+919876543210`) and a fixed code (e.g. `123456`)
4. Save

The tester now signs in with their number and the fixed code, bypassing Play Integrity entirely. **Max 10 test numbers per Firebase project.**

For real-SMS OTP, you need the app uploaded to Play Console at least once on an internal-testing track.

---

## Tech stack

**Frontend**
- React Native 0.85 (Hermes, React 19) targeting Android compileSdk 36 / iOS 15+
- `@react-native-firebase/*` for auth, firestore, functions, storage, messaging
- `@react-native-google-signin/google-signin` for Google sign-in
- `react-native-video`, `react-native-image-picker`, `react-native-create-thumbnail` for live media
- `@react-navigation/native-stack`, `react-native-screens`, `react-native-safe-area-context`
- `@react-native-community/geolocation` for GPS check-in
- `lucide-react-native` for icons

**Backend**
- Firebase Cloud Functions (v2, Node 22, TypeScript strict) in region `asia-south1`
- Firestore (primary DB)
- Realtime Database (presence + live counters, region `asia-southeast1`)
- Cloud Storage (videos + thumbnails)
- Cloud Messaging (FCM push)
- Google Places API (venue discovery)
- Razorpay Payout API (UPI disbursements — wired but disabled, Phase 2 enable)

**Tooling**
- TypeScript strict mode in both packages
- ESLint, max-warnings 0 on functions
- Jest + ts-jest, 48 tests across both packages
- GitHub Actions CI (`.github/workflows/ci.yml`)

---

## Architecture overview

Major flows:

1. **Sign-in** (`EntryScreen` → `AuthProvider` → `fetchOrCreateUserDoc`)
   - Phone OTP via `auth().signInWithPhoneNumber()`, normalised to E.164 server-side
   - Email + password via `signInWithEmailAndPassword`
   - Google via `@react-native-google-signin` → `signInWithCredential`
   - Creates `/users/{uid}` if missing, runs schema backfill, registers FCM token once per UID

2. **Live signal submission** (`UploadFlow` → `submitLiveSignal` → `recalculateVenueLive`)
   - Client gets fresh GPS fix → uploads video to `/liveSignals/{uid}/{ts}.mp4` → uploads thumbnail to `/thumbs/`
   - Calls `submitLiveSignal` (callable) which validates vibe enum, location freshness (60 s), rate limit (6/hr), and geofence (within `venue.geofenceRadius` metres)
   - Writes signal doc to `/liveSignals`, advances `/checkInSessions/{uid}_{venueId}_{nightKey}`
   - Recomputes `/venueLive/{venueId}` aggregate (live score, vibe consensus, crowd label)
   - On any rejection, client deletes the uploaded Storage objects to avoid orphans

3. **Check-in + reward** (`ClaimRewardScreen` → `validateContribution` → `processUpiPayout`)
   - 3-step session: GPS verify → first clip → second clip after 30-min cooldown → redemption code
   - Reward record written to `/rewards/{id}` with `status: 'pending'`
   - `processUpiPayout` Firestore trigger (disabled until Razorpay credentials configured) reads `/users/{uid}.upiId`, calls Razorpay Payouts API, updates reward to `'paid'` or `'failed'`
   - UPI ID is never persisted on `/rewards` for privacy — only `payoutId` + `utr` reference

4. **Event scraping** (scheduled `scrapeTonightEvents` → normalize → dedupe → match → publish)
   - Runs every 60 minutes, fans out in parallel to 6 sources across 3 priority layers: BookMyShow + District (primary), Eventbrite + Ticketmaster (official APIs), Insider + Timeout (fallback)
   - Matches events to Google Places venues with a confidence score before publishing
   - BMS / Insider / Timeout currently return empty (GCP IP blocking) — seeded data via `seedMumbaiEvents` instead

5. **Venue admin flow** (role-gated by `userDoc.role === 'venue_admin'`)
   - Lives inside the same RN app (no separate admin web portal)
   - `adminSubmitSignal` writes official signals tagged `sourceType: 'admin'`
   - `adminCreateVenueReward` etc. gate on `/venueAdmins/{uid}.managedVenueIds`
   - Platform-wide rewards (`venueId: null`) require `/superAdmins/{uid}`

---

## Security model

- **All security-critical writes go through Cloud Functions** (callables); clients never write to `/rewards`, `/checkInSessions`, `/venueAnalyticsDaily`, etc. directly
- **Firestore rules** enforce per-collection access:
  - `/users` is **owner-only read** (no cross-user PII leak); update is whitelisted to a fixed field set via `isValidUserDoc()`
  - Server-managed fields (`role`, `accountStatus`, `rewardsBalance`, `totalEarned`, `phoneNumber`, `createdAt`) are immutable client-side
  - `/checkins` reads gated to owner or managing venue admin
  - `/superAdmins` blocked from all client access; Cloud Functions read via Admin SDK
- **Storage rules** cap size (5 MB images, 150 MB video), enforce content-type per path, gate writes to file owner
- **Realtime DB rules** allow only owner-written presence; aggregates are server-only; messages capped at 280 chars
- **UPI VPA regex**: `/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{2,63}$/` — strict server-side validation
- **Phone normalisation** throws on invalid input (no silent fallthrough); E.164 for India (`+91 + 10 digits, leading 6-9`)
- **Display name** sanitised against a Unicode-letter whitelist (`\p{L}\p{M}\p{N}` + space, `. ' _ -`), 50-char cap
- **Rate limits**: 6 live signals / user / venue / hour, 5 verified check-ins / user / day, 2 check-ins / user / venue / night
- **Location freshness**: client must send `locationTimestamp` < 60 s old, server rejects stale fixes
- **App Privacy**: iOS `PrivacyInfo.xcprivacy` declares all 9 collected data types (location, phone, email, name, payment, photos/videos, device ID, analytics, crash)

---

## Folder conventions

- `aura/src/screens/` — top-level routed screens (one per file)
- `aura/src/components/` — reusable UI; sub-folders per feature area (`auth/`, `profile/`, `venueDetail/`)
- `aura/src/services/` — async business logic (auth, userService, venues, events, discovery, analytics)
- `aura/src/utils/` — pure helpers (time, age, nightKey, firebaseErrors, camera, vibeMatching)
- `aura/src/firebase/` — SDK clients and config
- `aura/src/theme/` — colors, typography, spacing, radius
- `functions/src/*.ts` — one Cloud Function per file at the top of `src/`
- `functions/src/jobs/` — scheduled jobs + super-admin seed callables
- `functions/src/scrapers/` — per-source event scrapers
- `functions/src/pipeline/` — event normalisation, dedupe, publish
- `functions/src/places/` — Places API integration

---

## Testing

```bash
# Mobile (17 tests)
cd aura && npm test

# Cloud Functions (31 tests — UPI regex, vibe enum, location freshness,
# payout status, payout body, time util, display-name, phone)
cd functions && npm test
```

Pure validators have full unit-test coverage. **Full handler integration tests against the Firestore emulator are a Phase 2 item.** If you add a new validator or change UPI / phone / age rules, write a test first — the existing tests in `__tests__/` are good templates.

---

## CI

`.github/workflows/ci.yml` runs on every PR and push to `main`. Two jobs:

- **aura** — `npm ci` → `tsc --noEmit` → `npm run lint` → `npm test`
- **functions** — `npm install` → `tsc --noEmit` → `npm run lint`

The aura job provisions a placeholder `env.ts` (from `env.example.ts`) so the typecheck passes without real credentials.

**Neither job deploys anything.** Deployments are manual.

---

## What's done vs Phase 2

Quick summary of what's NOT done and needs to be picked up:

| Phase 2 item | What to do |
|---|---|
| **Enable UPI payouts** | Get Razorpay creds, `firebase functions:secrets:set RAZORPAY_KEY_ID/KEY_SECRET/ACCOUNT_NUMBER`, uncomment `processUpiPayout` export in `functions/src/index.ts`, deploy, payout pilot |
| **Play Store submission** | Generate release keystore, internal testing track, screenshots, App Privacy answers, Play Console listing |
| **App Store submission** | Apple Developer Program ($99/yr), TestFlight, App Store Connect listing |
| **Scraper unblock** | Eventbrite token (free, easy) or residential proxy provider (paid, BMS/Insider) |
| **In-app payment flow** | BookingModal / VIPOptionsModal / PayViaAuraModal are UI shells; wire to Razorpay Standard Checkout |
| **Founder analytics dashboard** | `/analyticsEvents` is being captured + rolled up daily/weekly; build a web dashboard or use Looker Studio |
| **Web admin portal** | All admin functions currently inside the RN app; web version is a separate build |
| **Background scraper job** | Set up Cloud Scheduler in a non-GCP region, or use Cloud Run with VPC connector to a residential proxy |
| **Push notification ops UI** | FCM is wired; campaign UI for marketing is not built |
| **Integration tests for Cloud Functions** | Pure validators covered with 31 unit tests; handler tests against Firestore emulator are TODO |

---

## What you need from the client / accounts to provision

> The Firebase + GCP project referenced in this codebase is on the original developer's account and is not being transferred — you spin up your own (see the note at the top of [§ First-time setup](#first-time-setup)).

| Item | Where it lives | Why you need it |
|---|---|---|
| Razorpay merchant credentials | Razorpay dashboard | Configure UPI payouts (Phase 2) |
| Google Play Console access | Play Developer Console | Upload APK to Play Store (Phase 2) |
| Apple Developer Team access | App Store Connect | iOS distribution (Phase 2) |
| Domain access for `auraapp.in` (or replacement) | wherever client hosts DNS | Privacy + terms pages |
| Eventbrite Platform API token (if pursuing) | Eventbrite developer console | Unblock event scraping |
| List of beta tester phone numbers | from the client | Add as test numbers in your own Firebase Auth |

---

## Quick reference — bundle IDs + original dev's project values

Bundle IDs are baked into the codebase. The Firebase project IDs below are the **original developer's** — documented so you can recognise references in code/configs and replace them with your own values.

| Used by | Original dev's value | Your action |
|---|---|---|
| Firebase project ID | `aura-app-ee15d` | Replace in `.firebaserc` and `firebase use` |
| Firebase project number | `245062000701` | Visible in your own `google-services.json` after setup |
| Functions region | `asia-south1` | Keep — pinned in `firebase.json` |
| Realtime DB region | `asia-southeast1` | Keep — match this when creating your RTDB instance |
| Android package name | `com.nightlife.auraapp` | Keep, or change in `aura/android/app/build.gradle` `applicationId` |
| iOS bundle identifier | `com.nightlife.auraapp` | Keep, or change in `aura/ios/aura/Info.plist` |

---

## License & status

Personal / pre-launch project. Not currently licensed for redistribution.
