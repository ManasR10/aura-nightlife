import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../auth/useAuth';
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../theme';

export function ProfileSetupScreen() {
  const insets = useSafeAreaInsets();
  const { authUser, createProfile } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [upiId,       setUpiId]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  async function handleContinue() {
    if (!displayName.trim()) {
      setError('Enter a display name to continue.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await createProfile(displayName);

      // Optionally save UPI ID if provided
      if (upiId.trim() && authUser?.uid) {
        await firestore().collection('users').doc(authUser.uid).update({
          upiId: upiId.trim(),
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to create your profile.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + SPACING.xl }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.hero}>
        <Text style={styles.wordmark}>aura</Text>
        <View style={styles.wordmarkBar} />
        <Text style={styles.title}>Set up your profile</Text>
        <Text style={styles.subtitle}>One quick step, then you're in.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Verified number</Text>
        <Text style={styles.phone}>{authUser?.phoneNumber ?? 'Phone verified'}</Text>

        <Text style={[styles.label, styles.nameLabel]}>Display name</Text>
        <TextInput
          style={styles.input}
          placeholder="What should people call you?"
          placeholderTextColor={COLORS.textMuted}
          value={displayName}
          onChangeText={(t) => { setDisplayName(t); setError(''); }}
          autoCapitalize="words"
          returnKeyType="next"
        />

        <Text style={[styles.label, styles.nameLabel]}>UPI ID <Text style={styles.optional}>(optional)</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="yourname@okaxis"
          placeholderTextColor={COLORS.textMuted}
          value={upiId}
          onChangeText={(t) => { setUpiId(t); setError(''); }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          returnKeyType="done"
          onSubmitEditing={handleContinue}
        />
        <Text style={styles.helper}>Required to receive ₹10 check-in rewards. You can add it later too.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [
            styles.btn,
            (pressed || loading) && styles.btnPressed,
          ]}
          onPress={handleContinue}
          disabled={loading}
          accessibilityRole="button"
        >
          {loading
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.btnText}>Continue to Aura</Text>
          }
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACING.xl,
  },
  hero: {
    marginTop: SPACING.xxxl,
    marginBottom: SPACING.xxl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  wordmark: {
    fontSize: FONT_SIZE.logo,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    letterSpacing: -1,
  },
  wordmarkBar: {
    width: 40,
    height: 3,
    backgroundColor: COLORS.purple500,
    borderRadius: RADIUS.full,
  },
  title: {
    color: COLORS.text,
    fontSize: FONT_SIZE.display,
    fontWeight: FONT_WEIGHT.bold,
    marginTop: SPACING.lg,
  },
  subtitle: {
    color: COLORS.textSub,
    fontSize: FONT_SIZE.bodyLg,
  },
  card: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
  },
  label: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.base,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  phone: {
    color: COLORS.text,
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.semibold,
    marginTop: SPACING.sm,
  },
  nameLabel: {
    marginTop: SPACING.xl,
  },
  optional: {
    color: COLORS.textMuted,
    fontWeight: 'normal' as const,
    textTransform: 'none' as const,
    fontSize: FONT_SIZE.sm,
    letterSpacing: 0,
  },
  input: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    fontSize: FONT_SIZE.bodyLg,
    height: 52,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base,
    marginTop: SPACING.sm,
  },
  helper: {
    color: COLORS.textSub,
    fontSize: FONT_SIZE.body,
    marginTop: SPACING.sm,
  },
  error: {
    color: COLORS.live,
    fontSize: FONT_SIZE.base,
    marginTop: SPACING.base,
  },
  btn: {
    height: 50,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.purple600,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xl,
  },
  btnPressed: { opacity: 0.88 },
  btnText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.bodyLg,
    fontWeight: FONT_WEIGHT.semibold,
  },
});
