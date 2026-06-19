/**
 * vibeMatching — scoring utilities for the AURA discovery model.
 *
 * Rule:
 *   Vibe decides relevance
 *   Distance decides order
 *   Live signals decide urgency
 *   Check-in GPS decides authenticity (handled separately)
 *
 * finalScore = vibeMatchScore×3 + distanceScore×2 + liveBoost + eventBoost
 */
import type { VenueResult } from '../services/venues';
import type { VenueLabels, EventDoc } from '../services/events';

// Per-aura type weights (0–1)

const TYPE_WEIGHTS: Record<string, Record<string, number>> = {
  'high-energy': {
    night_club: 1.0, dance_club: 1.0,
    bar: 0.35, cocktail_bar: 0.2, lounge: 0.15,
  },
  'chill': {
    bar: 0.9, cocktail_bar: 0.8, wine_bar: 0.85, lounge: 0.9,
    rooftop_bar: 0.7, cafe: 0.5,
    night_club: 0.1,
  },
  'date-night': {
    cocktail_bar: 1.0, wine_bar: 0.95, rooftop_bar: 1.0, lounge: 0.85,
    bar: 0.5, night_club: 0.1,
  },
  'big-group': {
    night_club: 0.85, bar: 0.6, lounge: 0.5,
  },
  'budget': {
    bar: 0.55, night_club: 0.45, lounge: 0.35,
  },
  'spontaneous': {},  // everything scores neutrally
};

// Event tag → aura mapping

const EVENT_TAG_MAP: Record<string, string[]> = {
  'high-energy': ['dj night', 'edm', 'techno', 'bollywood', 'nightlife', 'dance', 'rave', 'house'],
  'chill':       ['acoustic', 'jazz', 'blues', 'lounge night', 'cocktails', 'sunset'],
  'date-night':  ['couples', 'romantic', 'jazz', 'wine', 'cocktail', 'candlelight'],
  'big-group':   ['ladies night', 'group', 'party', 'celebration', 'open bar', 'bottomless'],
  'budget':      ['free entry', 'open bar', 'deals', 'happy hour', 'discount'],
};

// Component scorers

export function getVibeMatchScore(
  venue: VenueResult,
  labels: VenueLabels,
  selectedAura: string,
): number {
  if (selectedAura === 'spontaneous') return 0.75; // neutral, everything qualifies

  // Admin overrides take precedence
  if (venue.adminVibeTags?.includes(selectedAura)) return 1.0;
  // Auto-derived tags are strong signals
  if (venue.vibeTags?.includes(selectedAura)) return 0.88;

  // Derive from Google Place types
  const typeScores = TYPE_WEIGHTS[selectedAura] ?? {};
  let typeScore = 0;
  for (const t of venue.types) {
    const s = typeScores[t] ?? 0;
    if (s > typeScore) typeScore = s;
  }

  // Attribute boosts
  let attrBoost = 0;
  switch (selectedAura) {
    case 'high-energy':
      if (venue.attributes.liveMusic) attrBoost += 0.2;
      if (labels.vibeLabel === 'hot') attrBoost += 0.15;
      break;
    case 'date-night':
      if (venue.attributes.servesCocktails)    attrBoost += 0.25;
      if (venue.attributes.outdoorSeating)     attrBoost += 0.1;
      break;
    case 'big-group':
      if (venue.attributes.goodForGroups)      attrBoost += 0.4;
      break;
    case 'chill':
      if (venue.attributes.outdoorSeating)     attrBoost += 0.1;
      if (labels.vibeLabel === 'slow')         attrBoost += 0.1;
      break;
    case 'budget':
      if (venue.priceLevel === '₹')            attrBoost += 0.5;
      else if (venue.priceLevel === '₹₹')      attrBoost += 0.3;
      else if (venue.priceLevel === '₹₹₹₹')   attrBoost -= 0.3;
      break;
  }

  return Math.min(1.0, Math.max(0, typeScore + attrBoost));
}

// Distance decays linearly from 1.0 at 0 km to 0 at 25 km
export function getDistanceScore(distanceKm: number): number {
  return Math.max(0, 1 - distanceKm / 25);
}

// Live signals and event state boost urgency
export function getLiveBoost(labels: VenueLabels): number {
  let boost = 0;
  if (labels.isOngoing)   boost += 1.0;
  else if (labels.isLiveNow) boost += 0.55;
  if (labels.isTrending)  boost += 0.25;
  boost += Math.min(0.5, labels.liveScore / 20);
  return boost;
}

// Any event tonight is a boost; matching tags sharpen it
export function getEventBoost(
  tonightEvent: EventDoc | null,
  selectedAura: string,
): number {
  if (!tonightEvent) return 0;
  const relevantTags = EVENT_TAG_MAP[selectedAura] ?? [];
  const hasTagMatch  = (tonightEvent.tags ?? []).some(
    (t) => relevantTags.some((r) => t.toLowerCase().includes(r)),
  );
  return hasTagMatch ? 0.5 : 0.2;
}

// Final ranking formula

export interface ScoredVenue {
  vibeMatchScore: number;
  distanceScore:  number;
  liveBoost:      number;
  eventBoost:     number;
  finalScore:     number;
}

export function scoreVenue(
  venue: VenueResult,
  labels: VenueLabels,
  tonightEvent: EventDoc | null,
  distanceKm: number,
  selectedAura: string,
): ScoredVenue {
  const vibeMatchScore = getVibeMatchScore(venue, labels, selectedAura);
  const distanceScore  = getDistanceScore(distanceKm);
  const liveBoost      = getLiveBoost(labels);
  const eventBoost     = getEventBoost(tonightEvent, selectedAura);
  const finalScore     = vibeMatchScore * 3 + distanceScore * 2 + liveBoost + eventBoost;
  return { vibeMatchScore, distanceScore, liveBoost, eventBoost, finalScore };
}

// Minimum vibe relevance to appear in filtered results
export const VIBE_THRESHOLD = 0.15;
