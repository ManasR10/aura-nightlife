/**
 * userService — Firestore user document lifecycle.
 *
 * Responsible for: fetch-or-create on first sign-in, schema backfill for
 * pre-existing docs, and FCM token registration.
 *
 * No state. No React. Pure async functions the AuthProvider calls.
 */
import auth, { type FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';
import type { UserDoc } from '../types';

export async function registerFcmToken(uid: string): Promise<void> {
  try {
    const status = await messaging().requestPermission();
    const enabled =
      status === messaging.AuthorizationStatus.AUTHORIZED ||
      status === messaging.AuthorizationStatus.PROVISIONAL;
    if (!enabled) return;

    const token = await messaging().getToken();
    if (token) {
      await firestore().collection('users').doc(uid).update({ fcmToken: token });
    }
  } catch {
    // Non-critical — silently skip if messaging isn't available
  }
}

export async function fetchOrCreateUserDoc(
  user: FirebaseAuthTypes.User,
  displayNameOverride?: string,
): Promise<UserDoc> {
  const ref  = firestore().collection('users').doc(user.uid);
  const snap = await ref.get();

  if (snap.exists()) {
    const data = snap.data() as UserDoc;

    // Backfill fields added after initial schema. Fire-and-forget — never
    // block auth on a non-critical write.
    const backfill: Record<string, unknown> = {
      lastLoginAt: firestore.FieldValue.serverTimestamp(),
    };
    if (data.accountStatus == null)   backfill.accountStatus   = 'active';
    if (data.ageConfirmed == null)    backfill.ageConfirmed    = false;
    if (data.termsAcceptedAt == null) backfill.termsAcceptedAt = null;
    ref.update(backfill).catch(() => {});

    return {
      ...data,
      accountStatus:   data.accountStatus   ?? 'active',
      ageConfirmed:    data.ageConfirmed     ?? false,
      termsAcceptedAt: data.termsAcceptedAt  ?? null,
    } as UserDoc;
  }

  // Doc doesn't exist. If this UID belongs to a partially-provisioned venue
  // admin, sign out and surface a hard error rather than creating a user doc.
  const adminSnap = await firestore().collection('venueAdmins').doc(user.uid).get();
  if (adminSnap.exists()) {
    await auth().signOut().catch(() => {});
    throw new Error('ADMIN_PROVISIONING_INCOMPLETE');
  }

  const displayName = (displayNameOverride ?? user.displayName ?? '').trim();

  const newDoc = {
    uid:                 user.uid,
    phoneNumber:         user.phoneNumber ?? '',
    displayName,
    profilePhoto:        user.photoURL ?? '',
    upiId:               '',
    rewardsBalance:      0,
    totalEarned:         0,
    role:                'user',
    accountStatus:       'active',
    profileCompleted:    !!displayName,
    onboardingCompleted: false,
    fcmToken:            '',
    preferences: {
      auraVibes:       [],
      nightTypes:      [],
      crowdPreference: '',
      travelDistance:  '',
    },
    ageConfirmed:    false,
    termsAcceptedAt: null,
    createdAt:       firestore.FieldValue.serverTimestamp(),
    lastLoginAt:     firestore.FieldValue.serverTimestamp(),
  };

  await ref.set(newDoc);

  if (user.email && !user.emailVerified) {
    user.sendEmailVerification().catch(() => {});
  }

  const created = await ref.get();
  return created.data() as UserDoc;
}
