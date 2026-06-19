/**
 * deleteSignal — callable that lets a venue admin delete one of their
 * own liveSignals (e.g. to remove an outdated official post from the feed).
 *
 * Only signals where sourceType === 'admin' and the caller manages the venue
 * can be deleted. User-submitted signals are read-only from the admin side.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

export const deleteSignal = onCall(
  { region: 'asia-south1' },
  async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

    const { signalId } = req.data as { signalId: string };
    if (!signalId) throw new HttpsError('invalid-argument', 'signalId required.');

    const uid = req.auth.uid;

    const [signalSnap, adminSnap] = await Promise.all([
      db.collection('liveSignals').doc(signalId).get(),
      db.collection('venueAdmins').doc(uid).get(),
    ]);

    if (!signalSnap.exists) throw new HttpsError('not-found', 'Signal not found.');
    if (!adminSnap.exists)  throw new HttpsError('permission-denied', 'Not a venue admin.');

    const signal  = signalSnap.data()!;
    const managed: string[] = adminSnap.data()!.managedVenueIds ?? [];

    if (!managed.includes(signal.venueId)) {
      throw new HttpsError('permission-denied', 'You do not manage this venue.');
    }
    if (signal.sourceType !== 'admin') {
      throw new HttpsError('permission-denied', 'Only admin-posted signals can be deleted.');
    }

    await db.collection('liveSignals').doc(signalId).delete();
    return { success: true };
  },
);
