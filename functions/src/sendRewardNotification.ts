/**
 * sendRewardNotification — triggered when a reward document transitions
 * to status "paid". Sends an FCM push notification to the user.
 */
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import type { UserDoc } from './types';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RewardDoc = any;

export const sendRewardNotification = onDocumentUpdated(
  'rewards/{rewardId}',
  async (event) => {
    const before = event.data?.before.data() as RewardDoc | undefined;
    const after = event.data?.after.data() as RewardDoc | undefined;

    // Only fire when transitioning → "paid"
    if (!after || after.status !== 'paid' || before?.status === 'paid') return;

    const db = getFirestore();
    const userSnap = await db.collection('users').doc(after.userId).get();
    if (!userSnap.exists) return;

    const user = userSnap.data() as UserDoc;

    // FCM token stored on the user document (set by the app on login)
    const fcmToken: string | undefined = (user as UserDoc & { fcmToken?: string }).fcmToken;
    if (!fcmToken) return;

    await getMessaging().send({
      token: fcmToken,
      notification: {
        title: 'Reward received! 🎉',
        body: `₹${after.amount} has been credited to your UPI account.`,
      },
      data: {
        rewardId: event.params.rewardId,
        amount: String(after.amount),
      },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });
  },
);
