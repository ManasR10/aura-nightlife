/**
 * BookMyShow scraper — nightlife events in Mumbai.
 *
 * Strategy (in order):
 *   1. Mobile app API  — different CDN from web, sometimes not IP-blocked
 *   2. Featured events — BMS homepage widget API used for embedding
 *   3. HTML listing    — public explore pages (often 403 from GCP, but kept as fallback)
 *
 * If all return 0, this source is effectively blocked from GCP.
 * Use a residential proxy or the Eventbrite/Ticketmaster APIs instead.
 */
import type { RawScrapedEvent } from '../types';

// BMS mobile app API base (used by iOS/Android apps — different CDN)
const BMS_APP_API = 'https://in.bookmyshow.com';

// BMS listing pages (likely 403 from GCP, kept as last resort)
const BMS_LISTING_URLS = [
  'https://in.bookmyshow.com/explore/nightlife-mumbai',
  'https://in.bookmyshow.com/explore/events-mumbai',
];

const MOBILE_HEADERS = {
  'User-Agent': 'BookMyShow/11.5.0 (iPhone; iOS 17.0; Scale/3.00)',
  Accept: 'application/json',
  'Accept-Language': 'en-IN',
  'X-Region': 'MUMBAI',
  'X-Entity': 'MT',
  Referer: 'https://in.bookmyshow.com/',
};

const WEB_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
};

const NIGHTLIFE_KEYWORDS = [
  'night', 'dj', 'party', 'club', 'bar', 'lounge', 'music',
  'bollywood', 'edm', 'techno', 'ladies', 'open bar', 'rave',
  'house', 'electronic', 'concert', 'gig',
];

function isNightlifeEvent(title: string, category = ''): boolean {
  const text = `${title} ${category}`.toLowerCase();
  return NIGHTLIFE_KEYWORDS.some((kw) => text.includes(kw));
}

function extractTags(title: string): string[] {
  const t = title.toLowerCase();
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

function extractPrice(offers: unknown): string | null {
  if (!offers || typeof offers !== 'object') return null;
  const o = offers as Record<string, unknown>;
  if (o['price'] === 0) return 'Free';
  if (o['price']) return `₹${o['price']}`;
  if (o['lowPrice'] && o['highPrice']) return `₹${o['lowPrice']}–₹${o['highPrice']}`;
  if (o['lowPrice']) return `₹${o['lowPrice']}`;
  return null;
}

export async function scrapeBookMyShow(): Promise<RawScrapedEvent[]> {
  // Try mobile/app API first — different infrastructure from web
  const appEvents = await fetchBmsAppApi();
  if (appEvents.length > 0) return appEvents;

  // Fall back to HTML listing pages
  const htmlEvents = await fetchBmsHtmlPages();
  return htmlEvents;
}

async function fetchBmsAppApi(): Promise<RawScrapedEvent[]> {
  const events: RawScrapedEvent[] = [];

  // BMS internal API paths used by their mobile apps
  const apiCandidates = [
    // Events listing — mobile API v1
    `${BMS_APP_API}/api/booking/v2/cities/MUMBAI/events?event-type=MT,NT&page-size=40`,
    // Featured/recommended events
    `${BMS_APP_API}/api/recommend/v1/events?city=MUMBAI&event-type=MT,NT&page-size=40`,
    // Explore API
    `${BMS_APP_API}/api/v1/explore?city=MUMBAI&type=nightlife&size=40`,
    // Events search
    `${BMS_APP_API}/api/v2/events/search?query=nightlife&city=MUMBAI&size=40`,
  ];

  for (const url of apiCandidates) {
    try {
      const res = await fetch(url, { headers: MOBILE_HEADERS });
      if (!res.ok) {
        console.log(`BMS app API ${url} → ${res.status}`);
        continue;
      }
      const text = await res.text();
      let json: unknown;
      try { json = JSON.parse(text); } catch { continue; }

      const found = extractFromBmsJson(json);
      if (found.length > 0) {
        console.log(`BMS app API success ${url}: ${found.length} events`);
        events.push(...found);
        break;
      }
    } catch (err) {
      console.log(`BMS app API ${url} error: ${(err as Error).message}`);
    }
  }

  return events;
}

function extractFromBmsJson(json: unknown): RawScrapedEvent[] {
  const events: RawScrapedEvent[] = [];
  if (!json || typeof json !== 'object') return events;

  const root = json as Record<string, unknown>;
  // Try common BMS JSON shapes
  const list = Array.isArray(root['BookMyShow'])
    ? root['BookMyShow']
    : Array.isArray(root['EventsData'])
    ? root['EventsData']
    : Array.isArray(root['events'])
    ? root['events']
    : Array.isArray(root['data'])
    ? root['data']
    : Array.isArray(json)
    ? json as unknown[]
    : null;

  if (!list) return findEventsInObject(json);

  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const ev = item as Record<string, unknown>;
    const title = String(ev['EventTitle'] ?? ev['eventName'] ?? ev['name'] ?? '');
    if (!title || !isNightlifeEvent(title, String(ev['EventCategory'] ?? ev['category'] ?? ''))) continue;

    const rawDate = ev['EventDate'] ?? ev['startDate'] ?? ev['date'];
    if (!rawDate) continue;
    const startDate = new Date(String(rawDate));
    if (isNaN(startDate.getTime())) continue;

    events.push({
      source: 'bookmyshow',
      title,
      rawVenueName: String(ev['VenueName'] ?? ev['venueName'] ?? ev['venue'] ?? ''),
      rawAddress: ev['VenueAddress'] ? String(ev['VenueAddress']) : null,
      city: 'Mumbai',
      locality: null,
      dateText: startDate.toDateString(),
      startTimeText: ev['EventStartTime'] ? String(ev['EventStartTime']) : startDate.toTimeString().slice(0, 5),
      endTimeText: ev['EventEndTime'] ? String(ev['EventEndTime']) : null,
      priceText: ev['MinTicketPrice']
        ? (ev['MinTicketPrice'] === 0 ? 'Free' : `₹${ev['MinTicketPrice']}`)
        : null,
      imageUrl: ev['EventImageUrl'] ?? ev['ImageURL'] ?? ev['imageUrl'] ? String(ev['EventImageUrl'] ?? ev['ImageURL'] ?? ev['imageUrl']) : null,
      url: ev['EventUrl'] ?? ev['Url'] ?? ev['url']
        ? `https://in.bookmyshow.com${String(ev['EventUrl'] ?? ev['Url'] ?? ev['url'])}`
        : 'https://in.bookmyshow.com',
      tags: extractTags(title),
      performers: [],
      scrapedAt: new Date(),
    });
  }

  return events;
}

async function fetchBmsHtmlPages(): Promise<RawScrapedEvent[]> {
  const events: RawScrapedEvent[] = [];

  for (const url of BMS_LISTING_URLS) {
    try {
      const res = await fetch(url, { headers: WEB_HEADERS });
      if (!res.ok) {
        console.warn(`BMS HTML ${url} → ${res.status}`);
        continue;
      }

      const html = await res.text();
      console.log(`BMS HTML ${url} → ${res.status}, length=${html.length}`);

      // __NEXT_DATA__ (BMS uses Next.js)
      const nextDataMatch = /__NEXT_DATA__\s*=\s*({[\s\S]*?})<\/script>/i.exec(html);
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]) as Record<string, unknown>;
          const found = findEventsInObject(nextData);
          console.log(`BMS __NEXT_DATA__ from ${url}: ${found.length} events`);
          events.push(...found);
        } catch { /* skip */ }
      }

      // JSON-LD
      const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
      let match: RegExpExecArray | null;
      while ((match = jsonLdRegex.exec(html)) !== null) {
        try {
          const schema = JSON.parse(match[1].trim());
          const items = Array.isArray(schema) ? schema : [schema];
          for (const item of items) {
            if (!item || typeof item !== 'object') continue;
            const ev = item as Record<string, unknown>;
            if (ev['@type'] !== 'Event') continue;

            const title = String(ev['name'] ?? '');
            if (!title || !isNightlifeEvent(title)) continue;
            const startDate = ev['startDate'] ? new Date(String(ev['startDate'])) : null;
            if (!startDate || isNaN(startDate.getTime())) continue;

            const location = ev['location'] as Record<string, unknown> | undefined;
            const address = location?.['address'] as Record<string, unknown> | undefined;
            const image = Array.isArray(ev['image']) ? String(ev['image'][0]) : ev['image'] ? String(ev['image']) : null;
            const eventUrl = String(ev['url'] ?? url);
            if (events.some((e) => e.url === eventUrl)) continue;

            events.push({
              source: 'bookmyshow',
              title,
              rawVenueName: String(location?.['name'] ?? ''),
              rawAddress: String(address?.['streetAddress'] ?? address?.['name'] ?? '') || null,
              city: 'Mumbai',
              locality: String(address?.['addressLocality'] ?? ''),
              dateText: startDate.toDateString(),
              startTimeText: startDate.toTimeString().slice(0, 5),
              endTimeText: ev['endDate'] ? new Date(String(ev['endDate'])).toTimeString().slice(0, 5) : null,
              priceText: extractPrice(ev['offers']),
              imageUrl: image,
              url: eventUrl,
              tags: extractTags(title),
              performers: extractPerformers(ev['performer']),
              scrapedAt: new Date(),
            });
          }
        } catch { /* skip */ }
      }
    } catch (err) {
      console.warn(`BMS HTML error for ${url}:`, err);
    }
  }

  // Dedupe
  const seen = new Set<string>();
  return events.filter((e) => {
    const key = `${e.title}-${e.dateText}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractPerformers(performer: unknown): string[] {
  if (!performer) return [];
  const items = Array.isArray(performer) ? performer : [performer];
  return items
    .map((p) => typeof p === 'object' && p ? String((p as Record<string, unknown>)['name'] ?? '') : String(p))
    .filter(Boolean);
}

function findEventsInObject(obj: unknown, depth = 0): RawScrapedEvent[] {
  if (depth > 8 || !obj || typeof obj !== 'object') return [];
  const events: RawScrapedEvent[] = [];

  if (Array.isArray(obj)) {
    for (const item of obj) events.push(...findEventsInObject(item, depth + 1));
    return events;
  }

  const rec = obj as Record<string, unknown>;

  if (rec['EventTitle'] && rec['VenueName'] && rec['EventDate']) {
    const title = String(rec['EventTitle']);
    if (isNightlifeEvent(title, String(rec['EventCategory'] ?? ''))) {
      const startDate = new Date(String(rec['EventDate']));
      if (!isNaN(startDate.getTime())) {
        events.push({
          source: 'bookmyshow', title,
          rawVenueName: String(rec['VenueName']),
          rawAddress: rec['VenueAddress'] ? String(rec['VenueAddress']) : null,
          city: 'Mumbai', locality: null,
          dateText: startDate.toDateString(),
          startTimeText: rec['EventStartTime'] ? String(rec['EventStartTime']) : null,
          endTimeText: rec['EventEndTime'] ? String(rec['EventEndTime']) : null,
          priceText: rec['MinTicketPrice'] ? (rec['MinTicketPrice'] === 0 ? 'Free' : `₹${rec['MinTicketPrice']}`) : null,
          imageUrl: rec['ImageURL'] ? String(rec['ImageURL']) : null,
          url: rec['Url'] ? `https://in.bookmyshow.com${rec['Url']}` : 'https://in.bookmyshow.com',
          tags: extractTags(title),
          performers: [],
          scrapedAt: new Date(),
        });
        return events;
      }
    }
    return events;
  }

  for (const val of Object.values(rec)) events.push(...findEventsInObject(val, depth + 1));
  return events;
}
