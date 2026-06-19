/**
 * adminGetRewardStats — today's reward dashboard data for a venue.
 * Returns claim count, cash paid out, and remaining budget for tonight.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getNightKey } from './nightKey';

const db = getFirestore();

export const adminGetRewardStats = onCall(
  { region: 'asia-south1' },
  async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

    const { venueId } = req.data as { venueId: string };
    if (!venueId) throw new HttpsError('invalid-argument', 'venueId required.');

    const uid = req.auth.uid;
    const adminSnap = await db.collection('venueAdmins').doc(uid).get();
    const managed: string[] = adminSnap.data()?.managedVenueIds ?? [];
    if (!managed.includes(venueId)) {
      throw new HttpsError('permission-denied', 'You do not manage this venue.');
    }

    const nightKey = getNightKey();

    const [claimsSnap, rewardSnap] = await Promise.all([
      db.collection('rewardClaims')
        .where('venueId',  '==', venueId)
        .where('nightKey', '==', nightKey)
        .get(),
      db.collection('venueRewards')
        .where('venueId', '==', venueId)
        .where('active',  '==', true)
        .limit(1)
        .get(),
    ]);

    const claims       = claimsSnap.docs.map((d) => d.data());
    const claimsToday  = claims.length;
    const fulfilledCount = claims.filter((c) => c.status === 'fulfilled').length;
    const pendingCount   = claims.filter((c) => c.status === 'pending').length;
    const budgetUsed     = claims.reduce((s, c) => s + ((c.cashAmount as number) ?? 0), 0);

    const activeReward   = rewardSnap.empty ? null : rewardSnap.docs[0].data();
    const dailyBudget    = (activeReward?.limits?.dailyBudgetINR as number | null) ?? null;
    const budgetRemaining = dailyBudget !== null ? Math.max(0, dailyBudget - budgetUsed) : null;
    const nightlyCap     = (activeReward?.limits?.maxClaimsPerNight as number) ?? 100;
    const capsRemaining  = Math.max(0, nightlyCap - claimsToday);

    return {
      claimsToday,
      fulfilledCount,
      pendingCount,
      budgetUsed,
      budgetRemaining,
      capsRemaining,
      nightKey,
    };
  },
);
