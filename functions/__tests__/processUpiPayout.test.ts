/**
 * Unit tests for the pure helpers in processUpiPayout. The full Firestore-
 * triggered handler depends on Razorpay's HTTP API and Firestore writes; an
 * integration test against the emulator is the right place for that.
 */
import { isPayoutSuccessful, buildRazorpayPayoutBody } from '../src/processUpiPayout';

describe('isPayoutSuccessful', () => {
  it('treats PROCESSED as success', () => {
    expect(isPayoutSuccessful('PROCESSED')).toBe(true);
  });

  it('treats PENDING as success (queued; will settle async)', () => {
    expect(isPayoutSuccessful('PENDING')).toBe(true);
  });

  it('treats every other Razorpay status as failure', () => {
    expect(isPayoutSuccessful('REJECTED')).toBe(false);
    expect(isPayoutSuccessful('REVERSED')).toBe(false);
    expect(isPayoutSuccessful('CANCELLED')).toBe(false);
    expect(isPayoutSuccessful('FAILED')).toBe(false);
    expect(isPayoutSuccessful('QUEUED')).toBe(false);  // not a real status; defensive
    expect(isPayoutSuccessful('')).toBe(false);
  });

  it('is case-sensitive (Razorpay always returns uppercase)', () => {
    expect(isPayoutSuccessful('processed')).toBe(false);
    expect(isPayoutSuccessful('Pending')).toBe(false);
  });
});

describe('buildRazorpayPayoutBody', () => {
  const args = {
    accountNumber: 'XXXXXXXX',
    amountPaise:   1000,
    upiId:         'riya@okaxis',
    referenceId:   'reward_abc',
  };

  it('places the UPI VPA at fund_account.vpa.address', () => {
    const body = buildRazorpayPayoutBody(args);
    expect(body.fund_account).toMatchObject({
      account_type: 'vpa',
      vpa: { address: 'riya@okaxis' },
    });
  });

  it('uses the reward id as both reference_id and contact reference_id (idempotency)', () => {
    const body = buildRazorpayPayoutBody(args);
    expect(body.reference_id).toBe('reward_abc');
    const fundAccount = body.fund_account as { contact: { reference_id: string } };
    expect(fundAccount.contact.reference_id).toBe('reward_abc');
  });

  it('sends amount in paise and INR currency', () => {
    const body = buildRazorpayPayoutBody(args);
    expect(body.amount).toBe(1000);
    expect(body.currency).toBe('INR');
  });

  it('queues if Razorpay balance is low instead of dropping the payout', () => {
    const body = buildRazorpayPayoutBody(args);
    expect(body.queue_if_low_balance).toBe(true);
  });

  it('does not echo the user id, phone, or any PII beyond the UPI VPA', () => {
    const body = buildRazorpayPayoutBody(args);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/userId/i);
    expect(serialized).not.toMatch(/phone/i);
    expect(serialized).not.toMatch(/email/i);
  });

  it('mode is always UPI', () => {
    const body = buildRazorpayPayoutBody(args);
    expect(body.mode).toBe('UPI');
  });
});
