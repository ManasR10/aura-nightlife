/**
 * Unit tests for the pure validators in validateContribution.
 *
 * The full Cloud Function handler exercises Firestore and is covered by
 * integration tests (TODO — wire up firebase-functions-test). These tests
 * cover the security-critical pure pieces: UPI VPA regex and the haversine
 * distance helper that backs the geofence check.
 */
import { isValidUpiId, UPI_ID_REGEX, haversineMeters } from '../src/validateContribution';

describe('isValidUpiId', () => {
  it('accepts canonical Indian UPI handles', () => {
    expect(isValidUpiId('riya@okaxis')).toBe(true);
    expect(isValidUpiId('9876543210@paytm')).toBe(true);
    expect(isValidUpiId('rohit.singh@ybl')).toBe(true);
    expect(isValidUpiId('user_name@oksbi')).toBe(true);
    expect(isValidUpiId('first.last-name@okhdfcbank')).toBe(true);
  });

  it('trims surrounding whitespace before validating', () => {
    expect(isValidUpiId('   riya@okaxis   ')).toBe(true);
    expect(isValidUpiId('\triya@okaxis\n')).toBe(true);
  });

  it('rejects handles missing the @ separator', () => {
    expect(isValidUpiId('riyaokaxis')).toBe(false);
    expect(isValidUpiId('')).toBe(false);
  });

  it('rejects handles with empty or too-short bank handles', () => {
    expect(isValidUpiId('riya@')).toBe(false);
    expect(isValidUpiId('riya@ok')).toBe(false);     // bank handle < 3 chars
    expect(isValidUpiId('riya@1pay')).toBe(false);   // bank handle starts with a digit
  });

  it('rejects injection-shaped payloads', () => {
    expect(isValidUpiId("'; DROP TABLE users;--")).toBe(false);
    expect(isValidUpiId('<script>@xss')).toBe(false);
    expect(isValidUpiId('a@b\nx@c')).toBe(false);
    expect(isValidUpiId('a@b c')).toBe(false);
  });

  it('rejects multi-@ handles', () => {
    expect(isValidUpiId('a@b@c')).toBe(false);
  });

  it('rejects handles with disallowed characters before @', () => {
    expect(isValidUpiId('riya!@okaxis')).toBe(false);
    expect(isValidUpiId('riya space@okaxis')).toBe(false);
  });

  it('UPI_ID_REGEX is anchored on both ends', () => {
    // Regex should not allow leading/trailing junk
    expect(UPI_ID_REGEX.test('x riya@okaxis')).toBe(false);
    expect(UPI_ID_REGEX.test('riya@okaxis x')).toBe(false);
  });
});

describe('haversineMeters', () => {
  it('returns ~0 for the same point', () => {
    expect(haversineMeters(19.0760, 72.8777, 19.0760, 72.8777)).toBeCloseTo(0, 1);
  });

  it('computes Mumbai → Pune ≈ 120 km (within 5%)', () => {
    // Mumbai CST (19.0760°N, 72.8777°E) → Pune (18.5204°N, 73.8567°E)
    const d = haversineMeters(19.0760, 72.8777, 18.5204, 73.8567);
    expect(d).toBeGreaterThan(115_000);
    expect(d).toBeLessThan(125_000);
  });

  it('is symmetric', () => {
    const a = haversineMeters(19.0760, 72.8777, 18.9220, 72.8347);
    const b = haversineMeters(18.9220, 72.8347, 19.0760, 72.8777);
    expect(a).toBeCloseTo(b, 5);
  });

  it('detects a 50m delta', () => {
    // Roughly 50m north at Mumbai latitude (1° lat ≈ 111km, so 50m ≈ 0.00045°)
    const d = haversineMeters(19.0760, 72.8777, 19.0760 + 0.00045, 72.8777);
    expect(d).toBeGreaterThan(45);
    expect(d).toBeLessThan(55);
  });
});
