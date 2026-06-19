/**
 * Login sub-flows: the main login screen, phone/OTP entry, and the
 * forgot-password flow. All are pure presentational components; the parent
 * EntryScreen owns the state and submit handlers.
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Eye, EyeOff, Phone, Mail, Lock } from 'lucide-react-native';
import { Field, PurpleBtn, BackBtn, GoogleG, authStyles as s } from './AuthPrimitives';
import { GOOGLE_WEB_CLIENT_ID } from '../../firebase/googleConfig';

const GOOGLE_AVAILABLE = !!GOOGLE_WEB_CLIENT_ID;

// ── LoginMain ─────────────────────────────────────────────────────────────────

interface LoginMainProps {
  email: string; onEmail: (v: string) => void;
  password: string; onPassword: (v: string) => void;
  showPass: boolean; onTogglePass: () => void;
  loading: boolean; error: string;
  onPhone: () => void; onGoogle: () => void; onLogin: () => void;
  onForgot: () => void; onSignup: () => void; onVenueLogin: () => void;
}

export function LoginMain({
  email, onEmail, password, onPassword, showPass, onTogglePass,
  loading, error, onPhone, onGoogle, onLogin, onForgot, onSignup, onVenueLogin,
}: LoginMainProps) {
  return (
    <View style={s.formWrap}>
      <View style={s.socialGroup}>
        <Pressable style={s.phoneBtn} onPress={onPhone}>
          <Phone size={18} color="#fff" />
          <Text style={s.phoneBtnText}>Continue with Phone</Text>
        </Pressable>

        {GOOGLE_AVAILABLE && (
          <Pressable style={[s.googleBtn, loading && s.disabled]} onPress={onGoogle} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#111" size="small" />
              : <>
                  <GoogleG />
                  <Text style={s.googleBtnText}>Continue with Google</Text>
                </>
            }
          </Pressable>
        )}
      </View>

      <View style={s.divider}>
        <View style={s.divLine} />
        <Text style={s.divText}>or</Text>
        <View style={s.divLine} />
      </View>

      <Field
        icon={<Mail size={16} color="#6b7280" />}
        placeholder="Email address"
        value={email} onChangeText={onEmail}
        keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
      />
      <View style={s.passRow}>
        <Field
          icon={<Lock size={16} color="#6b7280" />}
          placeholder="Password"
          value={password} onChangeText={onPassword}
          secureTextEntry={!showPass}
          style={{ flex: 1 }}
          onSubmitEditing={onLogin}
        />
        <Pressable style={s.eyeBtn} onPress={onTogglePass}>
          {showPass ? <EyeOff size={16} color="#6b7280" /> : <Eye size={16} color="#6b7280" />}
        </Pressable>
      </View>

      <Pressable onPress={onForgot} style={s.forgotRow}>
        <Text style={s.forgotText}>Forgot password?</Text>
      </Pressable>

      {error ? <Text style={s.errorText}>{error}</Text> : null}

      <PurpleBtn label="Log In" loading={loading} onPress={onLogin} />

      <Pressable onPress={onSignup} style={s.toggleRow}>
        <Text style={s.toggleText}>
          Not on Aura yet?{' '}
          <Text style={s.toggleLink}>Create account</Text>
        </Text>
      </Pressable>

      <View style={s.venueDivRow}>
        <View style={s.divLine} />
      </View>
      <Pressable onPress={onVenueLogin} style={s.venueRow}>
        <Text style={s.venueText}>
          Venue operator?{' '}
          <Text style={s.venueLink}>Admin login →</Text>
        </Text>
      </Pressable>
    </View>
  );
}

// ── PhoneEntry ────────────────────────────────────────────────────────────────

export function PhoneEntry({ phone, onPhone, loading, error, onSend, onBack }: {
  phone: string; onPhone: (v: string) => void;
  loading: boolean; error: string;
  onSend: () => void; onBack: () => void;
}) {
  return (
    <View style={s.formWrap}>
      <Text style={s.stepTitle}>Your phone number</Text>
      <Text style={s.stepSub}>We'll send a one-time code to verify.</Text>

      <View style={s.phoneInputRow}>
        <View style={s.countryCode}>
          <Text style={s.countryText}>🇮🇳 +91</Text>
        </View>
        <TextInput
          style={[s.input, { flex: 1 }]}
          placeholder="98765 43210"
          placeholderTextColor="#4b5563"
          value={phone}
          onChangeText={onPhone}
          keyboardType="phone-pad"
          maxLength={12}
          autoFocus
          onSubmitEditing={onSend}
        />
      </View>

      {error ? <Text style={s.errorText}>{error}</Text> : null}
      <PurpleBtn label="Send OTP" loading={loading} onPress={onSend} />
      <BackBtn onPress={onBack} />
    </View>
  );
}

// ── OtpEntry ──────────────────────────────────────────────────────────────────

export function OtpEntry({ otp, onOtp, phone, loading, error, onVerify, onBack }: {
  otp: string; onOtp: (v: string) => void; phone: string;
  loading: boolean; error: string;
  onVerify: () => void; onBack: () => void;
}) {
  const digits = phone.replace(/\D/g, '').slice(-10);
  return (
    <View style={s.formWrap}>
      <Text style={s.stepTitle}>Check your phone</Text>
      <Text style={s.stepSub}>
        Code sent to{' '}
        <Text style={{ color: '#fff', fontWeight: '600' }}>+91 {digits}</Text>
      </Text>

      <TextInput
        style={[s.input, s.otpInput]}
        placeholder="• • • • • •"
        placeholderTextColor="#4b5563"
        value={otp}
        onChangeText={(t) => onOtp(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
        onSubmitEditing={onVerify}
      />

      {error ? <Text style={s.errorText}>{error}</Text> : null}
      <PurpleBtn label="Verify & Enter" loading={loading} onPress={onVerify} />
      <BackBtn label="Wrong number? Change" onPress={onBack} />
    </View>
  );
}

// ── ForgotPassword ────────────────────────────────────────────────────────────

export function ForgotEntry({ email, onEmail, loading, error, onSend, onBack }: {
  email: string; onEmail: (v: string) => void;
  loading: boolean; error: string;
  onSend: () => void; onBack: () => void;
}) {
  return (
    <View style={s.formWrap}>
      <Text style={s.stepTitle}>Reset password</Text>
      <Text style={s.stepSub}>Enter your email and we'll send a reset link.</Text>
      <Field
        icon={<Mail size={16} color="#6b7280" />}
        placeholder="you@example.com"
        value={email} onChangeText={onEmail}
        keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
        autoFocus onSubmitEditing={onSend}
      />
      {error ? <Text style={s.errorText}>{error}</Text> : null}
      <PurpleBtn label="Send Reset Link" loading={loading} onPress={onSend} />
      <BackBtn onPress={onBack} />
    </View>
  );
}

export function ForgotSent({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <View style={[s.formWrap, { alignItems: 'center' }]}>
      <Text style={{ fontSize: 48 }}>📬</Text>
      <Text style={[s.stepTitle, { textAlign: 'center' }]}>Reset link sent</Text>
      <Text style={[s.stepSub, { textAlign: 'center' }]}>
        Check <Text style={{ color: '#fff' }}>{email}</Text> and follow the link.
      </Text>
      <PurpleBtn label="Back to Log In" loading={false} onPress={onBack} />
    </View>
  );
}
