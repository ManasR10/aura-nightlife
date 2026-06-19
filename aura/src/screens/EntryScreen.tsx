/**
 * EntryScreen — orchestrates the login/signup state machine and delegates
 * each sub-flow to a presentational component under components/auth/.
 *
 * Login mode:
 *   "Continue with Phone"  → phone OTP flow
 *   "Continue with Google" → Google sign-in
 *   Email + password inline → Log In / Forgot password
 *   "Not on Aura yet? Create account" toggle
 *   "Venue operator? Admin login →"
 *
 * Signup mode (4-step progress bar):
 *   1. Name  2. Birthday + Gender (MIN_AGE gate)  3. Phone  4. OTP
 */
import React, { useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { useAuth } from '../auth/useAuth';
import { getFirebaseErrorMessage, isFirebaseAuthCancellation } from '../utils/firebaseErrors';
import { authStyles as s } from '../components/auth/AuthPrimitives';
import {
  LoginMain,
  PhoneEntry,
  OtpEntry,
  ForgotEntry,
  ForgotSent,
} from '../components/auth/LoginFlow';
import { SignupFlow, type SignupStep } from '../components/auth/SignupFlow';
import { SeedAdminBtn } from '../components/auth/SeedAdminBtn';
import { meetsMinAge } from '../utils/age';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Entry'>;

type LoginSub = 'main' | 'phone' | 'otp' | 'forgot' | 'forgot_sent';

export function EntryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { sendOtp, confirmOtp, signInWithGoogle } = useAuth();

  const [mode,       setMode]       = useState<'login' | 'signup'>('login');
  const [loginSub,   setLoginSub]   = useState<LoginSub>('main');
  const [signupStep, setSignupStep] = useState<SignupStep>(0);

  // Login state
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [phone,    setPhone]    = useState('');
  const [otp,      setOtp]      = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // Signup form
  const [signupName,  setSignupName]  = useState('');
  const [birthDate,   setBirthDate]   = useState('');
  const [gender,      setGender]      = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupOtp,   setSignupOtp]   = useState('');

  const confirmRef = useRef<FirebaseAuthTypes.ConfirmationResult | null>(null);

  // Login actions

  async function handleLoginPhone() {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) { setError('Enter a valid 10-digit mobile number'); return; }
    setLoading(true); setError('');
    try {
      confirmRef.current = await sendOtp(phone.startsWith('+') ? phone : `+91${digits.slice(-10)}`);
      setLoginSub('otp');
    } catch (e) { setError(getFirebaseErrorMessage(e)); } finally { setLoading(false); }
  }

  async function handleLoginOtp() {
    if (otp.length !== 6) { setError('Enter the 6-digit code'); return; }
    if (!confirmRef.current) { setError('OTP expired. Resend.'); return; }
    setLoading(true); setError('');
    try { await confirmOtp(confirmRef.current, otp); }
    catch (e) { setError(getFirebaseErrorMessage(e)); } finally { setLoading(false); }
  }

  async function handleEmailLogin() {
    if (!email.trim() || !email.includes('@')) { setError('Enter a valid email'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true); setError('');
    try {
      const { default: fa } = await import('@react-native-firebase/auth');
      await fa().signInWithEmailAndPassword(email.trim(), password);
    } catch (e) { setError(getFirebaseErrorMessage(e)); } finally { setLoading(false); }
  }

  async function handleGoogle() {
    setLoading(true); setError('');
    try { await signInWithGoogle(); }
    catch (e: unknown) {
      if (isFirebaseAuthCancellation(e)) { setLoading(false); return; }
      setError(e instanceof Error ? e.message : 'Google sign-in failed.');
    } finally { setLoading(false); }
  }

  async function handleForgotPassword() {
    if (!email.trim() || !email.includes('@')) { setError('Enter your email first'); return; }
    setLoading(true); setError('');
    try {
      const { default: fa } = await import('@react-native-firebase/auth');
      await fa().sendPasswordResetEmail(email.trim());
      setLoginSub('forgot_sent');
    } catch (e) { setError(getFirebaseErrorMessage(e)); } finally { setLoading(false); }
  }

  // Signup actions

  async function handleSignupSendOtp() {
    const digits = signupPhone.replace(/\D/g, '');
    if (digits.length < 10) { setError('Enter a valid 10-digit number'); return; }
    setLoading(true); setError('');
    try {
      confirmRef.current = await sendOtp(`+91${digits.slice(-10)}`);
      setSignupStep(3);
    } catch (e) { setError(getFirebaseErrorMessage(e)); } finally { setLoading(false); }
  }

  async function handleSignupOtp() {
    if (signupOtp.length !== 6) { setError('Enter the 6-digit code'); return; }
    if (!confirmRef.current) { setError('OTP expired. Go back and resend.'); return; }
    setLoading(true); setError('');
    try {
      const result = await confirmOtp(confirmRef.current, signupOtp) as unknown as
        { user?: { updateProfile: (p: object) => Promise<void> } } | null;
      if (signupName.trim() && result?.user) {
        await result.user.updateProfile({ displayName: signupName.trim() }).catch(() => {});
      }
    } catch (e) { setError(getFirebaseErrorMessage(e)); } finally { setLoading(false); }
  }

  function signupStepValid(): boolean {
    if (signupStep === 0) return signupName.trim().length >= 2;
    if (signupStep === 1) return meetsMinAge(birthDate) && !!gender;
    if (signupStep === 2) return signupPhone.replace(/\D/g, '').length >= 10;
    if (signupStep === 3) return signupOtp.length === 6;
    return false;
  }

  function signupNext() {
    if (!signupStepValid()) return;
    if (signupStep === 2) { handleSignupSendOtp(); return; }
    if (signupStep === 3) { handleSignupOtp(); return; }
    setSignupStep((step) => (step + 1) as SignupStep);
    setError('');
  }

  function signupBack() {
    if (signupStep === 0) { setMode('login'); return; }
    if (signupStep === 3) { setSignupStep(2); setSignupOtp(''); setError(''); return; }
    setSignupStep((step) => (step - 1) as SignupStep);
    setError('');
  }

  // Render

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={[s.root, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.logoWrap}>
            <Text style={s.logoText}>aura</Text>
            <View style={s.logoBar} />
            <Text style={s.tagline}>Know before you go</Text>
          </View>

          {mode === 'signup' && (
            <SignupFlow
              step={signupStep}
              name={signupName}    onName={setSignupName}
              birthDate={birthDate} onBirthDate={setBirthDate}
              gender={gender}      onGender={setGender}
              phone={signupPhone}  onPhone={setSignupPhone}
              otp={signupOtp}      onOtp={setSignupOtp}
              valid={signupStepValid()}
              loading={loading}
              error={error}
              onBack={signupBack}
              onNext={signupNext}
            />
          )}

          {mode === 'login' && loginSub === 'main' && (
            <LoginMain
              email={email}         onEmail={setEmail}
              password={password}   onPassword={setPassword}
              showPass={showPass}   onTogglePass={() => setShowPass((v) => !v)}
              loading={loading}
              error={error}
              onPhone={() => { setLoginSub('phone'); setError(''); }}
              onGoogle={handleGoogle}
              onLogin={handleEmailLogin}
              onForgot={() => { setLoginSub('forgot'); setError(''); }}
              onSignup={() => { setMode('signup'); setError(''); }}
              onVenueLogin={() => navigation.navigate('VenueLogin')}
            />
          )}

          {mode === 'login' && loginSub === 'phone' && (
            <PhoneEntry
              phone={phone}
              onPhone={(t) => { setPhone(t); setError(''); }}
              loading={loading} error={error}
              onSend={handleLoginPhone}
              onBack={() => { setLoginSub('main'); setPhone(''); setError(''); }}
            />
          )}

          {mode === 'login' && loginSub === 'otp' && (
            <OtpEntry
              otp={otp}
              onOtp={(t) => { setOtp(t); setError(''); }}
              phone={phone}
              loading={loading} error={error}
              onVerify={handleLoginOtp}
              onBack={() => { setLoginSub('phone'); setOtp(''); setError(''); }}
            />
          )}

          {mode === 'login' && loginSub === 'forgot' && (
            <ForgotEntry
              email={email}
              onEmail={(t) => { setEmail(t); setError(''); }}
              loading={loading} error={error}
              onSend={handleForgotPassword}
              onBack={() => setLoginSub('main')}
            />
          )}

          {mode === 'login' && loginSub === 'forgot_sent' && (
            <ForgotSent
              email={email}
              onBack={() => { setLoginSub('main'); setPassword(''); setError(''); }}
            />
          )}

          <View style={s.legal}>
            <Text style={s.legalText}>By continuing, you agree to our </Text>
            <Pressable onPress={() => Linking.openURL('https://auraapp.in/terms')}>
              <Text style={[s.legalText, s.legalLink]}>Terms</Text>
            </Pressable>
            <Text style={s.legalText}> & </Text>
            <Pressable onPress={() => Linking.openURL('https://auraapp.in/privacy')}>
              <Text style={[s.legalText, s.legalLink]}>Privacy Policy</Text>
            </Pressable>
            <Text style={s.legalText}>.</Text>
          </View>

          {__DEV__ && <SeedAdminBtn />}
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
