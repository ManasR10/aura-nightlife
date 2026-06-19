/**
 * Eventbrite scraper — Mumbai nightlife events.
 *
 * Eventbrite has a public REST API that works from any IP.
 * Free tier allows read-only event discovery.
 *
 * Requires EVENTBRITE_TOKEN secret (get from eventbrite.com/platform).
 * Gracefully skips if token not set — don't break the pipeline.
 *
 * API docs: https://www.eventbrite.com/platform/api
 */
import type { RawScrapedEvent } from '../types';

const EVENTBRITE_API = 'https://www.eventbriteapi.com/v3';

// Eventbrite category IDs: 103=Music, 110=Food & Drink
// We fetch music events in Mumbai and filter for nightlife keywords.

const NIGHTLIFE_KEYWORDS = [
  'night', 'dj', 'party', 'club', 'bar', 'lounge', 'music',
  'bollywood', 'edm', 'techno', 'ladies', 'open bar', 'gig',
  'rave', 'house', 'electronic', 'concert', 'live',
];

function isNightlife(title: string, description = ''): boolean {
  const text = `${title} ${description}`.toLowerCase();
  return NIGHTLIFE_KEYWORDS.some((kw) => text.includes(kw));
}

function extractTags(title: string, desc = ''): string[] {
  const t = `${title} ${desc}`.toLowerCase();
  const tags: string[] = ['nightlife'];
  if (t.includes('ladies')) tags.push('ladies night');
  if (t.includes('dj') || t.includes('d.j')) tags.push('dj night');
  if (t.includes('bollywood')) tags.push('bollywood');
  if (t.includes('edm') || t.includes('techno') || t.includes('electronic')) tags.push('edm');
  if (t.includes('live music') || t.includes('live band') || t.includes('concert')) tags.push('live music');
  if (t.includes('open bar') || t.includes('unlimited')) tags.push('open bar');
  if (t.includes('rooftop')) tags.push('rooftop');
  return [...new Set(tags)];
}

export async function scrapeEventbrite(): Promise<RawScrapedEvent[]> {
  const token = process.env.EVENTBRITE_TOKEN;
  if (!token) {
    console.log('Eventbrite: EVENTBRITE_TOKEN not set, skipping');
    return [];
  }

  const events: RawScrapedEvent[] = [];

  try {
    // Tonight window: 6 PM IST → tomorrow 6 AM IST
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const nowUtc = Date.now();
    const nowIst = new Date(nowUtc + IST_OFFSET);

    const todayEvening = new Date(nowIst);
    todayEvening.setHours(18, 0, 0, 0);
    const tomorrowMorning = new Date(nowIst);
    tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
    tomorrowMorning.setHours(6, 0, 0, 0);

    // Convert back to UTC for the API
    const rangeStart = new Date(todayEvening.getTime() - IST_OFFSET).toISOString().slice(0, 16);
    const rangeEnd = new Date(tomorrowMorning.getTime() - IST_OFFSET).toISOString().slice(0, 16);

    const params = new URLSearchParams({
      'location.address': 'Mumbai, India',
      'location.within': '20km',
      'categories': '103',
      'expand': 'venue,ticket_classes',
      'page_size': '50',
      'sort_by': 'date',
      'start_date.range_start': rangeStart,
      'start_date.range_end': rangeEnd,
    });

    const res = await fetch(`${EVENTBRITE_API}/events/search/?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      console.warn(`Eventbrite API → ${res.status}`);
      return events;
    }

    const json = await res.json() as {
      events?: Array<{
        id: string;
        name?: { text?: string };
        description?: { text?: string };
        start?: { local?: string; utc?: string };
        end?: { local?: string; utc?: string };
        url?: string;
        logo?: { original?: { url?: string } };
        ticket_classes?: Array<{ cost?: { major_value?: string } }>;
        venue?: {
          name?: string;
          address?: {
            address_1?: string;
            city?: string;
            localized_area_display?: string;
          };
        };
      }>;
    };

    for (const ev of json.events ?? []) {
      const title = ev.name?.text ?? '';
      const description = ev.description?.text ?? '';
      if (!title || !isNightlife(title, description)) continue;

      const startLocal = ev.start?.local;
      if (!startLocal) continue;
      const startDate = new Date(startLocal);
      if (isNaN(startDate.getTime())) continue;

      const endLocal = ev.end?.local;
      const endDate = endLocal ? new Date(endLocal) : null;

      // Price: take the minimum ticket cost
      let priceText: string | null = null;
      const ticketClasses = ev.ticket_classes ?? [];
      const prices = ticketClasses
        .map((tc) => parseFloat(tc.cost?.major_value ?? ''))
        .filter((p) => !isNaN(p));
      if (prices.length > 0) {
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        priceText = minPrice === 0 ? 'Free' : minPrice === maxPrice ? `₹${minPrice}` : `₹${minPrice}–₹${maxPrice}`;
      }

      const venue = ev.venue;
      events.push({
        source: 'eventbrite',
        title,
        rawVenueName: venue?.name ?? '',
        rawAddress: venue?.address?.address_1 ?? null,
        city: venue?.address?.city ?? 'Mumbai',
        locality: venue?.address?.localized_area_display ?? null,
        dateText: startDate.toDateString(),
        startTimeText: startDate.toTimeString().slice(0, 5),
        endTimeText: endDate ? endDate.toTimeString().slice(0, 5) : null,
        priceText,
        imageUrl: ev.logo?.original?.url ?? null,
        url: ev.url ?? `https://www.eventbrite.com/e/${ev.id}`,
        tags: extractTags(title, description),
        performers: [],
        scrapedAt: new Date(),
      });
    }

    console.log(`Eventbrite: ${events.length} events`);
  } catch (err) {
    console.warn('Eventbrite scrape error:', err);
  }

  return events;
}
