/**
 * scrapeTonightEvents — scheduled Cloud Function.
 *
 * Priority order (per product plan):
 *   Layer 1 (primary):   BookMyShow, District
 *   Layer 2 (official):  Eventbrite API, Ticketmaster Discovery API
 *   Layer 3 (fallback):  Insider, Timeout
 *
 * Pipeline:
 *   Scrape → save raw → normalize → dedupe → match venue → publish → expire old
 *
 * Schedule:
 *   Every 60 min normally; high-frequency window (Fri/Sat/Sun ≥16:00 IST) already
 *   at 60 min — upgrade to 30 min via Cloud Scheduler if needed post-launch.
 *
 * Secrets required:
 *   PLACES_API_KEY       — Google Places API (venue matching)
 *   EVENTBRITE_TOKEN     — Eventbrite API (optional, graceful skip if missing)
 *   TICKETMASTER_KEY     — Ticketmaster Discovery API (optional, graceful skip)
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { scrapeBookMyShow }   from '../scrapers/bookmyshow';
import { scrapeDistrict }     from '../scrapers/district';
import { scrapeEventbrite }   from '../scrapers/eventbrite';
import { scrapeTicketmaster } from '../scrapers/ticketmaster';
import { scrapeInsider }      from '../scrapers/insider';
import { scrapeTimeout }      from '../scrapers/timeout';
import { normalizeEvent }     from '../pipeline/normalizeEvent';
import { dedupeEvents }       from '../pipeline/dedupeEvents';
import { matchVenue }         from '../pipeline/matchVenue';
import { saveRawEvents, publishEvents, expireEndedEvents } from '../pipeline/publishEvents';
import type { NormalizedEvent } from '../pipeline/normalizeEvent';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function nowIst(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}

function isHighFrequencyWindow(): boolean {
  const ist = nowIst();
  const hour = ist.getHours();
  const day = ist.getDay(); // 0=Sun, 5=Fri, 6=Sat
  return hour >= 16 && (day === 5 || day === 6 || day === 0);
}

export const scrapeTonightEvents = onSchedule(
  {
    schedule: 'every 60 minutes',
    timeZone: 'Asia/Kolkata',
    region: 'asia-south1',
    secrets: ['PLACES_API_KEY'],
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async () => {
    const isHighFreq = isHighFrequencyWindow();
    console.log(`scrapeTonightEvents started. highFreq=${isHighFreq}`);

    const apiKey = process.env.PLACES_API_KEY;
    if (!apiKey) {
      console.error('PLACES_API_KEY not set');
      return;
    }

    // ── 1. Scrape all sources in parallel ───────────────────────────────────
    // Primary sources: BMS + District
    // Official APIs: Eventbrite + Ticketmaster (graceful skip if no token)
    // Fallback: Insider + Timeout
    const [bmsRaw, districtRaw, eventbriteRaw, ticketmasterRaw, insiderRaw, timeoutRaw] =
      await Promise.allSettled([
        scrapeBookMyShow(),
        scrapeDistrict(),
        scrapeEventbrite(),
        scrapeTicketmaster(),
        scrapeInsider(),
        scrapeTimeout(),
      ]);

    const bmsEvents         = bmsRaw.status         === 'fulfilled' ? bmsRaw.value         : [];
    const districtEvents    = districtRaw.status    === 'fulfilled' ? districtRaw.value    : [];
    const eventbriteEvents  = eventbriteRaw.status  === 'fulfilled' ? eventbriteRaw.value  : [];
    const ticketmasterEvents = ticketmasterRaw.status === 'fulfilled' ? ticketmasterRaw.value : [];
    const insiderEvents     = insiderRaw.status     === 'fulfilled' ? insiderRaw.value     : [];
    const timeoutEvents     = timeoutRaw.status     === 'fulfilled' ? timeoutRaw.value     : [];

    console.log(
      `Scraped: BMS=${bmsEvents.length}, District=${districtEvents.length}, ` +
      `Eventbrite=${eventbriteEvents.length}, Ticketmaster=${ticketmasterEvents.length}, ` +
      `Insider=${insiderEvents.length}, Timeout=${timeoutEvents.length}`,
    );

    // Save raw payloads for debugging
    await Promise.allSettled([
      saveRawEvents('bookmyshow',   bmsEvents,         bmsRaw.status         === 'rejected' ? String(bmsRaw.reason)         : null),
      saveRawEvents('district',     districtEvents,    districtRaw.status    === 'rejected' ? String(districtRaw.reason)    : null),
      saveRawEvents('insider',      insiderEvents,     insiderRaw.status     === 'rejected' ? String(insiderRaw.reason)     : null),
      saveRawEvents('timeout',      timeoutEvents,     timeoutRaw.status     === 'rejected' ? String(timeoutRaw.reason)     : null),
    ]);

    // ── 2. Normalize ────────────────────────────────────────────────────────
    const allRaw = [
      ...bmsEvents,
      ...districtEvents,
      ...eventbriteEvents,
      ...ticketmasterEvents,
      ...insiderEvents,
      ...timeoutEvents,
    ];

    const normalized: NormalizedEvent[] = [];
    for (const raw of allRaw) {
      const n = normalizeEvent(raw);
      if (n) normalized.push(n);
    }
    console.log(`Normalized: ${normalized.length}`);

    // ── 3. Deduplicate ──────────────────────────────────────────────────────
    const deduped = dedupeEvents(normalized);
    console.log(`After dedupe: ${deduped.length}`);

    // ── 4. Match venues (concurrency 5) ─────────────────────────────────────
    const CONCURRENCY = 5;
    const results: Array<{
      normalized: NormalizedEvent;
      venueId: string | null;
      confidenceScore: number;
    }> = [];

    for (let i = 0; i < deduped.length; i += CONCURRENCY) {
      const batch = deduped.slice(i, i + CONCURRENCY);
      const matched = await Promise.all(
        batch.map(async (event) => {
          const match = await matchVenue(event, apiKey).catch((err) => {
            console.warn(`matchVenue failed for "${event.title}":`, err);
            return { venueId: null, confidenceScore: 0 };
          });
          return { normalized: event, ...match };
        }),
      );
      results.push(...matched);
    }

    const matchedCount = results.filter((r) => r.venueId !== null).length;
    console.log(`Matched: ${matchedCount}/${results.length}`);

    // ── 5. Publish to Firestore ─────────────────────────────────────────────
    const { written } = await publishEvents(results);
    console.log(`Published: ${written} events`);

    // ── 6. Expire old ended events ──────────────────────────────────────────
    const expired = await expireEndedEvents();
    console.log(`Expired: ${expired} ended events`);
  },
);
