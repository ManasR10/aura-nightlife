// Server-side reward eligibility + an immutable claim record. Checks the session is
// unlocked and the venue reward's window / nightly cap / daily budget / per-user
// limit all pass, then writes /rewardClaims and bumps claimCount in one batch.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getNightKey } from './nightKey';
import type {
  VenueRewardDoc,
  VenueRewardEligibility,
  VenueRewardLimits,
  VenueRewardWindow,
} from './types';

const db = getFirestore();

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

const DEFAULT_ELIGIBILITY: VenueRewardEligibility = {
  requiresCheckIn:     true,
  requiredClips:       2,
  clipCooldownMinutes: 30,
  geoRequired:         true,
  maxDistanceMeters:   200,
};

const DEFAULT_LIMITS: VenueRewardLimits = {
  perUserPerNight:   1,
  maxClaimsPerNight: 100,
  dailyBudgetINR:    null,
};

function makeDefaultReward(now: Timestamp): VenueRewardDoc {
  return {
    rewardId:     'default',
    venueId:      null,
    title:        'Aura Check-in Reward',
    description:  'Show this code to venue staff',
    emoji:        '🌟',
    rewardType:   'free_drink',
    cashAmount:   null,
    value:        'VIP Moment',
    eligibility:  DEFAULT_ELIGIBILITY,
    limits:       DEFAULT_LIMITS,
    activeWindow: null,
    active:       true,
    version:      1,
    claimCount:   0,
    expiresAt:    null,
    createdBy:    'system',
    createdAt:    now,
    updatedAt:    now,
  };
}

function isWithinWindow(window: VenueRewardWindow | null): boolean {
  if (!window) return true;
  const nowIST      = new Date(new Date().toLocaleString('en-US', { timeZone: window.timezone }));
  const currentMins = nowIST.getHours() * 60 + nowIST.getMinutes();
  const [sh, sm]    = window.startHHMM.split(':').map(Number);
  const [eh, em]    = window.endHHMM.split(':').map(Number);
  const startMins   = sh * 60 + sm;
  const endMins     = eh * 60 + em;
  if (endMins <= startMins) return currentMins >= startMins || currentMins <= endMins;
  return currentMins >= startMins && currentMins <= endMins;
}

export const claimSessionReward = onCall(
  { region: 'asia-south1' },
  async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

    const { venueId } = req.data as { venueId: string };
    if (!venueId) throw new HttpsError('invalid-argument', 'venueId required.');

    const uid        = req.auth.uid;
    const nightKey   = getNightKey();
    const sessionId  = `${uid}_${venueId}_${nightKey}`;
    const sessionRef = db.collection('checkInSessions').doc(sessionId);

    const [sessionSnap, venueSnap] = await Promise.all([
      sessionRef.get(),
      db.collection('venues').doc(venueId).get(),
    ]);

    if (!sessionSnap.exists) {
      throw new HttpsError('not-found', 'No check-in session found. Complete all steps first.');
    }

    const session   = sessionSnap.data()!;
    const venueName = (venueSnap.data()?.name as string) ?? '';

    // Idempotent: already claimed
    if (session.rewardStatus === 'claimed') {
      const existingSnap = await db.collection('rewardClaims')
        .where('sessionId', '==', sessionId)
        .limit(1)
        .get();
      if (!existingSnap.empty) {
        const r = existingSnap.docs[0].data();
        return {
          claimId:        existingSnap.docs[0].id,
          redemptionCode: r.redemptionCode as string,
          title:          r.title as string,
          emoji:          r.emoji as string,
          value:          r.value as string,
          description:    (r.rewardSnapshot as VenueRewardDoc)?.description ?? 'Show this code to venue staff',
          alreadyClaimed: true,
        };
      }
    }

    // Pre-claim checks
    if ((session.level as number) < 3) {
      throw new HttpsError(
        'failed-precondition',
        `Session is at level ${session.level}. Post both clips first.`,
      );
    }
    if (session.rewardStatus !== 'unlocked') {
      throw new HttpsError('failed-precondition', 'Reward is not unlocked yet.');
    }

    // Fetch active reward config
    const now = Timestamp.now();
    let reward: VenueRewardDoc;
    let venueRewardRef: FirebaseFirestore.DocumentReference | null = null;

    const venueRewardQuery = await db.collection('venueRewards')
      .where('venueId', '==', venueId)
      .where('active',  '==', true)
      .limit(1)
      .get();

    if (!venueRewardQuery.empty) {
      reward         = venueRewardQuery.docs[0].data() as VenueRewardDoc;
      venueRewardRef = venueRewardQuery.docs[0].ref;
    } else {
      const platformQuery = await db.collection('venueRewards')
        .where('venueId', '==', null)
        .where('active',  '==', true)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
      if (!platformQuery.empty) {
        reward         = platformQuery.docs[0].data() as VenueRewardDoc;
        venueRewardRef = platformQuery.docs[0].ref;
      } else {
        reward = makeDefaultReward(now);
      }
    }

    const limits = { ...DEFAULT_LIMITS, ...reward.limits };

    // Active window check
    if (!isWithinWindow(reward.activeWindow ?? null)) {
      const w = reward.activeWindow!;
      throw new HttpsError(
        'failed-precondition',
        `Rewards are only available ${w.startHHMM}–${w.endHHMM} (${w.timezone}).`,
      );
    }

    // Nightly cap check
    if (venueRewardRef && reward.claimCount >= limits.maxClaimsPerNight) {
      throw new HttpsError(
        'resource-exhausted',
        "Tonight's reward limit has been reached. Try again tomorrow.",
      );
    }

    // Daily budget check (cash only)
    if (
      limits.dailyBudgetINR !== null &&
      reward.rewardType === 'cash' &&
      reward.cashAmount != null
    ) {
      const todaySnap = await db.collection('rewardClaims')
        .where('venueId',  '==', venueId)
        .where('nightKey', '==', nightKey)
        .get();
      const usedBudget = todaySnap.docs.reduce(
        (sum, d) => sum + ((d.data().cashAmount as number) ?? 0), 0,
      );
      if (usedBudget + reward.cashAmount > limits.dailyBudgetINR) {
        throw new HttpsError(
          'resource-exhausted',
          "Tonight's reward budget has been used up. Try again tomorrow.",
        );
      }
    }

    // Per-user per-night check
    const userNightSnap = await db.collection('rewardClaims')
      .where('uid',      '==', uid)
      .where('venueId',  '==', venueId)
      .where('nightKey', '==', nightKey)
      .get();
    if (userNightSnap.size >= limits.perUserPerNight) {
      throw new HttpsError(
        'already-exists',
        "You've already claimed a reward at this venue tonight.",
      );
    }

    // Write claim + update session
    const redemptionCode = generateCode();
    const expiresAt      = Timestamp.fromMillis(now.toMillis() + 30 * 24 * 60 * 60 * 1000);
    const claimRef       = db.collection('rewardClaims').doc();
    const batch          = db.batch();

    batch.set(claimRef, {
      claimId:             claimRef.id,
      uid,
      venueId,
      venueName,
      nightKey,
      sessionId,
      venueRewardId:       reward.rewardId === 'default' ? null : reward.rewardId,
      rewardConfigVersion: reward.version ?? 1,
      rewardSnapshot:      reward,
      rewardType:          reward.rewardType,
      cashAmount:          reward.cashAmount ?? null,
      currency:            'INR',
      title:               reward.title,
      emoji:               reward.emoji,
      value:               reward.value,
      redemptionCode,
      status:              'pending',
      createdAt:           now,
      paidAt:              null,
      redeemedAt:          null,
      expiresAt,
    });

    batch.update(sessionRef, {
      rewardStatus: 'claimed',
      claimId:      claimRef.id,
    });

    if (venueRewardRef) {
      batch.update(venueRewardRef, {
        claimCount: (reward.claimCount ?? 0) + 1,
      });
    }

    await batch.commit();

    return {
      claimId:        claimRef.id,
      redemptionCode,
      title:          reward.title,
      emoji:          reward.emoji,
      value:          reward.value,
      description:    reward.description,
      alreadyClaimed: false,
    };
  },
);
