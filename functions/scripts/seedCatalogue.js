#!/usr/bin/env node
/**
 * seedCatalogue.js — run the Mumbai venue seeder directly from the terminal.
 *
 * Usage:
 *   PLACES_API_KEY=AIza... node functions/scripts/seedCatalogue.js
 *
 * Optional flags:
 *   --dry-run          Print what would be seeded, write nothing
 *   --zones "Bandra West,Colaba"  Seed only specific zones
 *
 * Prerequisites:
 *   1. Either GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service
 *      account JSON, or run `gcloud auth application-default login` first.
 *   2. PLACES_API_KEY env var with a key that has Places API (New) enabled.
 *
 * Run from the repo root:
 *   PLACES_API_KEY=AIza... node functions/scripts/seedCatalogue.js
 */

'use strict';

const admin = require('firebase-admin');

// ── Arg parsing ───────────────────────────────────────────────────────────────

const args     = process.argv.slice(2);
const dryRun   = args.includes('--dry-run');
const zonesArg = (() => {
  const idx = args.indexOf('--zones');
  if (idx !== -1 && args[idx + 1]) return args[idx + 1].split(',').map((z) => z.trim());
  return null;
})();

// ── Init Admin SDK ────────────────────────────────────────────────────────────

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ── Config ────────────────────────────────────────────────────────────────────

const PLACES_API_KEY = process.env.PLACES_API_KEY;
if (!PLACES_API_KEY) {
  console.error('❌  PLACES_API_KEY env var is required.');
  console.error('   Set it like: PLACES_API_KEY=AIza... node functions/scripts/seedCatalogue.js');
  process.exit(1);
}

const PLACES_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';

const FIELD_MASK = [
  'places.id', 'places.displayName', 'places.location', 'places.types',
  'places.rating', 'places.userRatingCount', 'places.regularOpeningHours',
  'places.priceLevel', 'places.nationalPhoneNumber', 'places.websiteUri',
  'places.shortFormattedAddress', 'places.photos',
  'places.goodForGroups', 'places.liveMusic', 'places.servesCocktails', 'places.outdoorSeating',
].join(',');

const MUMBAI_ZONES = [
  { name: 'Bandra West',   lat: 19.0596, lng: 72.8295, radiusMetres: 1200, priorityBoost: 10 },
  { name: 'Lower Parel',   lat: 18.9944, lng: 72.8268, radiusMetres: 1200, priorityBoost: 10 },
  { name: 'Andheri West',  lat: 19.1197, lng: 72.8468, radiusMetres: 1500, priorityBoost:  8 },
  { name: 'BKC',           lat: 19.0640, lng: 72.8676, radiusMetres: 1000, priorityBoost:  8 },
  { name: 'Khar West',     lat: 19.0728, lng: 72.8353, radiusMetres:  800, priorityBoost:  6 },
  { name: 'Juhu',          lat: 19.0989, lng: 72.8267, radiusMetres: 1000, priorityBoost:  6 },
  { name: 'Colaba',        lat: 18.9219, lng: 72.8323, radiusMetres: 1000, priorityBoost:  7 },
  { name: 'Worli',         lat: 19.0176, lng: 72.8182, radiusMetres: 1000, priorityBoost:  7 },
  { name: 'Powai',         lat: 19.1197, lng: 72.9049, radiusMetres: 1200, priorityBoost:  5 },
  { name: 'Fort',          lat: 18.9340, lng: 72.8366, radiusMetres:  800, priorityBoost:  5 },
  { name: 'Andheri East',  lat: 19.1128, lng: 72.8712, radiusMetres: 1200, priorityBoost:  4 },
  { name: 'Versova',       lat: 19.1307, lng: 72.8166, radiusMetres: 1000, priorityBoost:  4 },
];

// ── Derivation helpers ────────────────────────────────────────────────────────

function normalizePriceLevel(raw) {
  const map = {
    PRICE_LEVEL_FREE: 'Free',
    PRICE_LEVEL_INEXPENSIVE: '₹',
    PRICE_LEVEL_MODERATE: '₹₹',
    PRICE_LEVEL_EXPENSIVE: '₹₹₹',
    PRICE_LEVEL_VERY_EXPENSIVE: '₹₹₹₹',
  };
  return raw ? (map[raw] ?? null) : null;
}

function deriveNightlifeCategory(types) {
  if (types.includes('night_club'))                            return 'club';
  if (types.includes('rooftop_bar'))                          return 'rooftop';
  if (types.includes('lounge'))                               return 'lounge';
  if (types.includes('wine_bar') || types.includes('cocktail_bar')) return 'bar';
  if (types.includes('cafe'))                                 return 'cafe';
  return 'bar';
}

function deriveVibeTags(types, attrs, priceLevel) {
  const tags = new Set();
  if (types.some((t) => ['night_club', 'dance_club'].includes(t))) {
    tags.add('high-energy'); tags.add('big-group');
  }
  if (types.some((t) => ['bar', 'cocktail_bar', 'wine_bar'].includes(t))) tags.add('chill');
  if (types.some((t) => ['lounge', 'wine_bar', 'cocktail_bar', 'rooftop_bar'].includes(t))) tags.add('date-night');
  if (attrs.liveMusic)       tags.add('high-energy');
  if (attrs.servesCocktails) tags.add('date-night');
  if (attrs.goodForGroups)   tags.add('big-group');
  if (attrs.outdoorSeating)  tags.add('chill');
  if (priceLevel === '₹' || priceLevel === '₹₹') tags.add('budget');
  return [...tags];
}

function deriveDiscoveryPriority(types, rating, userRatingCount, zonePriorityBoost) {
  let score = 50 + zonePriorityBoost;
  if (rating != null)                              score += Math.round((rating - 3.5) * 10);
  if (userRatingCount != null && userRatingCount > 500)  score += 10;
  else if (userRatingCount != null && userRatingCount > 100) score += 5;
  if (types.includes('night_club'))                score += 5;
  return Math.max(0, Math.min(100, score));
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const activeZones = zonesArg
    ? MUMBAI_ZONES.filter((z) => zonesArg.includes(z.name))
    : MUMBAI_ZONES;

  if (activeZones.length === 0) {
    console.error('No matching zones found. Valid zones:', MUMBAI_ZONES.map((z) => z.name).join(', '));
    process.exit(1);
  }

  console.log(`\n🌆 Seeding Mumbai catalogue`);
  console.log(`   Zones : ${activeZones.map((z) => z.name).join(', ')}`);
  console.log(`   Mode  : ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}\n`);

  const seen = new Map(); // placeId → enriched place

  for (const zone of activeZones) {
    process.stdout.write(`  Fetching ${zone.name}… `);
    try {
      const res = await fetch(PLACES_NEARBY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': PLACES_API_KEY,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify({
          includedTypes: ['bar', 'night_club'],
          maxResultCount: 20,
          locationRestriction: {
            circle: {
              center: { latitude: zone.lat, longitude: zone.lng },
              radius: zone.radiusMetres,
            },
          },
        }),
      });

      if (!res.ok) {
        console.log(`FAILED (${res.status})`);
        console.warn('   ', await res.text());
      } else {
        const data = await res.json();
        const places = data.places ?? [];
        let newCount = 0;
        for (const place of places) {
          if (!seen.has(place.id)) {
            seen.set(place.id, { ...place, _zone: zone.name, _boost: zone.priorityBoost });
            newCount++;
          }
        }
        console.log(`${places.length} places (${newCount} new, total ${seen.size})`);
      }
    } catch (err) {
      console.log(`ERROR — ${err.message}`);
    }

    await sleep(300); // respect Places API rate limit
  }

  console.log(`\n📊 Total unique venues: ${seen.size}`);

  if (dryRun) {
    console.log('\n✅  Dry run complete. No data written.');
    console.log('   Re-run without --dry-run to write to Firestore.');
    return;
  }

  // ── Write to Firestore in batches of 499 ─────────────────────────────────
  console.log('\n📝 Writing to Firestore /venues…');

  const now    = admin.firestore.Timestamp.now();
  let written  = 0;
  let batch    = db.batch();
  let batchCnt = 0;

  for (const [placeId, place] of seen.entries()) {
    const types      = place.types ?? [];
    const attrs      = {
      liveMusic:       place.liveMusic       ?? false,
      servesCocktails: place.servesCocktails ?? false,
      goodForGroups:   place.goodForGroups   ?? false,
      outdoorSeating:  place.outdoorSeating  ?? false,
    };
    const priceLevel = normalizePriceLevel(place.priceLevel);

    const doc = {
      placeId,
      name:              place.displayName?.text ?? '',
      address:           place.shortFormattedAddress ?? '',
      location:          { lat: place.location.latitude, lng: place.location.longitude },
      rating:            place.rating           ?? null,
      userRatingCount:   place.userRatingCount  ?? null,
      priceLevel,
      types,
      isOpen:            place.regularOpeningHours?.openNow ?? null,
      currentOpeningHours: place.regularOpeningHours?.weekdayDescriptions ?? null,
      phone:             place.nationalPhoneNumber ?? null,
      website:           place.websiteUri       ?? null,
      attributes:        attrs,
      photos:            (place.photos ?? []).slice(0, 5).map((p) => p.name),
      source:            'google_places',
      lastFetchedAt:     now,
      city:              'Mumbai',
      zone:              place._zone,
      nightlifeCategory: deriveNightlifeCategory(types),
      vibeTags:          deriveVibeTags(types, attrs, priceLevel),
      adminVibeTags:     [],
      discoveryEnabled:  true,
      discoveryPriority: deriveDiscoveryPriority(types, place.rating ?? null, place.userRatingCount ?? null, place._boost),
    };

    batch.set(db.collection('venues').doc(placeId), doc, { merge: true });
    batchCnt++;
    written++;

    if (batchCnt === 499) {
      await batch.commit();
      process.stdout.write(`  … committed ${written} docs\n`);
      batch    = db.batch();
      batchCnt = 0;
    }
  }

  if (batchCnt > 0) await batch.commit();

  console.log(`\n✅  Done! Wrote ${written} venues across ${activeZones.length} zones.`);
  console.log('   The app will pick them up on next catalogue load.\n');
}

main().catch((err) => {
  console.error('\n❌  Seed failed:', err);
  process.exit(1);
});
