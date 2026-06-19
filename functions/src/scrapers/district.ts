/**
 * District (district.in) scraper — nightlife events in Mumbai.
 *
 * District is a Mumbai-focused event discovery platform with structured
 * event cards (date/time, venue, city, price). Uses Next.js — primary
 * extraction is from __NEXT_DATA__ JSON embedded in HTML.
 *
 * URL patterns tried:
 *   https://district.in/events/mumbai
 *   https://district.in/mumbai
 *   https://www.district.in/events/mumbai
 */
import type { RawScrapedEvent } from '../types';

const DISTRICT_URLS = [
  'https://district.in/events/mumbai',
  'https://district.in/mumbai',
  'https://district.in/e/mumbai',
  'https://www.district.in/events/mumbai',
  'https://district.in/events?city=mumbai',
  'https://district.in/events?city=Mumbai',
];

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  Referer: 'https://www.google.com/',
};

const NIGHTLIFE_KEYWORDS = [
  'night', 'dj', 'party', 'club', 'bar', 'lounge', 'music',
  'bollywood', 'edm', 'techno', 'ladies', 'open bar', 'gig',
  'rave', 'house', 'electronic', 'concert', 'live',
];

function isNightlife(title: string, description = '', category = ''): boolean {
  const text = `${title} ${description} ${category}`.toLowerCase();
  return NIGHTLIFE_KEYWORDS.some((kw) => text.includes(kw));
}

function extractTags(title: string, desc = '', cat = ''): string[] {
  const t = `${title} ${desc} ${cat}`.toLowerCase();
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

// District API candidates — discovered by scanning their JS bundles
const DISTRICT_API_CANDIDATES = [
  // Internal API (from JS bundle analysis)
  'https://district.in/api/events?city=mumbai&limit=50',
  'https://district.in/api/v1/events?city=mumbai&limit=50',
  'https://district.in/api/v2/events?city=mumbai&limit=50',
  // GraphQL (common pattern)
  // Tried via POST below
];

const API_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, */*',
  Origin: 'https://district.in',
  Referer: 'https://district.in/',
};

export async function scrapeDistrict(): Promise<RawScrapedEvent[]> {
  const events: RawScrapedEvent[] = [];

  // Try API endpoints first
  for (const url of DISTRICT_API_CANDIDATES) {
    try {
      const res = await fetch(url, { headers: API_HEADERS });
      if (!res.ok) { console.log(`District API ${url} → ${res.status}`); continue; }
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        const found = findDistrictEvents(json, url);
        if (found.length > 0) {
          console.log(`District API success ${url}: ${found.length} events`);
          events.push(...found);
          return events;
        }
      } catch { /* not JSON */ }
    } catch (err) {
      console.log(`District API ${url} error: ${(err as Error).message}`);
    }
  }

  const triedUrls = new Set<string>();
  for (const url of DISTRICT_URLS) {
    if (events.length >= 20) break; // enough from this source
    try {
      const res = await fetch(url, { headers: HEADERS });
      console.log(`District ${url} → ${res.status}`);
      if (!res.ok) continue;

      const html = await res.text();
      triedUrls.add(url);

      // Debug: understand page structure
      const hasNextData  = /__NEXT_DATA__/.test(html);
      const hasNuxt      = /__NUXT__/.test(html);
      const hasReactRoot = /id="root"|id="app"/.test(html);
      const scriptCount  = (html.match(/<script/gi) ?? []).length;
      const firstJsonLdType = (() => {
        const m = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
        if (!m) return 'none';
        try { return (JSON.parse(m[1].trim()) as Record<string,unknown>)['@type']; } catch { return 'parse-error'; }
      })();
      console.log(`District ${url}: len=${html.length} __NEXT_DATA__=${hasNextData} nuxt=${hasNuxt} reactRoot=${hasReactRoot} scripts=${scriptCount} jsonLd=${firstJsonLdType}`);

      // Strategy A: Find window.* JSON assignments (covers many SPA patterns)
      const windowAssignRegex = /window\.(?:\w+)\s*=\s*({[\s\S]*?})(?:;|\s*(?:window\.|<\/script>))/g;
      let winMatch: RegExpExecArray | null;
      while ((winMatch = windowAssignRegex.exec(html)) !== null) {
        try {
          const obj = JSON.parse(winMatch[1]);
          const found = findDistrictEvents(obj, url);
          if (found.length > 0) {
            console.log(`District window.* assignment: ${found.length} events`);
            events.push(...found);
          }
        } catch { /* skip */ }
      }

      // Strategy B: Extract all JSON arrays from script tags (event lists are arrays)
      const scriptTagRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
      let scriptMatch: RegExpExecArray | null;
      while ((scriptMatch = scriptTagRegex.exec(html)) !== null) {
        const content = scriptMatch[1].trim();
        if (!content || content.length < 50) continue;
        // Look for JSON arrays that might be event lists
        const jsonArrayMatch = /\[{[\s\S]*?}\]/.exec(content);
        if (!jsonArrayMatch) continue;
        try {
          const arr = JSON.parse(jsonArrayMatch[0]);
          if (Array.isArray(arr) && arr.length > 0) {
            const found = findDistrictEvents(arr, url);
            if (found.length > 0) {
              console.log(`District script JSON array: ${found.length} events`);
              events.push(...found);
            }
          }
        } catch { /* skip */ }
      }

      // ── 1. __NEXT_DATA__ (primary for Next.js apps) ────────────────────────
      const nextDataMatch = /__NEXT_DATA__\s*=\s*({[\s\S]*?})<\/script>/i.exec(html);
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]) as Record<string, unknown>;
          const found = findDistrictEvents(nextData, url);
          console.log(`District __NEXT_DATA__ from ${url}: ${found.length} events`);
          events.push(...found);
          if (found.length > 0) break; // got data, stop trying URLs
        } catch (err) {
          console.warn(`District __NEXT_DATA__ parse error ${url}:`, (err as Error).message);
        }
      }

      // Strategy C: HTML event card extraction (for SSR apps)
      // Look for structured data in HTML: title near a date near a venue string
      // Extract href + title from event-like anchor tags
      const eventLinkRegex = /href="([^"]*\/event[^"]*)"[^>]*>([^<]{10,80})</gi;
      const eventLinks: Array<{url: string; title: string}> = [];
      let linkMatch: RegExpExecArray | null;
      while ((linkMatch = eventLinkRegex.exec(html)) !== null) {
        const eventUrl = linkMatch[1].startsWith('http') ? linkMatch[1] : `https://district.in${linkMatch[1]}`;
        const title = linkMatch[2].trim();
        if (title && isNightlife(title) && !eventLinks.some((e) => e.url === eventUrl)) {
          eventLinks.push({ url: eventUrl, title });
        }
      }
      if (eventLinks.length > 0) {
        console.log(`District HTML links: found ${eventLinks.length} event links`);
        // Add as stubs — we have title + URL, that's enough to show in the feed
        for (const link of eventLinks.slice(0, 15)) {
          events.push({
            source: 'district',
            title: link.title,
            rawVenueName: '',
            rawAddress: null,
            city: 'Mumbai',
            locality: null,
            dateText: new Date().toDateString(), // today (will normalize)
            startTimeText: '21:00',
            endTimeText: null,
            priceText: null,
            imageUrl: null,
            url: link.url,
            tags: extractTags(link.title),
            performers: [],
            scrapedAt: new Date(),
          });
        }
      }

      // ── 2. JSON-LD fallback ────────────────────────────────────────────────
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
            const description = String(ev['description'] ?? '');
            if (!title || !isNightlife(title, description)) continue;

            const startDate = ev['startDate'] ? new Date(String(ev['startDate'])) : null;
            if (!startDate || isNaN(startDate.getTime())) continue;
            if (startDate < new Date(Date.now() - 24 * 60 * 60 * 1000)) continue;

            const location = ev['location'] as Record<string, unknown> | undefined;
            const address = location?.['address'] as Record<string, unknown> | undefined;
            const image = Array.isArray(ev['image']) ? String(ev['image'][0]) : ev['image'] ? String(ev['image']) : null;
            const eventUrl = String(ev['url'] ?? url);
            if (events.some((e) => e.url === eventUrl)) continue;

            events.push({
              source: 'district',
              title,
              rawVenueName: String(location?.['name'] ?? ''),
              rawAddress: String(address?.['streetAddress'] ?? ''),
              city: 'Mumbai',
              locality: String(address?.['addressLocality'] ?? ''),
              dateText: startDate.toDateString(),
              startTimeText: startDate.toTimeString().slice(0, 5),
              endTimeText: ev['endDate'] ? new Date(String(ev['endDate'])).toTimeString().slice(0, 5) : null,
              priceText: extractDistrictPrice(ev['offers']),
              imageUrl: image,
              url: eventUrl,
              tags: extractTags(title, description),
              performers: extractPerformers(ev['performer']),
              scrapedAt: new Date(),
            });
          }
        } catch { /* skip */ }
      }
    } catch (err) {
      console.warn(`District scrape error for ${url}:`, (err as Error).message);
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

function extractDistrictPrice(offers: unknown): string | null {
  if (!offers) return null;
  const arr = Array.isArray(offers) ? offers : [offers];
  for (const o of arr) {
    if (!o || typeof o !== 'object') continue;
    const obj = o as Record<string, unknown>;
    if (obj['price'] === 0 || obj['price'] === '0') return 'Free';
    if (obj['price']) return `₹${obj['price']}`;
    if (obj['lowPrice'] && obj['highPrice']) return `₹${obj['lowPrice']}–₹${obj['highPrice']}`;
    if (obj['lowPrice']) return `₹${obj['lowPrice']}`;
    if (obj['minPrice']) return `₹${obj['minPrice']}`;
  }
  return null;
}

function extractPerformers(performer: unknown): string[] {
  if (!performer) return [];
  const items = Array.isArray(performer) ? performer : [performer];
  return items
    .map((p) => typeof p === 'object' && p ? String((p as Record<string, unknown>)['name'] ?? '') : String(p))
    .filter(Boolean);
}

// Recursively find District event objects inside __NEXT_DATA__
function findDistrictEvents(obj: unknown, sourceUrl: string, depth = 0): RawScrapedEvent[] {
  if (depth > 10 || !obj || typeof obj !== 'object') return [];
  const events: RawScrapedEvent[] = [];

  if (Array.isArray(obj)) {
    for (const item of obj) {
      events.push(...findDistrictEvents(item, sourceUrl, depth + 1));
    }
    return events;
  }

  const rec = obj as Record<string, unknown>;

  // District event shape — try several possible key combinations
  const titleVal = rec['title'] ?? rec['name'] ?? rec['eventName'] ?? rec['event_name'];
  const dateVal = rec['startDate'] ?? rec['date'] ?? rec['start_date'] ?? rec['eventDate'] ?? rec['event_date'] ?? rec['startTime'] ?? rec['start_time'];
  const urlVal = rec['url'] ?? rec['link'] ?? rec['slug'] ?? rec['permalink'];
  const venueVal = rec['venue'] ?? rec['location'] ?? rec['venueName'] ?? rec['venue_name'];
  const priceVal = rec['price'] ?? rec['ticket_price'] ?? rec['minPrice'] ?? rec['min_price'];
  const imageVal = rec['image'] ?? rec['cover_image'] ?? rec['thumbnail'] ?? rec['banner'];
  const catVal = rec['category'] ?? rec['type'] ?? rec['genre'] ?? '';
  const descVal = rec['description'] ?? rec['about'] ?? '';

  if (titleVal && dateVal) {
    const title = String(titleVal);
    const description = String(descVal ?? '');
    const category = String(catVal ?? '');

    if (isNightlife(title, description, category)) {
      const rawDate = dateVal;
      let startDate: Date | null = null;

      if (typeof rawDate === 'number') {
        // Unix timestamp (seconds or ms)
        startDate = rawDate > 1e10 ? new Date(rawDate) : new Date(rawDate * 1000);
      } else {
        startDate = new Date(String(rawDate));
      }

      if (startDate && !isNaN(startDate.getTime())) {
        const endRaw = rec['endDate'] ?? rec['end_date'] ?? rec['endTime'] ?? rec['end_time'];
        let endDate: Date | null = null;
        if (endRaw) {
          endDate = typeof endRaw === 'number'
            ? (endRaw > 1e10 ? new Date(endRaw) : new Date(endRaw * 1000))
            : new Date(String(endRaw));
          if (isNaN(endDate.getTime())) endDate = null;
        }

        // Venue extraction
        let venueName = '';
        let address: string | null = null;
        let locality: string | null = null;
        if (typeof venueVal === 'string') {
          venueName = venueVal;
        } else if (venueVal && typeof venueVal === 'object') {
          const v = venueVal as Record<string, unknown>;
          venueName = String(v['name'] ?? v['title'] ?? '');
          address = v['address'] ? String(v['address']) : null;
          locality = v['locality'] ?? v['area'] ?? v['neighborhood'] ? String(v['locality'] ?? v['area'] ?? v['neighborhood']) : null;
        }

        // Price
        let priceText: string | null = null;
        if (priceVal !== undefined && priceVal !== null) {
          const p = Number(priceVal);
          if (!isNaN(p)) priceText = p === 0 ? 'Free' : `₹${p}`;
          else priceText = String(priceVal);
        } else {
          priceText = extractDistrictPrice(rec['offers'] ?? rec['ticket'] ?? rec['tickets']);
        }

        // Image
        let imageUrl: string | null = null;
        if (imageVal) {
          imageUrl = typeof imageVal === 'string' ? imageVal :
            typeof imageVal === 'object' ? String((imageVal as Record<string, unknown>)['url'] ?? (imageVal as Record<string, unknown>)['src'] ?? '') : null;
        }

        // URL
        let eventUrl = sourceUrl;
        if (urlVal) {
          const u = String(urlVal);
          eventUrl = u.startsWith('http') ? u : `https://district.in${u.startsWith('/') ? '' : '/'}${u}`;
        } else if (rec['id'] ?? rec['_id']) {
          eventUrl = `https://district.in/events/${rec['id'] ?? rec['_id']}`;
        }

        events.push({
          source: 'district',
          title,
          rawVenueName: venueName,
          rawAddress: address,
          city: 'Mumbai',
          locality,
          dateText: startDate.toDateString(),
          startTimeText: startDate.toTimeString().slice(0, 5),
          endTimeText: endDate ? endDate.toTimeString().slice(0, 5) : null,
          priceText,
          imageUrl,
          url: eventUrl,
          tags: extractTags(title, description, category),
          performers: (() => {
            const artists = rec['artists'] ?? rec['performers'] ?? rec['lineup'];
            if (!artists) return [];
            const arr = Array.isArray(artists) ? artists : [artists];
            return arr.map((a) => typeof a === 'object' && a ? String((a as Record<string, unknown>)['name'] ?? '') : String(a)).filter(Boolean);
          })(),
          scrapedAt: new Date(),
        });

        return events; // don't recurse into this node
      }
    }
  }

  // Recurse
  for (const val of Object.values(rec)) {
    events.push(...findDistrictEvents(val, sourceUrl, depth + 1));
  }

  return events;
}
