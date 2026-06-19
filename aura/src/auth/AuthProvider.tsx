// Holds auth state only: the Firebase auth listener, the
// authUser/userDoc/venueAdminDoc/initializing values, and a splash timeout safety
// net. The real Firebase/Firestore work lives in services/auth.ts and
// services/userService.ts — the context methods just delegate and update state.
import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import auth, { type FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { fetchOrCreateUserDoc, registerFcmToken } from '../services/userService';
import * as authService from '../services/auth';
import type { UserDoc, UserPreferences, VenueAdminDoc } from '../types';

// Errors that mean "this account can't proceed" — sign-out is required.
// Anything else (Firestore unavailable, transient network) keeps the session
// alive so the next auth tick can recover.
const PERMANENT_AUTH_ERRORS = new Set([
  'ADMIN_PROVISIONING_INCOMPLETE',
]);

function isPermanentAuthError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (PERMANENT_AUTH_ERRORS.has(err.message)) return true;
  return err.message.startsWith('ACCOUNT_'); // account-status guard above
}

export type { EmailAuthResult } from '../services/auth';

// Context shape

interface AuthContextValue {
  authUser:      FirebaseAuthTypes.User | null;
  userDoc:       UserDoc | null;
  venueAdminDoc: VenueAdminDoc | null;
  initializing:  boolean;
  /** Last transient error from fetchOrCreateUserDoc, exposed so the UI can show
   *  a retry screen instead of hanging on splash forever. */
  authError:     Error | null;
  /** Re-runs the user-doc load against the current Firebase user. */
  retryAuth:     () => Promise<void>;

  sendOtp:            typeof authService.sendOtp;
  confirmOtp:         typeof authService.confirmOtp;
  signInWithGoogle:   typeof authService.signInWithGoogle;
  signInWithEmail:    typeof authService.signInWithEmail;
  signOut:            typeof authService.signOut;
  createProfile:      (displayName: string) => Promise<void>;
  completeOnboarding: (preferences: UserPreferences) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Provider

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authUser,      setAuthUser]      = useState<FirebaseAuthTypes.User | null>(null);
  const [userDoc,       setUserDoc]       = useState<UserDoc | null>(null);
  const [venueAdminDoc, setVenueAdminDoc] = useState<VenueAdminDoc | null>(null);
  const [initializing,  setInitializing]  = useState(true);
  const [authError,     setAuthError]     = useState<Error | null>(null);

  // Track which UID has already had its FCM token registered this app session
  // so we don't re-write it on every onAuthStateChanged fire.
  const fcmRegisteredForUid = useRef<string | null>(null);

  // Hydrate userDoc + venueAdminDoc for the current Firebase user. Pulled out
  // of the onAuthStateChanged listener so retryAuth() can re-run it.
  const hydrateUser = useCallback(async (user: FirebaseAuthTypes.User): Promise<void> => {
    setAuthError(null);
    try {
      const doc = await fetchOrCreateUserDoc(user);

      if (doc.accountStatus && doc.accountStatus !== 'active') {
        await auth().signOut().catch(() => {});
        setAuthUser(null);
        setUserDoc(null);
        throw new Error(`ACCOUNT_${doc.accountStatus.toUpperCase()}`);
      }

      setUserDoc(doc);

      if (fcmRegisteredForUid.current !== user.uid) {
        fcmRegisteredForUid.current = user.uid;
        registerFcmToken(user.uid);
      }

      if (doc.role === 'venue_admin') {
        const adminSnap = await firestore().collection('venueAdmins').doc(user.uid).get();
        if (adminSnap.exists()) setVenueAdminDoc(adminSnap.data() as VenueAdminDoc);
      }
    } catch (err) {
      if (isPermanentAuthError(err)) {
        console.warn('AuthProvider: permanent auth error, signing out:', (err as Error).message);
        await auth().signOut().catch(() => {});
        setAuthUser(null);
        setUserDoc(null);
      } else {
        // Transient failure (Firestore unavailable, network blip). Surface the
        // error to the UI so RootNavigator can render a retry/sign-out screen
        // instead of holding on splash indefinitely.
        console.error('AuthProvider: transient error loading user doc:', err);
        setAuthError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }, []);

  const retryAuth = useCallback(async () => {
    const current = auth().currentUser;
    if (!current) return;
    setInitializing(true);
    try {
      await hydrateUser(current);
    } finally {
      setInitializing(false);
    }
  }, [hydrateUser]);

  useEffect(() => {
    const splashTimeout = setTimeout(() => {
      setInitializing((prev) => {
        if (prev) console.warn('AuthProvider: splash timeout hit — forcing exit');
        return false;
      });
    }, 8_000);

    const unsub = auth().onAuthStateChanged(async (user) => {
      if (!user) {
        setAuthUser(null);
        setUserDoc(null);
        setVenueAdminDoc(null);
        setAuthError(null);
        fcmRegisteredForUid.current = null;
        setInitializing(false);
        clearTimeout(splashTimeout);
        return;
      }

      setAuthUser(user);
      try {
        await hydrateUser(user);
      } finally {
        setInitializing(false);
        clearTimeout(splashTimeout);
      }
    });

    return () => { unsub(); clearTimeout(splashTimeout); };
  }, [hydrateUser]);

  const value = useMemo<AuthContextValue>(() => ({
    authUser,
    userDoc,
    venueAdminDoc,
    initializing,
    authError,
    retryAuth,

    sendOtp:          authService.sendOtp,
    confirmOtp:       authService.confirmOtp,
    signInWithGoogle: authService.signInWithGoogle,
    signInWithEmail:  authService.signInWithEmail,
    signOut:          authService.signOut,

    createProfile: async (displayName: string) => {
      if (!authUser) throw new Error('Must be signed in.');
      await authService.createProfile(authUser, displayName);
      const clean = authService.sanitizeDisplayName(displayName);
      setUserDoc((prev) => prev ? { ...prev, displayName: clean, profileCompleted: true } : prev);
    },

    completeOnboarding: async (preferences: UserPreferences) => {
      if (!authUser) throw new Error('Must be signed in.');
      await authService.completeOnboarding(authUser.uid, preferences);
      setUserDoc((prev) =>
        prev ? { ...prev, preferences, onboardingCompleted: true, ageConfirmed: true } : prev,
      );
    },
  }), [authUser, userDoc, venueAdminDoc, initializing, authError, retryAuth]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
