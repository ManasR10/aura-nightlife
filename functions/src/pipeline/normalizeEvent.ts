/**
 * normalizeEvent — converts a RawScrapedEvent into a normalized event
 * ready for venue matching and Firestore write.
 *
 * Tonight window: today 6 PM → tomorrow 4 AM (IST)
 * Default end time: startAt + 4 hours if no end time given
 */
import { Timestamp } from 'firebase-admin/firestore';
import type { RawScrapedEvent, EventDoc, EventStatus, EventSource } from '../types';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function toIst(date: Date): Date {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

function parseEventDate(raw: RawScrapedEvent): { start: Date; end: Date } | null {
  try {
    const dateBase = new Date(raw.dateText);
    if (isNaN(dateBase.getTime())) return null;

    // Parse start time
    let start: Date;
    if (raw.startTimeText) {
      const [h, m] = raw.startTimeText.split(':').map(Number);
      start = new Date(dateBase);
      start.setHours(h, m, 0, 0);
    } else {
      // Default: 9 PM for nightlife events
      start = new Date(dateBase);
      start.setHours(21, 0, 0, 0);
    }

    // Parse end time
    let end: Date;
    if (raw.endTimeText) {
      const [h, m] = raw.endTimeText.split(':').map(Number);
      end = new Date(dateBase);
      end.setHours(h, m, 0, 0);
      // End time is "next day" if < start time (e.g., event ends at 2 AM)
      if (end <= start) {
        end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      }
    } else {
      // Default: 4 hours after start
      end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
    }

    return { start, end };
  } catch {
    return null;
  }
}

function computeStatus(start: Date, end: Date): EventStatus {
  const now = new Date();
  if (now < start) return 'upcoming';
  if (now >= start && now <= end) return 'ongoing';
  return 'ended';
}

function isTonightWindow(start: Date): boolean {
  const nowIst = toIst(new Date());
  const startIst = toIst(start);

  // Tonight = current day 6 PM → next day 4 AM (IST)
  const todayEvening = new Date(nowIst);
  todayEvening.setHours(18, 0, 0, 0);

  const tomorrowMorning = new Date(nowIst);
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
  tomorrowMorning.setHours(4, 0, 0, 0);

  return startIst >= todayEvening && startIst <= tomorrowMorning;
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCoverCharge(priceText: string | null): number | null {
  if (!priceText || priceText.toLowerCase() === 'free') return null;
  const match = priceText.match(/[₹$](\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export interface NormalizedEvent {
  eventId: string;
  source: EventSource;
  sources: Array<{ source: EventSource; url: string }>;
  title: string;
  normalizedTitle: string;  // for deduplication
  description: string | null;
  startAt: Date;
  endAt: Date;
  imageUrl: string | null;
  url: string;
  priceText: string | null;
  coverCharge: number | null;
  performers: string[];
  tags: string[];
  rawVenueName: string;
  rawAddress: string | null;
  city: string;
  locality: string | null;
  status: EventStatus;
  isTonightEvent: boolean;
  scrapedAt: Date;
}

export function normalizeEvent(raw: RawScrapedEvent): NormalizedEvent | null {
  if (!raw.title?.trim()) return null;

  const dates = parseEventDate(raw);
  if (!dates) return null;

  const { start, end } = dates;
  const status = computeStatus(start, end);

  // Skip events that have already ended
  if (status === 'ended') return null;

  // Generate stable ID from source + venue + title + date
  const idSource = `${raw.source}-${raw.rawVenueName}-${raw.title}-${start.toDateString()}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);

  return {
    eventId: idSource,
    source: raw.source,
    sources: [{ source: raw.source, url: raw.url }],
    title: raw.title.trim(),
    normalizedTitle: normalizeTitle(raw.title),
    description: null,
    startAt: start,
    endAt: end,
    imageUrl: raw.imageUrl,
    url: raw.url,
    priceText: raw.priceText,
    coverCharge: extractCoverCharge(raw.priceText),
    performers: raw.performers,
    tags: raw.tags,
    rawVenueName: raw.rawVenueName.trim(),
    rawAddress: raw.rawAddress,
    city: raw.city,
    locality: raw.locality,
    status,
    isTonightEvent: isTonightWindow(start),
    scrapedAt: raw.scrapedAt,
  };
}

export function toEventDoc(
  normalized: NormalizedEvent,
  venueId: string | null,
  confidenceScore: number,
): EventDoc {
  return {
    eventId: normalized.eventId,
    venueId,
    source: normalized.source,
    sources: normalized.sources,
    title: normalized.title,
    description: normalized.description,
    startAt: Timestamp.fromDate(normalized.startAt),
    endAt: Timestamp.fromDate(normalized.endAt),
    imageUrl: normalized.imageUrl,
    url: normalized.url,
    priceText: normalized.priceText,
    coverCharge: normalized.coverCharge,
    performers: normalized.performers,
    tags: normalized.tags,
    rawVenueName: normalized.rawVenueName,
    rawAddress: normalized.rawAddress,
    status: normalized.status,
    confidenceScore,
    scrapedAt: Timestamp.fromDate(normalized.scrapedAt),
  };
}
