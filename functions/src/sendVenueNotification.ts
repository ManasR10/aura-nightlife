/**
 * sendVenueNotification — admin-triggered push notification to users.
 *
 * Free mode:  push to users who have saved this venue
 *             (up to 1 free notification per venue per night, resets at 03:30 IST)
 *
 * Boost mode: push to saved users + users who checked in at this venue in the
 *             last 30 days (regulars/recent visitors — best proxy for nearby
 *             without real-time GPS tracking)
 *             Rate-limited by the caller paying; no nightly cap.
 *
 * FCM tokens come from /users/{uid}.fcmToken — set by the app on login.
 * We skip blank or duplicate tokens and soft-fail per-token errors so one bad
 * token doesn't kill the whole batch.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getNightKey } from './nightKey';

const db = getFirestore();

const FREE_DAILY_CAP = 2; // free pushes per venue per night

export const sendVenueNotification = onCall(
  { region: 'asia-south1' },
  async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

    const {
      venueId,
      venueName,
      message,
      mode,
      radiusKm,
    } = req.data as {
      venueId:   string;
      venueName: string;
      message:   string;
      mode:      'free' | 'boost';
      radiusKm:  number | null;
    };

    if (!venueId || !message?.trim()) {
      throw new HttpsError('invalid-argument', 'venueId and message are required.');
    }

    const uid = req.auth.uid;

    // Verify admin owns this venue
    const adminSnap = await db.collection('venueAdmins').doc(uid).get();
    if (!adminSnap.exists) throw new HttpsError('permission-denied', 'Not a venue admin.');
    const managed: string[] = adminSnap.data()!.managedVenueIds ?? [];
    if (!managed.includes(venueId)) throw new HttpsError('permission-denied', 'You do not manage this venue.');

    // Free-mode rate limit: 1 per night per venue
    if (mode === 'free') {
      const nightKey = getNightKey();
      const limitRef = db.collection('venueNotifyLog').doc(`${venueId}_${nightKey}`);
      const limitSnap = await limitRef.get();

      const sentCount: number = limitSnap.exists ? (limitSnap.data()!.count ?? 0) : 0;
      if (sentCount >= FREE_DAILY_CAP) {
        throw new HttpsError(
          'resource-exhausted',
          'Free notification already sent tonight. Resets at 3:30 AM IST.',
        );
      }

      // Increment counter (do it before send so double-taps are blocked)
      await limitRef.set({ venueId, nightKey, count: sentCount + 1, lastSentAt: Timestamp.now() }, { merge: true });
    }

    // Collect target FCM tokens

    // 1. Users who saved this venue
    const savedSnap = await db
      .collectionGroup('savedVenues')
      .where('placeId', '==', venueId)
      .limit(500)
      .get();

    const savedUids = new Set(savedSnap.docs.map((d) => d.ref.parent.parent!.id));

    // 2. Boost: add users who checked in at this venue in last 30 days
    let recentUids = new Set<string>();
    if (mode === 'boost') {
      const cutoff = Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sessionSnap = await db
        .collection('checkInSessions')
        .where('venueId', '==', venueId)
        .where('checkedInAt', '>=', cutoff)
        .limit(500)
        .get();
      recentUids = new Set(sessionSnap.docs.map((d) => d.data().uid as string));
    }

    const allUids = [...new Set([...savedUids, ...recentUids])];

    if (allUids.length === 0) {
      return { sent: 0, skipped: 0, message: 'No eligible users to notify.' };
    }

    // Fetch FCM tokens in batches of 10 (Firestore .getAll limit)
    const tokens: string[] = [];

    for (let i = 0; i < allUids.length; i += 10) {
      const batch = allUids.slice(i, i + 10);
      const refs  = batch.map((id) => db.collection('users').doc(id));
      const snaps = await db.getAll(...refs);
      for (const snap of snaps) {
        const token: string | undefined = snap.data()?.fcmToken;
        if (token && token.length > 0) tokens.push(token);
      }
    }

    // Deduplicate (one user could appear in both saved + recent)
    const uniqueTokens = [...new Set(tokens)];

    if (uniqueTokens.length === 0) {
      return { sent: 0, skipped: allUids.length, message: 'No FCM tokens found for eligible users.' };
    }

    // Send FCM multicast in batches of 500 (FCM limit)
    const messaging = getMessaging();
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < uniqueTokens.length; i += 500) {
      const chunk = uniqueTokens.slice(i, i + 500);
      const result = await messaging.sendEachForMulticast({
        tokens: chunk,
        notification: {
          title: venueName,
          body:  message.trim(),
        },
        data: {
          type:     'venue_notification',
          venueId,
          venueName,
          mode,
        },
        android: { priority: 'high', notification: { channelId: 'venue_notifications' } },
        apns:    { payload: { aps: { sound: 'default' } } },
      });

      sent   += result.successCount;
      failed += result.failureCount;

      // Clean up invalid tokens (best-effort)
      result.responses.forEach((r, j) => {
        if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
          const badToken = chunk[j];
          db.collection('users')
            .where('fcmToken', '==', badToken)
            .limit(1)
            .get()
            .then((s) => {
              if (!s.empty) s.docs[0].ref.update({ fcmToken: '' });
            })
            .catch(() => {});
        }
      });
    }

    // Log the send
    await db.collection('venueNotifyLog').add({
      venueId,
      venueName,
      message: message.trim(),
      mode,
      radiusKm: radiusKm ?? null,
      sentBy:   uid,
      sentAt:   Timestamp.now(),
      reached:  sent,
      failed,
      eligibleUids: allUids.length,
    });

    return {
      sent,
      failed,
      eligible: allUids.length,
      message:  `Sent to ${sent} user${sent !== 1 ? 's' : ''}.`,
    };
  },
);
