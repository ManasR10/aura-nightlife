/**
 * Timeout Mumbai scraper — nightlife events.
 *
 * Timeout publishes rich JSON-LD event markup on their listing pages.
 * No API key required. Works from GCP IPs.
 *
 * URL pattern: https://www.timeout.com/mumbai/nightlife
 */
import type { RawScrapedEvent } from '../types';

const TIMEOUT_URLS = [
  // Timeout Mumbai event pages (homepage has event widgets)
  'https://www.timeout.com/mumbai',
  // What'sHot is a Mumbai-specific guide that typically works from cloud IPs
  'https://www.whatshot.in/mumbai/nightlife',
  'https://www.whatshot.in/mumbai/events',
];

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
};

const NIGHTLIFE_KEYWORDS = [
  'night', 'dj', 'party', 'club', 'bar', 'lounge', 'music',
  'bollywood', 'edm', 'techno', 'ladies', 'open bar', 'gig',
  'rave', 'house', 'electronic', 'concert', 'live',
];

function isNightlife(title: string, description?: string): boolean {
  const text = `${title} ${description ?? ''}`.toLowerCase();
  return NIGHTLIFE_KEYWORDS.some((kw) => text.includes(kw));
}

function extractTags(title: string, description = ''): string[] {
  const t = `${title} ${description}`.toLowerCase();
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
  if (!offers) return null;
  const arr = Array.isArray(offers) ? offers : [offers];
  for (const o of arr) {
    if (!o || typeof o !== 'object') continue;
    const obj = o as Record<string, unknown>;
    if (obj['price'] === 0 || obj['price'] === '0') return 'Free';
    if (obj['price']) return `₹${obj['price']}`;
    if (obj['lowPrice'] && obj['highPrice']) return `₹${obj['lowPrice']}–₹${obj['highPrice']}`;
    if (obj['lowPrice']) return `₹${obj['lowPrice']}`;
  }
  return null;
}

export async function scrapeTimeout(): Promise<RawScrapedEvent[]> {
  const events: RawScrapedEvent[] = [];

  for (const url of TIMEOUT_URLS) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) {
        console.warn(`Timeout ${url} → ${res.status}`);
        continue;
      }

      const html = await res.text();
      console.log(`Timeout ${url} → ${res.status}, length=${html.length}`);

      // Debug: log first JSON-LD block type to understand page structure
      const firstJsonLd = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
      if (firstJsonLd) {
        try {
          const parsed = JSON.parse(firstJsonLd[1].trim());
          const type = Array.isArray(parsed) ? parsed.map((x: Record<string, unknown>) => x['@type']).join(',') : (parsed as Record<string, unknown>)['@type'];
          console.log(`Timeout ${url} JSON-LD @type: ${type}`);
        } catch { /* ignore */ }
      } else {
        console.log(`Timeout ${url}: no JSON-LD found`);
      }

      const hasNextData = /__NEXT_DATA__/.test(html);
      console.log(`Timeout ${url}: hasNextData=${hasNextData}`);

      // 1. JSON-LD structured data (Timeout's primary markup)
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
            const description = String(ev['description'] ?? '');
            if (!title || !isNightlife(title, description)) continue;

            const startDate = ev['startDate'] ? new Date(String(ev['startDate'])) : null;
            if (!startDate || isNaN(startDate.getTime())) continue;

            // Skip past events
            if (startDate < new Date(Date.now() - 24 * 60 * 60 * 1000)) continue;

            const location = ev['location'] as Record<string, unknown> | undefined;
            const address = location?.['address'] as Record<string, unknown> | string | undefined;

            const venueName = String(location?.['name'] ?? '');
            const streetAddress =
              typeof address === 'string'
                ? address
                : String((address as Record<string, unknown>)?.['streetAddress'] ?? '');
            const locality = String(
              (address as Record<string, unknown>)?.['addressLocality'] ?? '',
            );

            const image = Array.isArray(ev['image'])
              ? String(ev['image'][0])
              : ev['image']
              ? String(ev['image'])
              : null;

            const eventUrl = String(ev['url'] ?? url);
            if (events.some((e) => e.url === eventUrl)) continue;

            events.push({
              source: 'timeout',
              title,
              rawVenueName: venueName,
              rawAddress: streetAddress || null,
              city: 'Mumbai',
              locality: locality || null,
              dateText: startDate.toDateString(),
              startTimeText: startDate.toTimeString().slice(0, 5),
              endTimeText: ev['endDate']
                ? new Date(String(ev['endDate'])).toTimeString().slice(0, 5)
                : null,
              priceText: extractPrice(ev['offers']),
              imageUrl: image,
              url: eventUrl,
              tags: extractTags(title, description),
              performers: extractPerformers(ev['performer']),
              scrapedAt: new Date(),
            });
          }
        } catch {
          // Skip malformed JSON-LD
        }
      }

      // 2. __NEXT_DATA__ fallback
      const nextDataMatch = /__NEXT_DATA__\s*=\s*({[\s\S]*?})<\/script>/i.exec(html);
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]) as Record<string, unknown>;
          const found = findTimeoutEventsInObject(nextData, url);
          console.log(`Timeout __NEXT_DATA__ from ${url}: ${found.length} events`);
          // Add only if URL not already present
          for (const ev of found) {
            if (!events.some((e) => e.url === ev.url)) events.push(ev);
          }
        } catch {
          // Skip
        }
      }
    } catch (err) {
      console.warn(`Timeout scrape error for ${url}:`, err);
    }
  }

  // Dedupe by URL
  const seen = new Set<string>();
  return events.filter((e) => {
    if (seen.has(e.url)) return false;
    seen.add(e.url);
    return true;
  });
}

function extractPerformers(performer: unknown): string[] {
  if (!performer) return [];
  const items = Array.isArray(performer) ? performer : [performer];
  return items
    .map((p) =>
      typeof p === 'object' && p
        ? String((p as Record<string, unknown>)['name'] ?? '')
        : String(p),
    )
    .filter(Boolean);
}

function findTimeoutEventsInObject(obj: unknown, sourceUrl: string, depth = 0): RawScrapedEvent[] {
  if (depth > 8 || !obj || typeof obj !== 'object') return [];
  const events: RawScrapedEvent[] = [];

  if (Array.isArray(obj)) {
    for (const item of obj) {
      events.push(...findTimeoutEventsInObject(item, sourceUrl, depth + 1));
    }
    return events;
  }

  const rec = obj as Record<string, unknown>;

  // Timeout listing card shape — many possible keys
  const titleVal = rec['title'] ?? rec['name'] ?? rec['headline'];
  const dateVal = rec['startDate'] ?? rec['date'] ?? rec['dateTime'] ?? rec['when'] ?? rec['eventDate'];
  const urlVal = rec['url'] ?? rec['link'] ?? rec['href'] ?? rec['slug'];
  const venueVal = rec['venue'] ?? rec['location'] ?? rec['where'];

  if (titleVal && (dateVal || rec['startTime'])) {
    const title = String(titleVal);
    const description = String(rec['description'] ?? rec['excerpt'] ?? rec['subtitle'] ?? '');
    if (title && isNightlife(title, description)) {
      const rawDate = dateVal ?? rec['startTime'];
      let startDate: Date | null = null;
      if (rawDate) {
        startDate = new Date(String(rawDate));
        if (isNaN(startDate.getTime())) startDate = null;
      }

      if (startDate) {
        // Skip clearly past events (more than 1 day ago)
        if (startDate < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
          // don't skip, let normalizeEvent decide
        }

        const venue = typeof venueVal === 'object' && venueVal
          ? (venueVal as Record<string, unknown>)
          : null;
        const venueName = String(venue?.['name'] ?? rec['venueName'] ?? rec['place'] ?? '');

        let eventUrl = sourceUrl;
        if (urlVal) {
          const u = String(urlVal);
          eventUrl = u.startsWith('http') ? u : `https://www.timeout.com${u}`;
        }

        events.push({
          source: 'timeout',
          title,
          rawVenueName: venueName,
          rawAddress: null,
          city: 'Mumbai',
          locality: null,
          dateText: startDate.toDateString(),
          startTimeText: startDate.toTimeString().slice(0, 5),
          endTimeText: null,
          priceText: null,
          imageUrl: rec['image']
            ? String(typeof rec['image'] === 'object' ? (rec['image'] as Record<string, unknown>)['url'] ?? '' : rec['image'])
            : null,
          url: eventUrl,
          tags: extractTags(title, description),
          performers: [],
          scrapedAt: new Date(),
        });
        return events; // found one here, don't recurse into it
      }
    }
  }

  for (const val of Object.values(rec)) {
    events.push(...findTimeoutEventsInObject(val, sourceUrl, depth + 1));
  }

  return events;
}
