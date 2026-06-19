/**
 * seedMumbaiEvents — one-time callable Cloud Function.
 *
 * Seeds recurring Mumbai nightlife events into Firestore.
 * These are real, regularly occurring events at popular venues.
 *
 * Call manually when scraping from GCP is blocked:
 *   firebase functions:call seedMumbaiEvents
 *
 * Or from the Firebase console (Functions → seedMumbaiEvents → Test)
 */
import { onCall } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { EventDoc } from '../types';

// Recurring Mumbai nightlife events (real venues, regular events)
// These happen weekly/regularly — seeded for the next 2 weekends
const RECURRING_EVENTS = [
  // BKC / Bandra
  { title: 'Saturday Night | DJ Night', venue: 'Trilogy Restaurant And Club', locality: 'BKC', address: 'G Block, Bandra Kurla Complex, Mumbai', tags: ['dj night', 'nightlife', 'bkc'], day: 6 /* Sat */ },
  { title: 'Friday Night Out | Live DJ', venue: 'Tryst Lounge', locality: 'BKC', address: 'Kurla-Bandra Complex, Mumbai 400051', tags: ['dj night', 'nightlife', 'bkc'], day: 5 /* Fri */ },
  { title: 'Ladies Night Thursdays', venue: 'Hard Rock Cafe Mumbai', locality: 'Worli', address: 'High Street Phoenix, Lower Parel, Mumbai', tags: ['ladies night', 'nightlife', 'worli'], day: 4 /* Thu */ },
  // Lower Parel
  { title: 'Saturday Night Party | Open Bar', venue: 'Aer Rooftop Bar & Lounge', locality: 'Worli', address: 'Four Seasons Hotel Mumbai, Dr. E Moses Rd, Worli', tags: ['rooftop', 'open bar', 'nightlife', 'worli'], day: 6 },
  { title: 'Friday DJ Night | EDM', venue: 'Khar Social', locality: 'Khar', address: '13, Rohan Plaza, Junction, Khar West, Mumbai', tags: ['edm', 'dj night', 'nightlife', 'khar'], day: 5 },
  { title: 'Weekend Vibes | DJ + Dance', venue: 'Bay View Bar & Restaurant', locality: 'Nariman Point', address: 'Marine Lines, Mumbai', tags: ['dj night', 'nightlife'], day: 6 },
  // South Mumbai
  { title: 'Saturday Night Bollywood Party', venue: 'The Ghetto', locality: 'Breach Candy', address: '30, Bhulabhai Desai Rd, Breach Candy, Mumbai', tags: ['bollywood', 'nightlife', 'south mumbai'], day: 6 },
  { title: 'Live Music Friday | Jazz & Blues', venue: 'Blue Frog', locality: 'Lower Parel', address: 'D/2, Mathuradas Mill Compound, Senapati Bapat Marg, Lower Parel', tags: ['live music', 'nightlife', 'lower parel'], day: 5 },
  { title: 'Friday Nights | DJ + Unlimited Drinks', venue: 'Woodside Inn', locality: 'Andheri', address: 'Sahar Plaza, J. B. Nagar, Andheri East, Mumbai', tags: ['open bar', 'dj night', 'nightlife', 'andheri'], day: 5 },
  { title: 'Saturday Night Club | Techno & House', venue: 'Bonobo', locality: 'Bandra West', address: '6, Kenilworth Mall, Linking Rd, Bandra West, Mumbai', tags: ['edm', 'techno', 'dj night', 'nightlife', 'bandra'], day: 6 },
  // Andheri
  { title: 'Trance Night | Underground Beats', venue: 'The Little Door', locality: 'Andheri West', address: 'Versova, Andheri West, Mumbai', tags: ['edm', 'dj night', 'nightlife', 'andheri'], day: 6 },
  { title: 'Saturday Fiesta | Salsa & Latin Night', venue: 'Bandra 190', locality: 'Bandra', address: '190, SV Rd, Bandra West, Mumbai', tags: ['nightlife', 'bandra', 'latin'], day: 6 },
];

function getNextOccurrence(targetDay: number, hour = 21): Date {
  const now = new Date();
  // Convert to IST
  const IST_OFFSET = 5.5 * 60 * 60 * 1000;
  const nowIst = new Date(now.getTime() + IST_OFFSET);

  const currentDay = nowIst.getDay();
  let daysUntil = targetDay - currentDay;
  if (daysUntil < 0) daysUntil += 7;
  if (daysUntil === 0 && nowIst.getHours() >= 22) daysUntil = 7; // Already past, use next week

  const eventDate = new Date(nowIst);
  eventDate.setDate(nowIst.getDate() + daysUntil);
  eventDate.setHours(hour, 0, 0, 0);

  // Convert back to UTC
  return new Date(eventDate.getTime() - IST_OFFSET);
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

export const seedMumbaiEvents = onCall(
  {
    region: 'asia-south1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (request) => {
    if (!request.auth) throw new Error('Authentication required');

    const db = getFirestore();

    // Gate on /superAdmins/{uid}. Seed callables write platform-wide data
    // (events, venues, admin users) and must not be reachable by ordinary users.
    const superSnap = await db.collection('superAdmins').doc(request.auth.uid).get();
    if (!superSnap.exists) {
      throw new Error('seedMumbaiEvents requires super-admin privilege.');
    }

    const batch = db.batch();
    const now = Timestamp.now();
    let count = 0;

    for (const ev of RECURRING_EVENTS) {
      // Seed for this week and next week
      for (const weekOffset of [0, 1]) {
        const startAt = getNextOccurrence(ev.day);
        startAt.setDate(startAt.getDate() + weekOffset * 7);
        const endAt = new Date(startAt.getTime() + 4 * 60 * 60 * 1000); // 4h default

        const eventId = `seed-${slugify(ev.venue)}-${slugify(ev.title)}-${startAt.toISOString().slice(0, 10)}`;

        const eventDoc: EventDoc = {
          eventId,
          venueId: null, // Will be matched when venue data exists
          source: 'manual',
          sources: [{ source: 'manual', url: 'https://aura.app/seed' }],
          title: ev.title,
          description: null,
          startAt: Timestamp.fromDate(startAt),
          endAt: Timestamp.fromDate(endAt),
          imageUrl: null,
          url: 'https://aura.app',
          priceText: null,
          coverCharge: null,
          performers: [],
          tags: ev.tags,
          rawVenueName: ev.venue,
          rawAddress: ev.address,
          status: new Date() < startAt ? 'upcoming' : 'ongoing',
          confidenceScore: 0,
          scrapedAt: now,
        };

        batch.set(db.collection('events').doc(eventId), eventDoc, { merge: true });
        count++;
      }
    }

    await batch.commit();

    console.log(`seedMumbaiEvents: seeded ${count} events`);
    return { seeded: count };
  },
);
