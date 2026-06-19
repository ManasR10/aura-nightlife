// Pays out a reward once a /rewards doc lands with status 'pending'. Razorpay keys
// come from defineSecret. Only the payout reference (payoutId/utr) is written back
// onto the reward, never the user's UPI ID — don't want /rewards turning into a
// dump of everyone's UPI handles if an admin account is ever compromised.
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { UserDoc, PayoutResponse } from './types';

type RewardDoc = {
  userId: string;
  status: 'pending' | 'paid' | 'failed';
  amount: number;
  checkinId?: string;
  createdAt?: unknown;
};

/**
 * Pure helper exported for unit tests. A payout from Razorpay is considered
 * successful from our perspective once it's been accepted into their queue
 * (PENDING) or already processed (PROCESSED). Any other status means the
 * disbursement did not happen and the reward should be marked failed.
 */
export function isPayoutSuccessful(status: string): boolean {
  return status === 'PROCESSED' || status === 'PENDING';
}

/** Pure helper exported for unit tests. */
export function buildRazorpayPayoutBody(args: {
  accountNumber: string;
  amountPaise:   number;
  upiId:         string;
  referenceId:   string;
}): Record<string, unknown> {
  return {
    account_number: args.accountNumber,
    amount: args.amountPaise,
    currency: 'INR',
    mode: 'UPI',
    purpose: 'payout',
    fund_account: {
      account_type: 'vpa',
      vpa: { address: args.upiId },
      contact: { type: 'customer', reference_id: args.referenceId },
    },
    queue_if_low_balance: true,
    reference_id: args.referenceId,
    narration: 'AURA venue update reward',
  };
}

const RAZORPAY_KEY_ID         = defineSecret('RAZORPAY_KEY_ID');
const RAZORPAY_KEY_SECRET     = defineSecret('RAZORPAY_KEY_SECRET');
const RAZORPAY_ACCOUNT_NUMBER = defineSecret('RAZORPAY_ACCOUNT_NUMBER');

async function createRazorpayPayout(
  keyId: string,
  keySecret: string,
  accountNumber: string,
  upiId: string,
  amountPaise: number,
  referenceId: string,
): Promise<PayoutResponse> {
  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  const response = await fetch('https://api.razorpay.com/v1/payouts', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
      'X-Payout-Idempotency': referenceId,
    },
    body: JSON.stringify(buildRazorpayPayoutBody({ accountNumber, amountPaise, upiId, referenceId })),
  });

  if (!response.ok) {
    // Surface a generic error to the caller; details go to structured logs
    // without echoing the credentials (which live only in the Authorization header).
    throw new Error(`Razorpay payout HTTP ${response.status}`);
  }

  const data = await response.json() as { id: string; status: string; utr?: string };
  return {
    id: data.id,
    status: data.status as PayoutResponse['status'],
    utr: data.utr,
  };
}

export const processUpiPayout = onDocumentCreated(
  {
    document: 'rewards/{rewardId}',
    secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_ACCOUNT_NUMBER],
  },
  async (event) => {
    const rewardId = event.params.rewardId;
    const reward = event.data?.data() as RewardDoc | undefined;

    if (!reward || reward.status !== 'pending') return;

    const db = getFirestore();
    const rewardRef = db.collection('rewards').doc(rewardId);

    const keyId         = RAZORPAY_KEY_ID.value();
    const keySecret     = RAZORPAY_KEY_SECRET.value();
    const accountNumber = RAZORPAY_ACCOUNT_NUMBER.value();
    if (!keyId || !keySecret || !accountNumber) {
      await rewardRef.update({ status: 'failed', failureReason: 'payout_unconfigured' });
      throw new Error('Razorpay secrets not configured');
    }

    const userSnap = await db.collection('users').doc(reward.userId).get();
    if (!userSnap.exists) {
      await rewardRef.update({ status: 'failed', failureReason: 'user_not_found' });
      return;
    }
    const user = userSnap.data() as UserDoc;
    if (!user.upiId) {
      await rewardRef.update({ status: 'failed', failureReason: 'no_upi_id' });
      return;
    }

    try {
      const payout = await createRazorpayPayout(
        keyId, keySecret, accountNumber,
        user.upiId,
        reward.amount * 100,
        rewardId,
      );

      const isSuccess = isPayoutSuccessful(payout.status);
      const batch = db.batch();

      batch.update(rewardRef, {
        status: isSuccess ? 'paid' : 'failed',
        payoutId: payout.id,
        payoutStatus: payout.status,
        utr: payout.utr ?? null,
        paidAt: isSuccess ? FieldValue.serverTimestamp() : null,
      });

      if (isSuccess) {
        batch.update(db.collection('users').doc(reward.userId), {
          rewardsBalance: FieldValue.increment(reward.amount),
          totalEarned: FieldValue.increment(reward.amount),
        });
      }

      await batch.commit();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      console.error('Payout error', { rewardId, msg });
      await rewardRef.update({ status: 'failed', failureReason: 'payout_error' });
    }
  },
);
