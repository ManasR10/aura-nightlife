/**
 * AuthErrorScreen — shown when fetchOrCreateUserDoc fails on a transient
 * error (Firestore unavailable, network blip). Without this the user would
 * be stuck on the splash screen until they killed the app.
 *
 * Offers two recovery paths:
 *   - Retry: re-runs the user-doc load against the current Firebase user
 *   - Sign Out: drops the Firebase session so they can sign in again
 */
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/useAuth';
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../theme';

export function AuthErrorScreen() {
  const insets = useSafeAreaInsets();
  const { authError, retryAuth, signOut } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleRetry() {
    setRetrying(true);
    try { await retryAuth(); } finally { setRetrying(false); }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try { await signOut(); } finally { setSigningOut(false); }
  }

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={s.content}>
        <Text style={s.emoji}>📡</Text>
        <Text style={s.title}>Can't reach your profile</Text>
        <Text style={s.body}>
          We signed you in but couldn't load your account. This is usually a
          network blip. Try again — if it keeps failing, sign out and back in.
        </Text>

        {authError?.message ? (
          <Text style={s.errorDetail} numberOfLines={3}>{authError.message}</Text>
        ) : null}

        <Pressable
          style={[s.primaryBtn, retrying && s.btnDisabled]}
          onPress={handleRetry}
          disabled={retrying || signingOut}
        >
          {retrying
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.primaryBtnText}>Retry</Text>}
        </Pressable>

        <Pressable
          style={[s.secondaryBtn, signingOut && s.btnDisabled]}
          onPress={handleSignOut}
          disabled={retrying || signingOut}
        >
          {signingOut
            ? <ActivityIndicator color={COLORS.textSub} />
            : <Text style={s.secondaryBtnText}>Sign out</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', paddingHorizontal: SPACING.xl },
  content: { gap: SPACING.md, alignItems: 'center' },
  emoji:   { fontSize: 56 },
  title:   { color: COLORS.text, fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  body:    { color: COLORS.textSub, fontSize: FONT_SIZE.body, textAlign: 'center', lineHeight: 22, paddingHorizontal: SPACING.md },
  errorDetail: {
    color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center',
    fontFamily: 'monospace', marginTop: SPACING.xs, paddingHorizontal: SPACING.md,
  },
  primaryBtn: {
    width: '100%', height: 48, borderRadius: RADIUS.md,
    backgroundColor: COLORS.purple600,
    alignItems: 'center', justifyContent: 'center',
    marginTop: SPACING.md,
  },
  primaryBtnText: { color: '#fff', fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
  secondaryBtn: {
    width: '100%', height: 44, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { color: COLORS.textSub, fontSize: FONT_SIZE.body },
  btnDisabled: { opacity: 0.6 },
});
