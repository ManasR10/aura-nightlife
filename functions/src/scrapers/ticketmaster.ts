/**
 * Ticketmaster Discovery API scraper — Mumbai events.
 *
 * Official API — works from any IP, free tier available.
 * Better for concerts/larger shows than everyday club nights.
 * Focused on music, arts, sports in Mumbai.
 *
 * Get a free API key: https://developer.ticketmaster.com/
 * Then: firebase functions:secrets:set TICKETMASTER_KEY
 *
 * Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
 */
import type { RawScrapedEvent } from '../types';

const TM_API_BASE = 'https://app.ticketmaster.com/discovery/v2';

// Ticketmaster classification IDs (India)
// KZFzniwnSyZfZ7v7nJ = Music
// KZFzniwnSyZfZ7v7na = Arts & Theatre
const MUSIC_CLASS_ID = 'KZFzniwnSyZfZ7v7nJ';

const NIGHTLIFE_KEYWORDS = [
  'night', 'dj', 'party', 'club', 'bar', 'lounge', 'music',
  'bollywood', 'edm', 'techno', 'ladies', 'open bar', 'gig',
  'rave', 'house', 'electronic', 'concert', 'live', 'fest',
];

function isNightlife(name: string, classification = ''): boolean {
  const text = `${name} ${classification}`.toLowerCase();
  // All music events at night are relevant
  return NIGHTLIFE_KEYWORDS.some((kw) => text.includes(kw));
}

function extractTags(name: string, genre = ''): string[] {
  const t = `${name} ${genre}`.toLowerCase();
  const tags: string[] = ['nightlife'];
  if (t.includes('dj') || t.includes('electronic') || t.includes('edm') || t.includes('techno')) tags.push('edm');
  if (t.includes('bollywood')) tags.push('bollywood');
  if (t.includes('live') || t.includes('concert')) tags.push('live music');
  if (t.includes('ladies')) tags.push('ladies night');
  if (t.includes('rooftop')) tags.push('rooftop');
  return [...new Set(tags)];
}

export async function scrapeTicketmaster(): Promise<RawScrapedEvent[]> {
  const apiKey = process.env.TICKETMASTER_KEY;
  if (!apiKey) {
    console.log('Ticketmaster: TICKETMASTER_KEY not set, skipping');
    return [];
  }

  const events: RawScrapedEvent[] = [];

  try {
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const now = new Date();
    const nowIst = new Date(now.getTime() + IST_OFFSET);

    // Tonight 6 PM IST → +48h (to catch weekend events too)
    const startOfWindow = new Date(nowIst);
    startOfWindow.setHours(18, 0, 0, 0);
    const endOfWindow = new Date(nowIst.getTime() + 48 * 60 * 60 * 1000);

    const startUtc = new Date(startOfWindow.getTime() - IST_OFFSET);
    const endUtc = new Date(endOfWindow.getTime() - IST_OFFSET);

    // Format: "2024-01-15T00:00:00Z"
    const startStr = startUtc.toISOString().slice(0, 19) + 'Z';
    const endStr = endUtc.toISOString().slice(0, 19) + 'Z';

    const params = new URLSearchParams({
      apikey: apiKey,
      city: 'Mumbai',
      countryCode: 'IN',
      classificationId: MUSIC_CLASS_ID,
      startDateTime: startStr,
      endDateTime: endStr,
      size: '50',
      sort: 'date,asc',
    });

    const url = `${TM_API_BASE}/events.json?${params}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      console.warn(`Ticketmaster API → ${res.status}`);
      return events;
    }

    const json = await res.json() as {
      _embedded?: {
        events?: Array<{
          id: string;
          name: string;
          url: string;
          images?: Array<{ url: string; width: number }>;
          dates?: {
            start?: { localDate?: string; localTime?: string };
            end?: { localDate?: string; localTime?: string };
          };
          classifications?: Array<{
            segment?: { name?: string };
            genre?: { name?: string };
            subGenre?: { name?: string };
          }>;
          priceRanges?: Array<{ min?: number; max?: number; currency?: string }>;
          _embedded?: {
            venues?: Array<{
              name?: string;
              address?: { line1?: string };
              city?: { name?: string };
              state?: { name?: string };
              location?: { latitude?: string; longitude?: string };
            }>;
          };
          attractions?: Array<{ name?: string }>;
        }>;
      };
      page?: { totalElements?: number };
    };

    const tmEvents = json._embedded?.events ?? [];
    console.log(`Ticketmaster: found ${json.page?.totalElements ?? 0} total, processing ${tmEvents.length}`);

    for (const ev of tmEvents) {
      const name = ev.name ?? '';
      const genre = ev.classifications?.[0]?.genre?.name ?? '';
      const subGenre = ev.classifications?.[0]?.subGenre?.name ?? '';
      const classification = `${genre} ${subGenre}`;

      if (!isNightlife(name, classification)) continue;

      const localDate = ev.dates?.start?.localDate;
      const localTime = ev.dates?.start?.localTime ?? '21:00:00';
      if (!localDate) continue;

      const startDate = new Date(`${localDate}T${localTime}`);
      if (isNaN(startDate.getTime())) continue;

      const endLocalDate = ev.dates?.end?.localDate;
      const endLocalTime = ev.dates?.end?.localTime;
      const endDate = endLocalDate && endLocalTime
        ? new Date(`${endLocalDate}T${endLocalTime}`)
        : null;

      // Best image: prefer widest
      const images = (ev.images ?? []).sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
      const imageUrl = images[0]?.url ?? null;

      // Price
      let priceText: string | null = null;
      const prices = ev.priceRanges ?? [];
      if (prices.length > 0) {
        const min = prices[0].min;
        const max = prices[0].max;
        if (min === 0) priceText = 'Free';
        else if (min && max && min !== max) priceText = `₹${Math.round(min)}–₹${Math.round(max)}`;
        else if (min) priceText = `₹${Math.round(min)}`;
      }

      // Venue
      const venue = ev._embedded?.venues?.[0];
      const venueName = venue?.name ?? '';
      const rawAddress = venue?.address?.line1 ?? null;

      // Performers
      const performers = (ev.attractions ?? []).map((a) => a.name ?? '').filter(Boolean);

      events.push({
        source: 'ticketmaster',
        title: name,
        rawVenueName: venueName,
        rawAddress,
        city: 'Mumbai',
        locality: null,
        dateText: startDate.toDateString(),
        startTimeText: localTime.slice(0, 5),
        endTimeText: endDate ? endDate.toTimeString().slice(0, 5) : null,
        priceText,
        imageUrl,
        url: ev.url ?? `https://www.ticketmaster.in/event/${ev.id}`,
        tags: extractTags(name, classification),
        performers,
        scrapedAt: new Date(),
      });
    }

    console.log(`Ticketmaster: ${events.length} nightlife events`);
  } catch (err) {
    console.warn('Ticketmaster scrape error:', err);
  }

  return events;
}
