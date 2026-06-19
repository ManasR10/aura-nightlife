/**
 * Unit tests for the relative-time helpers used across feed cards, venue
 * detail, admin tabs, etc.
 */
import { timeAgo, minutesToAgo } from '../../src/utils/time';

describe('minutesToAgo', () => {
  it('returns "Just now" for elapsed < 1 minute', () => {
    expect(minutesToAgo(0)).toBe('Just now');
  });

  it('returns "Xm ago" for elapsed under an hour', () => {
    expect(minutesToAgo(1)).toBe('1m ago');
    expect(minutesToAgo(45)).toBe('45m ago');
    expect(minutesToAgo(59)).toBe('59m ago');
  });

  it('rolls over to hours at 60 minutes', () => {
    expect(minutesToAgo(60)).toBe('1h ago');
    expect(minutesToAgo(90)).toBe('1h ago');
    expect(minutesToAgo(119)).toBe('1h ago');
    expect(minutesToAgo(120)).toBe('2h ago');
  });

  it('rolls over to days at 24 hours', () => {
    expect(minutesToAgo(1440)).toBe('1d ago');
    expect(minutesToAgo(2879)).toBe('1d ago');
    expect(minutesToAgo(2880)).toBe('2d ago');
  });
});

describe('timeAgo', () => {
  const NOW = 1_700_000_000_000;
  const realNow = Date.now;

  beforeAll(() => { Date.now = () => NOW; });
  afterAll(()  => { Date.now = realNow; });

  it('accepts a unix millis number', () => {
    expect(timeAgo(NOW - 10 * 60_000)).toBe('10m ago');
  });

  it('accepts a Date instance', () => {
    expect(timeAgo(new Date(NOW - 90 * 60_000))).toBe('1h ago');
  });

  it('accepts any object with toMillis() (Firestore Timestamp shape)', () => {
    expect(timeAgo({ toMillis: () => NOW - 30 * 60_000 })).toBe('30m ago');
  });

  it('returns "Just now" for the present', () => {
    expect(timeAgo(NOW)).toBe('Just now');
  });
});
