/**
 * VenueLoginScreen — separate auth screen for venue operators.
 * Ported from Lovable VenueLogin.tsx.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme';
import { IconBack } from '../components/Icon';
import type { RootStackParamList } from '../types';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

type Props = NativeStackScreenProps<RootStackParamList, 'VenueLogin'>;

export function VenueLoginScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Strict sign-in only — never auto-create an account on this screen.
      // Using the Firebase SDK directly instead of the useAuth hook which
      // calls createUserWithEmailAndPassword on unknown emails.
      await auth().signInWithEmailAndPassword(email.trim(), password);

      // Verify the signed-in user actually has venue_admin role.
      // If not, sign them out immediately before RootNavigator can react.
      const uid = auth().currentUser?.uid;
      if (uid) {
        const userSnap = await firestore().collection('users').doc(uid).get();
        if (!userSnap.exists() || userSnap.data()?.role !== 'venue_admin') {
          await auth().signOut();
          setError("This account doesn't have venue operator access. Contact AURA support to get set up.");
          return;
        }
      }
      // RootNavigator detects role === 'venue_admin' and routes to AdminDashboard
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      const msg  = err instanceof Error ? err.message : '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Incorrect email or password.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Try again later or reset your password.');
      } else if (msg === 'ADMIN_PROVISIONING_INCOMPLETE') {
        setError('Your account setup is incomplete. Contact AURA support to get your venue access configured.');
      } else {
        setError(msg || 'Login failed. Check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError('Enter your email address above, then tap "Forgot password?".');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await auth().sendPasswordResetEmail(email.trim());
      Alert.alert(
        'Reset link sent',
        `Check ${email.trim()} for a password reset link from Firebase. It may take a minute.`,
        [{ text: 'OK' }],
      );
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/user-not-found') {
        setError('No operator account found with this email.');
      } else {
        setError(err instanceof Error ? err.message : 'Could not send reset email.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + SPACING.xl }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Back */}
      <Pressable
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
      >
        <IconBack size={22} color={COLORS.textSub} />
      </Pressable>

      <View style={styles.body}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Venue Login</Text>
          <Text style={styles.subtitle}>Access your Aura venue dashboard</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email address</Text>
            <TextInput
              style={styles.input}
              placeholder="you@venue.com"
              placeholderTextColor={COLORS.textMuted}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(''); }}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <Pressable
                style={styles.eyeBtn}
                onPress={() => setShowPassword((v) => !v)}
                accessibilityRole="button"
              >
                <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
              </Pressable>
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            accessibilityRole="button"
          >
            {loading
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={styles.primaryBtnText}>Log In</Text>
            }
          </Pressable>

          <Pressable
            style={styles.forgotBtn}
            onPress={handleForgotPassword}
            disabled={loading}
            accessibilityRole="button"
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>
        </View>

        {/* Apply link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Not on Aura yet?{' '}
            <Text style={styles.footerLink}>Apply for venue access →</Text>
          </Text>
        </View>
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
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -SPACING.sm,
    marginTop: SPACING.sm,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    marginBottom: SPACING.xxl,
    gap: SPACING.xs,
  },
  title: {
    color: COLORS.text,
    fontSize: FONT_SIZE.title,
    fontWeight: FONT_WEIGHT.bold,
  },
  subtitle: {
    color: COLORS.textSub,
    fontSize: FONT_SIZE.body,
  },
  form: {
    gap: SPACING.base,
  },
  field: {
    gap: SPACING.xs,
  },
  fieldLabel: {
    color: COLORS.textSub,
    fontSize: FONT_SIZE.body,
  },
  input: {
    height: 48,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base,
    color: COLORS.text,
    fontSize: FONT_SIZE.bodyLg,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingRight: 48,
  },
  eyeBtn: {
    position: 'absolute',
    right: SPACING.base,
    height: 48,
    justifyContent: 'center',
  },
  eyeIcon: {
    fontSize: 16,
  },
  errorText: {
    color: COLORS.live,
    fontSize: FONT_SIZE.body,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: COLORS.purple600,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  btnDisabled:    { opacity: 0.6 },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.bodyLg,
    fontWeight: FONT_WEIGHT.medium,
  },
  forgotBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  forgotText: {
    color: COLORS.purple400,
    fontSize: FONT_SIZE.body,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: SPACING.xxxl,
    alignItems: 'center',
  },
  footerText: {
    color: COLORS.textSub,
    fontSize: FONT_SIZE.body,
    textAlign: 'center',
  },
  footerLink: {
    color: COLORS.purple400,
  },
});
