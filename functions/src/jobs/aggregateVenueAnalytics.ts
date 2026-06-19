// Daily 1 AM IST rollup: reads yesterday's analyticsEvents, groups by venue, writes
// /venueAnalyticsDaily/{venueId}_{date}. Mondays also roll the week into
// /venueAnalyticsWeekly. Keeps the admin dashboard to single-doc reads instead of
// scanning raw events on every query.
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { VenueAnalyticsDailyDoc, VenueAnalyticsWeeklyDoc } from '../types';

const db = getFirestore();

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function nowIST(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}

function toISTDate(epochMs: number): string {
  const d = new Date(epochMs + IST_OFFSET_MS);
  return d.toISOString().slice(0, 10);
}


function emptyDay(venueId: string, date: string): VenueAnalyticsDailyDoc {
  return {
    venueId, date,
    impressions: 0, detailViews: 0, cardTaps: 0,
    directionsTaps: 0, callTaps: 0, websiteTaps: 0, instagramTaps: 0,
    saves: 0, videoViews: 0, videoCompletes: 0,
    signalSubmits: 0, videoUploads: 0, checkins: 0, rewardClaims: 0,
    uniqueUsers: 0,
    computedAt: Timestamp.now(),
  };
}

export const aggregateVenueAnalytics = onSchedule(
  {
    schedule:   'every day 01:00',
    timeZone:   'Asia/Kolkata',
    region:     'asia-south1',
    timeoutSeconds: 540,
    memory:     '512MiB',
  },
  async () => {
    const ist = nowIST();
    // Yesterday in IST
    const yesterdayMs = ist.getTime() - 24 * 60 * 60 * 1000;
    const date = toISTDate(yesterdayMs);
    console.log(`Aggregating analytics for date=${date}`);

    // 1. Query all events from yesterday
    const snap = await db
      .collection('analyticsEvents')
      .where('date', '==', date)
      .get();

    if (snap.empty) {
      console.log('No events for', date);
      return;
    }

    // 2. Group by venueId
    const byVenue = new Map<string, VenueAnalyticsDailyDoc>();
    const uniqueByVenue = new Map<string, Set<string>>();

    for (const doc of snap.docs) {
      const ev = doc.data() as { type: string; venueId: string | null; userId: string | null };
      if (!ev.venueId) continue;

      if (!byVenue.has(ev.venueId)) {
        byVenue.set(ev.venueId, emptyDay(ev.venueId, date));
        uniqueByVenue.set(ev.venueId, new Set());
      }
      const agg = byVenue.get(ev.venueId)!;
      const users = uniqueByVenue.get(ev.venueId)!;
      if (ev.userId) users.add(ev.userId);

      switch (ev.type) {
        case 'venue_impression':    agg.impressions++;     break;
        case 'venue_card_tap':      agg.cardTaps++;        break;
        case 'venue_detail_view':   agg.detailViews++;     break;
        case 'directions_tap':      agg.directionsTaps++;  break;
        case 'call_tap':            agg.callTaps++;        break;
        case 'website_tap':         agg.websiteTaps++;     break;
        case 'instagram_tap':       agg.instagramTaps++;   break;
        case 'venue_save':          agg.saves++;           break;
        case 'video_view':          agg.videoViews++;      break;
        case 'video_complete':      agg.videoCompletes++;  break;
        case 'signal_submit':       agg.signalSubmits++;   break;
        case 'video_upload':        agg.videoUploads++;    break;
        case 'checkin':             agg.checkins++;        break;
        case 'reward_claim':        agg.rewardClaims++;    break;
      }
    }

    // 3. Write daily docs in batch
    const batch = db.batch();
    for (const [venueId, agg] of byVenue) {
      agg.uniqueUsers  = uniqueByVenue.get(venueId)?.size ?? 0;
      agg.computedAt   = Timestamp.now();
      const docId      = `${venueId}_${date}`;
      batch.set(db.collection('venueAnalyticsDaily').doc(docId), agg, { merge: true });
    }
    await batch.commit();
    console.log(`Daily rollup complete: ${byVenue.size} venues`);

    // 4. Weekly rollup on Mondays
    const dayOfWeek = new Date(date + 'T00:00:00Z').getUTCDay();
    if (dayOfWeek !== 1) return; // only Monday

    const weekStart = date; // Monday = start of week we just closed
    console.log(`Running weekly rollup for week starting ${weekStart}`);

    // Collect the 7 daily docs for each venue
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const venueIds = [...byVenue.keys()];
    const weeklyBatch = db.batch();

    for (const venueId of venueIds) {
      const weekSnaps = await Promise.all(
        dates.map((d) =>
          db.collection('venueAnalyticsDaily').doc(`${venueId}_${d}`).get(),
        ),
      );

      const weekly: VenueAnalyticsWeeklyDoc = {
        venueId, weekStart,
        impressions: 0, detailViews: 0, cardTaps: 0,
        directionsTaps: 0, callTaps: 0, websiteTaps: 0, instagramTaps: 0,
        saves: 0, videoViews: 0, videoCompletes: 0,
        signalSubmits: 0, videoUploads: 0, checkins: 0, rewardClaims: 0,
        uniqueUsers: 0, clicksToVenue: 0, conversionRate: 0,
        repeatVisitors: 0, newVisitors: 0, repeatRate: 0,
        computedAt: Timestamp.now(),
      };

      for (const snap of weekSnaps) {
        if (!snap.exists) continue;
        const d = snap.data() as VenueAnalyticsDailyDoc;
        weekly.impressions     += d.impressions;
        weekly.detailViews     += d.detailViews;
        weekly.cardTaps        += d.cardTaps;
        weekly.directionsTaps  += d.directionsTaps;
        weekly.callTaps        += d.callTaps;
        weekly.websiteTaps     += d.websiteTaps;
        weekly.instagramTaps   += d.instagramTaps;
        weekly.saves           += d.saves;
        weekly.videoViews      += d.videoViews;
        weekly.videoCompletes  += d.videoCompletes;
        weekly.signalSubmits   += d.signalSubmits;
        weekly.videoUploads    += d.videoUploads;
        weekly.checkins        += d.checkins;
        weekly.rewardClaims    += d.rewardClaims;
        weekly.uniqueUsers     += d.uniqueUsers; // rough; not de-duped across days
      }

      weekly.clicksToVenue  = weekly.directionsTaps + weekly.callTaps + weekly.websiteTaps + weekly.instagramTaps;
      weekly.conversionRate = weekly.detailViews > 0
        ? Math.round((weekly.checkins / weekly.detailViews) * 1000) / 1000
        : 0;
      weekly.computedAt = Timestamp.now();

      weeklyBatch.set(
        db.collection('venueAnalyticsWeekly').doc(`${venueId}_${weekStart}`),
        weekly,
        { merge: true },
      );
    }

    await weeklyBatch.commit();
    console.log(`Weekly rollup complete: ${venueIds.length} venues`);
  },
);
