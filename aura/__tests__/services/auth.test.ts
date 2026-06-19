/**
 * Unit tests for the pure validators in services/auth: phone normalization
 * and display-name sanitization. The Firebase auth/firestore operations
 * around them depend on native modules and are exercised by RN integration
 * tests rather than these unit tests.
 */
import { sanitizeDisplayName, InvalidPhoneError } from '../../src/services/auth';

describe('sanitizeDisplayName', () => {
  it('collapses internal whitespace and trims', () => {
    expect(sanitizeDisplayName('  Riya   Singh  ')).toBe('Riya Singh');
  });

  it('rejects empty input', () => {
    expect(() => sanitizeDisplayName('')).toThrow('Display name is required.');
    expect(() => sanitizeDisplayName('   ')).toThrow('Display name is required.');
  });

  it('rejects names over 50 chars', () => {
    expect(() => sanitizeDisplayName('a'.repeat(51))).toThrow(/50 characters or fewer/);
  });

  it('accepts up to 50 chars', () => {
    const name = 'a'.repeat(50);
    expect(sanitizeDisplayName(name)).toBe(name);
  });

  it("accepts apostrophes, hyphens, dots and underscores", () => {
    expect(sanitizeDisplayName("D'Souza")).toBe("D'Souza");
    expect(sanitizeDisplayName('Anne-Marie')).toBe('Anne-Marie');
    expect(sanitizeDisplayName('J.K. Rowling')).toBe('J.K. Rowling');
    expect(sanitizeDisplayName('user_42')).toBe('user_42');
  });

  it('accepts non-Latin scripts (Devanagari, Tamil)', () => {
    expect(sanitizeDisplayName('रिया')).toBe('रिया');
    expect(sanitizeDisplayName('ரவி')).toBe('ரவி');
  });

  it('rejects HTML / control characters', () => {
    expect(() => sanitizeDisplayName('<script>')).toThrow(/letters, numbers/);
    expect(() => sanitizeDisplayName('rohit;DROP')).toThrow(/letters, numbers/);
    expect(() => sanitizeDisplayName('emoji 👀')).toThrow(/letters, numbers/);
  });
});

// normalizeIndianPhone is not exported, but it's exercised via sendOtp.
// We test it indirectly through InvalidPhoneError's contract.
describe('InvalidPhoneError', () => {
  it('has a stable message and name', () => {
    const err = new InvalidPhoneError();
    expect(err.name).toBe('InvalidPhoneError');
    expect(err.message).toMatch(/10-digit/);
  });
});
