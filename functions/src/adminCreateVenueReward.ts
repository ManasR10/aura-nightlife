/**
 * adminCreateVenueReward — venue admin sets their active reward.
 *
 * Each venue has one active reward at a time. Calling this deactivates
 * any previous reward and creates a fresh one with claimCount = 0.
 *
 * Super admin can create platform-wide rewards (venueId: null) only if
 * /superAdmins/{uid} exists. Venue admins are checked against their
 * managedVenueIds in /venueAdmins/{uid}.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type {
  VenueRewardType,
  VenueRewardEligibility,
  VenueRewardLimits,
  VenueRewardWindow,
} from './types';

const db = getFirestore();

async function assertSuperAdmin(uid: string): Promise<void> {
  const snap = await db.collection('superAdmins').doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'Super-admin privilege required.');
  }
}

async function assertVenueAdmin(uid: string, venueId: string): Promise<void> {
  const adminSnap = await db.collection('venueAdmins').doc(uid).get();
  if (!adminSnap.exists) {
    throw new HttpsError('permission-denied', 'Not a venue admin.');
  }
  const managed: string[] = adminSnap.data()!.managedVenueIds ?? [];
  if (!managed.includes(venueId)) {
    throw new HttpsError('permission-denied', 'You do not manage this venue.');
  }
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

interface RewardInput {
  venueId:      string | null;
  title:        string;
  description:  string;
  emoji:        string;
  rewardType:   VenueRewardType;
  cashAmount:   number | null;
  value:        string;
  expiresAt:    string | null;
  eligibility?: Partial<VenueRewardEligibility>;
  limits?:      Partial<VenueRewardLimits>;
  activeWindow?: VenueRewardWindow | null;
}

export const adminCreateVenueReward = onCall(
  { region: 'asia-south1' },
  async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

    const {
      venueId, title, description, emoji, rewardType, cashAmount,
      value, expiresAt, eligibility, limits, activeWindow,
    } = req.data as RewardInput;

    if (!title?.trim() || !value?.trim()) {
      throw new HttpsError('invalid-argument', 'title and value are required.');
    }

    const uid = req.auth.uid;

    if (venueId === null) {
      await assertSuperAdmin(uid);
    } else {
      await assertVenueAdmin(uid, venueId);
    }

    const now = Timestamp.now();

    const existing = await db.collection('venueRewards')
      .where('venueId', '==', venueId)
      .where('active',  '==', true)
      .get();

    const batch = db.batch();
    existing.docs.forEach((d) => batch.update(d.ref, { active: false }));

    const mergedEligibility: VenueRewardEligibility = { ...DEFAULT_ELIGIBILITY, ...eligibility };
    const mergedLimits: VenueRewardLimits = { ...DEFAULT_LIMITS, ...limits };

    const ref = db.collection('venueRewards').doc();
    batch.set(ref, {
      rewardId:     ref.id,
      venueId:      venueId ?? null,
      title:        title.trim(),
      description:  description?.trim() ?? 'Show this code to venue staff',
      emoji:        emoji ?? '🎁',
      rewardType:   rewardType ?? 'free_drink',
      cashAmount:   rewardType === 'cash' ? (cashAmount ?? null) : null,
      value:        value.trim(),
      eligibility:  mergedEligibility,
      limits:       mergedLimits,
      activeWindow: activeWindow ?? null,
      active:       true,
      version:      1,
      claimCount:   0,
      expiresAt:    expiresAt ? Timestamp.fromDate(new Date(expiresAt)) : null,
      createdBy:    uid,
      createdAt:    now,
      updatedAt:    now,
    });

    await batch.commit();
    return { rewardId: ref.id, success: true };
  },
);

// ── adminDeactivateVenueReward ─────────────────────────────────────────────────

export const adminDeactivateVenueReward = onCall(
  { region: 'asia-south1' },
  async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

    const { rewardId } = req.data as { rewardId: string };
    if (!rewardId) throw new HttpsError('invalid-argument', 'rewardId required.');

    const uid  = req.auth.uid;
    const snap = await db.collection('venueRewards').doc(rewardId).get();
    if (!snap.exists) throw new HttpsError('not-found', 'Reward not found.');

    const venueId = snap.data()!.venueId as string | null;
    if (venueId === null) {
      await assertSuperAdmin(uid);
    } else {
      await assertVenueAdmin(uid, venueId);
    }

    await db.collection('venueRewards').doc(rewardId).update({ active: false });
    return { success: true };
  },
);

// ── adminMarkRewardRedeemed — venue staff marks a code as fulfilled ────────────

export const adminMarkRewardRedeemed = onCall(
  { region: 'asia-south1' },
  async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

    const { redemptionCode } = req.data as { redemptionCode: string };
    if (!redemptionCode?.trim()) throw new HttpsError('invalid-argument', 'redemptionCode required.');

    const uid  = req.auth.uid;
    const code = redemptionCode.trim().toUpperCase();

    const snap = await db.collection('rewardClaims')
      .where('redemptionCode', '==', code)
      .where('status',         '==', 'pending')
      .limit(1)
      .get();

    if (snap.empty) {
      throw new HttpsError('not-found', 'Code not found or already fulfilled.');
    }

    const claimDoc = snap.docs[0];
    const venueId  = claimDoc.data().venueId as string;

    const adminSnap = await db.collection('venueAdmins').doc(uid).get();
    const managed: string[] = adminSnap.data()?.managedVenueIds ?? [];
    if (!managed.includes(venueId)) {
      throw new HttpsError('permission-denied', 'This reward belongs to a different venue.');
    }

    await claimDoc.ref.update({
      status:     'fulfilled',
      redeemedAt: Timestamp.now(),
    });

    return {
      success: true,
      uid:     claimDoc.data().uid,
      title:   claimDoc.data().title,
      value:   claimDoc.data().value,
      emoji:   claimDoc.data().emoji,
    };
  },
);
