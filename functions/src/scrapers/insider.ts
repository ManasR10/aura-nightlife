/**
 * Insider.in scraper — nightlife events in Mumbai.
 *
 * Insider.in is a Next.js app. Their pages embed events in __NEXT_DATA__
 * JSON (same pattern as BMS). The listing API also has multiple possible
 * endpoints we try in sequence.
 */
import type { RawScrapedEvent } from '../types';

const INSIDER_BASE = 'https://www.insider.in';

// Insider changed their URL structure — /browse/ paths now 404.
// Current listing URLs (verified working format):
const INSIDER_LISTING_URLS = [
  'https://www.insider.in/nightlife-mumbai',
  'https://www.insider.in/music-gigs-mumbai',
  'https://www.insider.in/parties-mumbai',
  'https://insider.in/nightlife-mumbai',
  'https://insider.in/all-events-mumbai',
];

// API endpoints to try in order
// paytm.insider.in fails DNS from GCP; www.insider.in responds (with 404 on wrong paths)
const INSIDER_API_CANDIDATES = [
  `${INSIDER_BASE}/api/v1/event/list`,
  `${INSIDER_BASE}/api/v1/events/list`,
  `${INSIDER_BASE}/api/v1/events`,
  `${INSIDER_BASE}/api/events`,
  // Without www — sometimes on different routing
  'https://insider.in/api/v1/events',
  'https://insider.in/api/v1/event/list',
];

const DESKTOP_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
};

const API_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  Accept: 'application/json, */*',
  'Accept-Language': 'en-IN,en;q=0.9',
  Referer: 'https://www.insider.in/',
  Origin: 'https://www.insider.in',
};

const NIGHTLIFE_KEYWORDS = [
  'night', 'dj', 'party', 'club', 'bar', 'lounge', 'music',
  'bollywood', 'edm', 'techno', 'ladies', 'open bar', 'gig',
  'rave', 'house', 'electronic', 'concert',
];

function isNightlife(title: string, tags: string[] = []): boolean {
  const text = `${title} ${tags.join(' ')}`.toLowerCase();
  return NIGHTLIFE_KEYWORDS.some((kw) => text.includes(kw));
}

function extractTags(title: string, apiTags: string[] = []): string[] {
  const t = title.toLowerCase();
  const tags = [...apiTags, 'nightlife'];
  if (t.includes('ladies')) tags.push('ladies night');
  if (t.includes('dj') || t.includes('d.j')) tags.push('dj night');
  if (t.includes('bollywood')) tags.push('bollywood');
  if (t.includes('edm') || t.includes('techno') || t.includes('electronic')) tags.push('edm');
  if (t.includes('live music') || t.includes('live band') || t.includes('concert')) tags.push('live music');
  if (t.includes('open bar') || t.includes('unlimited')) tags.push('open bar');
  if (t.includes('rooftop')) tags.push('rooftop');
  return [...new Set(tags)];
}

function formatPrice(min?: number, max?: number): string | null {
  if (min == null) return null;
  if (min === 0) return 'Free';
  if (max != null && max !== min) return `₹${min}–₹${max}`;
  return `₹${min}`;
}

export async function scrapeInsider(): Promise<RawScrapedEvent[]> {
  const events: RawScrapedEvent[] = [];

  // Try the JSON API endpoints
  const apiEvents = await fetchInsiderApi();
  events.push(...apiEvents);

  // Always scrape HTML listing pages — __NEXT_DATA__ extraction works independently
  const htmlResults = await Promise.allSettled(
    INSIDER_LISTING_URLS.map((url) => scrapeInsiderHtmlPage(url)),
  );
  for (const result of htmlResults) {
    if (result.status === 'fulfilled') events.push(...result.value);
  }

  // Dedupe by URL
  const seen = new Set<string>();
  return events.filter((e) => {
    if (seen.has(e.url)) return false;
    seen.add(e.url);
    return true;
  });
}

async function fetchInsiderApi(): Promise<RawScrapedEvent[]> {
  const params = new URLSearchParams({
    city: 'mumbai',
    category: 'nightlife,music,parties',
    pageSize: '60',
  });

  for (const base of INSIDER_API_CANDIDATES) {
    try {
      const url = `${base}?${params}`;
      const res = await fetch(url, { headers: API_HEADERS });

      if (!res.ok) {
        console.log(`Insider API ${url} → ${res.status}`);
        continue;
      }

      const text = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        console.log(`Insider API ${url} → non-JSON response`);
        continue;
      }

      const events = extractFromInsiderApiJson(json);
      if (events.length > 0) {
        console.log(`Insider API success at ${url}: ${events.length} events`);
        return events;
      }
    } catch (err) {
      console.log(`Insider API ${base} error:`, (err as Error).message);
    }
  }

  console.warn('Insider: all API endpoints failed, relying on HTML scrape');
  return [];
}

function extractFromInsiderApiJson(json: unknown): RawScrapedEvent[] {
  const events: RawScrapedEvent[] = [];
  if (!json || typeof json !== 'object') return events;

  // Handle { data: [...] } shape
  const root = json as Record<string, unknown>;
  const list = Array.isArray(root['data'])
    ? root['data']
    : Array.isArray(root['events'])
    ? root['events']
    : Array.isArray(json)
    ? json
    : null;

  if (!list) return events;

  for (const ev of list) {
    if (!ev || typeof ev !== 'object') continue;
    const item = ev as Record<string, unknown>;
    const title = String(item['name'] ?? item['title'] ?? '');
    if (!title || !isNightlife(title, (item['tags'] as string[]) ?? [])) continue;

    const startUtc = item['start_utc'] ?? item['startAt'] ?? item['start_time'];
    const start = startUtc ? new Date(Number(startUtc) * 1000) : null;
    if (!start || isNaN(start.getTime())) continue;

    const endUtc = item['end_utc'] ?? item['endAt'] ?? item['end_time'];
    const end = endUtc ? new Date(Number(endUtc) * 1000) : null;

    const venue = item['venue'] as Record<string, unknown> | undefined;
    const slug = String(item['slug'] ?? '');
    const id = String(item['_id'] ?? item['id'] ?? '');

    events.push({
      source: 'insider',
      title,
      rawVenueName: String(venue?.['name'] ?? ''),
      rawAddress: venue?.['address'] ? String(venue['address']) : null,
      city: String(venue?.['city'] ?? 'Mumbai'),
      locality: venue?.['locality'] ? String(venue['locality']) : null,
      dateText: start.toDateString(),
      startTimeText: start.toTimeString().slice(0, 5),
      endTimeText: end ? end.toTimeString().slice(0, 5) : null,
      priceText: formatPrice(item['min_price'] as number | undefined, item['max_price'] as number | undefined),
      imageUrl: item['horizontal_cover_image'] ? String(item['horizontal_cover_image']) : null,
      url: slug
        ? `${INSIDER_BASE}/events/${slug}`
        : id
        ? `${INSIDER_BASE}/events/${id}`
        : INSIDER_BASE,
      tags: extractTags(title, (item['tags'] as string[]) ?? []),
      performers: Array.isArray(item['artists'])
        ? (item['artists'] as Array<Record<string, unknown>>).map((a) => String(a['name'] ?? '')).filter(Boolean)
        : [],
      scrapedAt: new Date(),
    });
  }

  return events;
}

async function scrapeInsiderHtmlPage(url: string): Promise<RawScrapedEvent[]> {
  const events: RawScrapedEvent[] = [];
  try {
    const res = await fetch(url, { headers: DESKTOP_HEADERS });
    if (!res.ok) {
      console.warn(`Insider HTML ${url} → ${res.status}`);
      return events;
    }

    const html = await res.text();

    // 1. Extract __NEXT_DATA__ (primary — Insider uses Next.js)
    const nextDataMatch = /__NEXT_DATA__\s*=\s*({[\s\S]*?})<\/script>/i.exec(html);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]) as Record<string, unknown>;
        const pageProps = (
          (nextData['props'] as Record<string, unknown>)?.['pageProps']
        ) as Record<string, unknown> | undefined;

        const found = findInsiderEventsInObject(pageProps ?? {});
        console.log(`Insider __NEXT_DATA__ from ${url}: ${found.length} events`);
        events.push(...found);
      } catch (err) {
        console.warn(`Insider __NEXT_DATA__ parse error for ${url}:`, (err as Error).message);
      }
    } else {
      console.log(`Insider: no __NEXT_DATA__ found on ${url}`);
    }

    // 2. JSON-LD fallback
    const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;

    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const schema = JSON.parse(match[1].trim());
        const items: unknown[] = Array.isArray(schema) ? schema : [schema];

        for (const item of items) {
          if (!item || typeof item !== 'object') continue;
          const ev = item as Record<string, unknown>;
          if (ev['@type'] !== 'Event') continue;

          const title = String(ev['name'] ?? '');
          if (!title || !isNightlife(title)) continue;

          const startDate = ev['startDate'] ? new Date(String(ev['startDate'])) : null;
          if (!startDate || isNaN(startDate.getTime())) continue;

          const location = ev['location'] as Record<string, unknown> | undefined;
          const address = location?.['address'] as Record<string, unknown> | undefined;

          const image = Array.isArray(ev['image'])
            ? String(ev['image'][0])
            : ev['image'] ? String(ev['image']) : null;

          const eventUrl = String(ev['url'] ?? url);
          if (events.some((e) => e.url === eventUrl)) continue; // skip if already found via __NEXT_DATA__

          events.push({
            source: 'insider',
            title,
            rawVenueName: String(location?.['name'] ?? ''),
            rawAddress: String(address?.['streetAddress'] ?? ''),
            city: 'Mumbai',
            locality: String(address?.['addressLocality'] ?? ''),
            dateText: startDate.toDateString(),
            startTimeText: startDate.toTimeString().slice(0, 5),
            endTimeText: ev['endDate']
              ? new Date(String(ev['endDate'])).toTimeString().slice(0, 5)
              : null,
            priceText: (() => {
              const o = ev['offers'] as Record<string, unknown> | undefined;
              if (!o) return null;
              if (o['price'] === 0) return 'Free';
              if (o['price']) return `₹${o['price']}`;
              if (o['lowPrice']) return `₹${o['lowPrice']}`;
              return null;
            })(),
            imageUrl: image,
            url: eventUrl,
            tags: extractTags(title),
            performers: [],
            scrapedAt: new Date(),
          });
        }
      } catch {
        // Skip malformed JSON-LD
      }
    }
  } catch (err) {
    console.warn(`Insider HTML scrape error for ${url}:`, err);
  }
  return events;
}

// Recursively search Insider's __NEXT_DATA__ for event-shaped objects
function findInsiderEventsInObject(obj: unknown, depth = 0): RawScrapedEvent[] {
  if (depth > 8 || !obj || typeof obj !== 'object') return [];
  const events: RawScrapedEvent[] = [];

  if (Array.isArray(obj)) {
    for (const item of obj) {
      events.push(...findInsiderEventsInObject(item, depth + 1));
    }
    return events;
  }

  const rec = obj as Record<string, unknown>;

  // Insider event shape: has name/title + slug/url + start_utc/startDate + venue
  const hasEventShape =
    (rec['name'] || rec['title']) &&
    (rec['slug'] || rec['url'] || rec['_id'] || rec['id']) &&
    (rec['start_utc'] || rec['startDate'] || rec['start_time'] || rec['startAt']);

  if (hasEventShape) {
    const title = String(rec['name'] ?? rec['title'] ?? '');
    const apiTags = Array.isArray(rec['tags']) ? (rec['tags'] as string[]) : [];
    if (title && isNightlife(title, apiTags)) {
      const rawStart = rec['start_utc'] ?? rec['start_time'] ?? rec['startAt'];
      const rawStartDate = rec['startDate'];

      let start: Date | null = null;
      if (rawStart) {
        // Numeric unix timestamp (seconds)
        const num = Number(rawStart);
        start = !isNaN(num) ? new Date(num * 1000) : null;
      }
      if (!start && rawStartDate) {
        start = new Date(String(rawStartDate));
      }
      if (!start || isNaN(start.getTime())) {
        // fallthrough to recurse
      } else {
        const rawEnd = rec['end_utc'] ?? rec['end_time'] ?? rec['endAt'] ?? rec['endDate'];
        let end: Date | null = null;
        if (rawEnd) {
          const num = Number(rawEnd);
          end = !isNaN(num) ? new Date(num * 1000) : new Date(String(rawEnd));
          if (isNaN(end.getTime())) end = null;
        }

        const venue = rec['venue'] as Record<string, unknown> | undefined;
        const slug = String(rec['slug'] ?? '');
        const id = String(rec['_id'] ?? rec['id'] ?? '');

        events.push({
          source: 'insider',
          title,
          rawVenueName: String(venue?.['name'] ?? rec['venueName'] ?? ''),
          rawAddress: venue?.['address'] ? String(venue['address']) : null,
          city: String(venue?.['city'] ?? 'Mumbai'),
          locality: venue?.['locality'] ? String(venue['locality']) : null,
          dateText: start.toDateString(),
          startTimeText: start.toTimeString().slice(0, 5),
          endTimeText: end ? end.toTimeString().slice(0, 5) : null,
          priceText: formatPrice(rec['min_price'] as number | undefined, rec['max_price'] as number | undefined),
          imageUrl: rec['horizontal_cover_image']
            ? String(rec['horizontal_cover_image'])
            : rec['image_url']
            ? String(rec['image_url'])
            : null,
          url: slug
            ? `${INSIDER_BASE}/events/${slug}`
            : id
            ? `${INSIDER_BASE}/events/${id}`
            : String(rec['url'] ?? INSIDER_BASE),
          tags: extractTags(title, apiTags),
          performers: Array.isArray(rec['artists'])
            ? (rec['artists'] as Array<Record<string, unknown>>)
                .map((a) => String(a['name'] ?? ''))
                .filter(Boolean)
            : [],
          scrapedAt: new Date(),
        });
        return events; // found one at this level, don't recurse into it
      }
    }
  }

  // Recurse into values
  for (const val of Object.values(rec)) {
    events.push(...findInsiderEventsInObject(val, depth + 1));
  }

  return events;
}
