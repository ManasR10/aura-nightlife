/**
 * auth service — all Firebase auth operations.
 *
 * Pure async functions: no React, no state. Each function does exactly one
 * thing and returns enough data for the caller to update its own state.
 *
 * AuthProvider is the only consumer; screens call these via useAuth().
 */
import auth, { type FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { GOOGLE_WEB_CLIENT_ID } from '../firebase/googleConfig';
import type { UserPreferences } from '../types';

export type EmailAuthResult = 'logged_in' | 'created';

// ── Google Sign-In (lazy import — large native module) ────────────────────────

let googleConfigured = false;

async function getGoogleSigninModule() {
  const mod        = await import('@react-native-google-signin/google-signin');
  const googleSignin = mod.GoogleSignin;
  if (!googleConfigured) {
    googleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    googleConfigured = true;
  }
  return googleSignin;
}

// ── Phone helpers ─────────────────────────────────────────────────────────────

export class InvalidPhoneError extends Error {
  constructor() {
    super('Enter a 10-digit Indian mobile number.');
    this.name = 'InvalidPhoneError';
  }
}

function normalizeIndianPhone(phone: string): string {
  const trimmed = phone.trim();
  // Allow explicit E.164 input like +91XXXXXXXXXX — must be exactly +91 + 10 digits
  if (trimmed.startsWith('+')) {
    if (/^\+91[6-9]\d{9}$/.test(trimmed)) return trimmed;
    throw new InvalidPhoneError();
  }
  const digits = trimmed.replace(/\D/g, '');
  if (/^[6-9]\d{9}$/.test(digits))            return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits))          return `+${digits}`;
  throw new InvalidPhoneError();
}

// ── Exported auth operations ──────────────────────────────────────────────────

export function sendOtp(phone: string): Promise<FirebaseAuthTypes.ConfirmationResult> {
  return auth().signInWithPhoneNumber(normalizeIndianPhone(phone));
}

export async function confirmOtp(
  confirmation: FirebaseAuthTypes.ConfirmationResult,
  code: string,
): Promise<void> {
  await confirmation.confirm(code);
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<EmailAuthResult> {
  const methods    = await auth().fetchSignInMethodsForEmail(email.trim());
  const isExisting = methods.includes('password');

  if (isExisting) {
    await auth().signInWithEmailAndPassword(email.trim(), password);
    return 'logged_in';
  }
  await auth().createUserWithEmailAndPassword(email.trim(), password);
  return 'created';
}

export async function signInWithGoogle(): Promise<void> {
  const googleSignin = await getGoogleSigninModule();
  await googleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await googleSignin.signIn();

  const idToken =
    'idToken' in response
      ? (response as { idToken: string }).idToken
      : (response as { data?: { idToken?: string } }).data?.idToken;

  if (!idToken) throw new Error('Google sign-in failed — no ID token returned.');

  const credential = auth.GoogleAuthProvider.credential(idToken);
  await auth().signInWithCredential(credential);
  // onAuthStateChanged fires → fetchOrCreateUserDoc runs automatically
}

export async function signOut(): Promise<void> {
  try {
    const googleSignin = await getGoogleSigninModule();
    await googleSignin.signOut();
  } catch {
    // Not a Google session
  }
  await auth().signOut();
}

// ── Profile mutations ─────────────────────────────────────────────────────────
// These write to Firestore/Auth and return. State updates are the caller's job.

const DISPLAY_NAME_MAX = 50;
// Allow letters, marks (combining vowel signs used by Devanagari/Tamil/Arabic),
// digits, space, and . _ - ' — covers common Indian names ("Riya Singh",
// "D'Souza", "रिया") without admitting control chars or HTML-injecting
// punctuation.
const DISPLAY_NAME_REGEX = /^[\p{L}\p{M}\p{N} .'_-]+$/u;

export function sanitizeDisplayName(raw: string): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (!collapsed)                       throw new Error('Display name is required.');
  if (collapsed.length > DISPLAY_NAME_MAX) throw new Error(`Display name must be ${DISPLAY_NAME_MAX} characters or fewer.`);
  if (!DISPLAY_NAME_REGEX.test(collapsed)) {
    throw new Error("Use letters, numbers, spaces, and . ' _ - only.");
  }
  return collapsed;
}

export async function createProfile(
  user: FirebaseAuthTypes.User,
  displayName: string,
): Promise<void> {
  const clean = sanitizeDisplayName(displayName);

  await Promise.all([
    firestore().collection('users').doc(user.uid).update({
      displayName:      clean,
      profileCompleted: true,
    }),
    user.updateProfile({ displayName: clean }),
  ]);
}

export async function completeOnboarding(
  uid: string,
  preferences: UserPreferences,
): Promise<void> {
  await firestore().collection('users').doc(uid).update({
    preferences,
    onboardingCompleted: true,
    ageConfirmed:        true,
    termsAcceptedAt:     firestore.FieldValue.serverTimestamp(),
  });
}
