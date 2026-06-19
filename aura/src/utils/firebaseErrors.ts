const FIREBASE_MESSAGES: Record<string, string> = {
  'auth/invalid-phone-number':      'Invalid phone number.',
  'auth/too-many-requests':         'Too many attempts. Try again later.',
  'auth/invalid-verification-code': 'Incorrect OTP. Try again.',
  'auth/session-expired':           'OTP expired. Resend.',
  'auth/code-expired':              'OTP expired. Resend.',
  'auth/wrong-password':            'Incorrect password.',
  'auth/invalid-email':             'Invalid email address.',
  'auth/weak-password':             'Password must be at least 6 characters.',
  'auth/email-already-in-use':      'Account already exists with this email.',
  'auth/user-not-found':            'No account found with this email.',
  'auth/network-request-failed':    'Network error. Check your connection.',
};

export function getFirebaseErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: string }).code;
    if (FIREBASE_MESSAGES[code]) return FIREBASE_MESSAGES[code];
  }
  if (err instanceof Error && err.message.includes('RNGoogleSignin')) {
    return 'Google sign-in not available in this build.';
  }
  return err instanceof Error ? err.message : 'Something went wrong.';
}

export function isFirebaseAuthCancellation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = String('code' in err ? (err as { code: unknown }).code : '');
  return code === '12' || code.includes('CANCELLED') || code.includes('cancelled');
}
