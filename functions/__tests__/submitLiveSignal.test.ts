/**
 * Unit tests for the pure validators in submitLiveSignal: vibe-tag enum and
 * GPS-fix freshness. Geofence and rate-limit checks depend on Firestore and
 * are covered by integration tests.
 */
import {
  isValidVibeTag,
  isLocationFresh,
  LOCATION_FRESHNESS_MS,
  VALID_VIBE_TAGS,
} from '../src/submitLiveSignal';

describe('isValidVibeTag', () => {
  it('accepts each canonical tag', () => {
    for (const tag of VALID_VIBE_TAGS) {
      expect(isValidVibeTag(tag)).toBe(true);
    }
  });

  it('rejects unknown tags', () => {
    expect(isValidVibeTag('packed')).toBe(false);
    expect(isValidVibeTag('HOT')).toBe(false);     // case-sensitive
    expect(isValidVibeTag('')).toBe(false);
    expect(isValidVibeTag('null')).toBe(false);
  });

  it('rejects non-string inputs', () => {
    expect(isValidVibeTag(null)).toBe(false);
    expect(isValidVibeTag(undefined)).toBe(false);
    expect(isValidVibeTag(0)).toBe(false);
    expect(isValidVibeTag(true)).toBe(false);
    expect(isValidVibeTag({ tag: 'hot' })).toBe(false);
  });
});

describe('isLocationFresh', () => {
  const now = 1_700_000_000_000;

  it('accepts a timestamp at "now"', () => {
    expect(isLocationFresh(now, now)).toBe(true);
  });

  it('accepts a timestamp just inside the freshness window', () => {
    expect(isLocationFresh(now - LOCATION_FRESHNESS_MS, now)).toBe(true);
    expect(isLocationFresh(now - (LOCATION_FRESHNESS_MS - 1), now)).toBe(true);
  });

  it('rejects a timestamp just outside the freshness window', () => {
    expect(isLocationFresh(now - LOCATION_FRESHNESS_MS - 1, now)).toBe(false);
  });

  it('rejects a future timestamp (clock skew / spoof)', () => {
    expect(isLocationFresh(now + 1000, now)).toBe(false);
  });

  it('rejects non-numeric inputs', () => {
    expect(isLocationFresh(undefined, now)).toBe(false);
    expect(isLocationFresh(null, now)).toBe(false);
    expect(isLocationFresh('1700000000000', now)).toBe(false);
    expect(isLocationFresh({ ts: now }, now)).toBe(false);
  });

  it('freshness window is one minute', () => {
    expect(LOCATION_FRESHNESS_MS).toBe(60_000);
  });
});
