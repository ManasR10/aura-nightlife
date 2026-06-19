/**
 * Shared visual primitives + stylesheet used across the EntryScreen auth flows
 * (login main, phone/OTP, forgot password, signup, dev seed).
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ArrowRight } from 'lucide-react-native';

// ── Palette ────────────────────────────────────────────────────────────────────

export const BG   = '#030712';
export const CARD = '#111827';
export const BDR  = '#1f2937';
export const PRP  = '#7c3aed';
export const PRP4 = '#a78bfa';
export const WHT  = '#ffffff';
export const GR4  = '#9ca3af';
export const GR5  = '#6b7280';

// ── Primitives ─────────────────────────────────────────────────────────────────

export function Field({
  icon, placeholder, value, onChangeText, style,
  keyboardType, autoCapitalize, autoCorrect, secureTextEntry,
  autoFocus, onSubmitEditing, hint,
}: {
  icon?: React.ReactNode;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  style?: StyleProp<ViewStyle>;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  secureTextEntry?: boolean;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
  hint?: string;
}) {
  return (
    <View style={[{ gap: 4 }, style]}>
      <View style={authStyles.fieldWrap}>
        {icon && <View style={authStyles.fieldIcon}>{icon}</View>}
        <TextInput
          style={[authStyles.input, icon ? authStyles.inputWithIcon : undefined]}
          placeholder={placeholder}
          placeholderTextColor="#4b5563"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'none'}
          autoCorrect={autoCorrect ?? false}
          secureTextEntry={secureTextEntry}
          autoFocus={autoFocus}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={onSubmitEditing ? 'done' : 'next'}
        />
      </View>
      {hint && <Text style={authStyles.hintText}>{hint}</Text>}
    </View>
  );
}

export function PurpleBtn({ label, loading, disabled, onPress, rightIcon }: {
  label: string; loading: boolean; disabled?: boolean;
  onPress: () => void; rightIcon?: boolean;
}) {
  return (
    <Pressable
      style={[authStyles.purpleBtn, (disabled || loading) && authStyles.purpleBtnDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading
        ? <ActivityIndicator color="#fff" />
        : <>
            <Text style={authStyles.purpleBtnText}>{label}</Text>
            {rightIcon && <ArrowRight size={16} color="#fff" style={{ marginLeft: 6 }} />}
          </>
      }
    </Pressable>
  );
}

export function BackBtn({ label = '← Back', onPress }: { label?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={authStyles.backBtn}>
      <Text style={authStyles.backBtnText}>{label}</Text>
    </Pressable>
  );
}

export function GoogleG() {
  return (
    <View style={authStyles.googleG}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: '#4285F4' }}>G</Text>
    </View>
  );
}

// ── Stylesheet ─────────────────────────────────────────────────────────────────

export const authStyles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 40 },

  logoWrap: { alignItems: 'center', marginBottom: 40 },
  logoText: { fontSize: 48, fontWeight: '800', color: WHT, letterSpacing: -1 },
  logoBar:  { width: 48, height: 4, backgroundColor: PRP, borderRadius: 2, marginTop: 8 },
  tagline:  { color: GR4, fontSize: 14, marginTop: 12 },

  formWrap: { gap: 14, marginBottom: 24 },

  progressRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  progressBars:     { flex: 1, flexDirection: 'row', gap: 6 },
  progressBar:      { flex: 1, height: 4, borderRadius: 2, backgroundColor: BDR },
  progressBarFilled:{ backgroundColor: PRP },

  stepTitle: { color: WHT, fontSize: 22, fontWeight: '700' },
  stepSub:   { color: GR4, fontSize: 14, lineHeight: 20 },

  phoneBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 48, borderRadius: 12, backgroundColor: PRP,
  },
  phoneBtnText: { color: WHT, fontSize: 15, fontWeight: '600' },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 48, borderRadius: 12, backgroundColor: WHT,
  },
  googleBtnText: { color: '#111', fontSize: 15, fontWeight: '600' },
  googleG: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#e8f0fe',
    alignItems: 'center', justifyContent: 'center',
  },
  socialGroup: { gap: 10 },
  disabled: { opacity: 0.6 },

  divider:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  divLine:  { flex: 1, height: 1, backgroundColor: BDR },
  divText:  { color: GR5, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },

  fieldWrap:    { position: 'relative', justifyContent: 'center' },
  fieldIcon:    { position: 'absolute', left: 14, zIndex: 1 },
  input: {
    backgroundColor: CARD, borderWidth: 1, borderColor: BDR,
    color: WHT, fontSize: 15, height: 48, borderRadius: 12, paddingHorizontal: 14,
  },
  inputWithIcon: { paddingLeft: 40 },
  hintText:      { color: GR5, fontSize: 12, marginLeft: 2 },

  passRow: { flexDirection: 'row', alignItems: 'center' },
  eyeBtn:  { position: 'absolute', right: 14, height: 48, justifyContent: 'center', zIndex: 1 },

  otpInput: { textAlign: 'center', letterSpacing: 10, fontSize: 22 },

  phoneInputRow: { flexDirection: 'row', gap: 10 },
  countryCode: {
    height: 48, borderRadius: 12, backgroundColor: CARD,
    borderWidth: 1, borderColor: BDR,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12,
  },
  countryText: { color: WHT, fontSize: 14, fontWeight: '600' },

  genderRow: { flexDirection: 'row', gap: 10 },
  genderBtn: {
    flex: 1, height: 44, borderRadius: 12, borderWidth: 1,
    borderColor: BDR, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  genderBtnActive:  { backgroundColor: PRP, borderColor: '#6d28d9' },
  genderText:       { color: GR4, fontSize: 14, fontWeight: '500' },
  genderTextActive: { color: WHT },

  forgotRow: { alignItems: 'flex-end', marginTop: -4 },
  forgotText:{ color: PRP4, fontSize: 13 },
  backBtn:   { alignItems: 'center', paddingVertical: 6 },
  backBtnText:{ color: GR5, fontSize: 14 },

  purpleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 48, borderRadius: 12, backgroundColor: PRP,
  },
  purpleBtnDisabled: { opacity: 0.4 },
  purpleBtnText:     { color: WHT, fontSize: 15, fontWeight: '600' },

  toggleRow: { alignItems: 'center', marginTop: 4 },
  toggleText:{ color: GR4, fontSize: 14 },
  toggleLink:{ color: PRP4, fontWeight: '600' },

  errorText: { color: '#f87171', fontSize: 13, textAlign: 'center' },

  venueDivRow: { marginVertical: 8 },
  venueRow:    { alignItems: 'center' },
  venueText:   { color: GR5, fontSize: 12 },
  venueLink:   { color: PRP4 },

  legal:    { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 24, marginBottom: 8 },
  legalText:{ color: GR5, fontSize: 12 },
  legalLink:{ textDecorationLine: 'underline', color: GR4 },

  seedBtn:  { marginTop: 16, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: BDR, borderRadius: 10, borderStyle: 'dashed' },
  seedText: { color: GR5, fontSize: 12 },
});
