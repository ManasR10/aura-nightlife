/**
 * analytics.ts — fire-and-forget client-side event tracker.
 *
 * Call trackEvent() anywhere in the app. It never throws, never awaits,
 * never blocks the UI. The scheduled Cloud Function reads these docs nightly
 * and rolls them up into venueAnalyticsDaily / venueAnalyticsWeekly.
 *
 * date field: 'YYYY-MM-DD' in IST — matches the partition key the aggregator queries.
 */
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

export type AnalyticEventType =
  | 'venue_impression'
  | 'venue_card_tap'
  | 'venue_detail_view'
  | 'directions_tap'
  | 'call_tap'
  | 'website_tap'
  | 'instagram_tap'
  | 'venue_save'
  | 'venue_unsave'
  | 'video_view'
  | 'video_complete'
  | 'signal_submit'
  | 'video_upload'
  | 'checkin'
  | 'reward_claim';

// Module-level session ID — one per app launch, not per screen
const SESSION_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function istDateString(): string {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function trackEvent(
  type: AnalyticEventType,
  venueId: string | null,
  metadata?: Record<string, unknown>,
): void {
  const uid = auth().currentUser?.uid ?? null;

  // Fire and forget — silently ignore all errors
  firestore()
    .collection('analyticsEvents')
    .add({
      type,
      venueId,
      userId:    uid,
      sessionId: SESSION_ID,
      occurredAt: firestore.FieldValue.serverTimestamp(),
      date:       istDateString(),
      metadata:   metadata ?? {},
    })
    .catch(() => {});
}
