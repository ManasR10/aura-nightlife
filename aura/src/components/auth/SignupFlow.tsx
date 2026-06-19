/**
 * Multi-step signup wizard: name → birthday + gender → phone → OTP.
 * Pure presentational; parent EntryScreen owns step state and submit handlers.
 */
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ArrowLeft, User } from 'lucide-react-native';
import { Field, PurpleBtn, authStyles as s } from './AuthPrimitives';
import { MIN_AGE } from '../../utils/age';

export type SignupStep = 0 | 1 | 2 | 3; // name | birthday+gender | phone | otp

export const SIGNUP_STEPS = [
  { title: "What's your name?",     sub: "This is how you'll show up on Aura." },
  { title: "When's your birthday?", sub: `You must be ${MIN_AGE}+ to use Aura.` },
  { title: 'Your phone number',     sub: "We'll verify it with a one-time code." },
  { title: 'Check your phone',      sub: 'Enter the 6-digit code we just sent.' },
];

const GENDERS = ['Male', 'Female', 'Other'];

interface SignupFlowProps {
  step: SignupStep;
  name: string;      onName: (v: string) => void;
  birthDate: string; onBirthDate: (v: string) => void;
  gender: string;    onGender: (v: string) => void;
  phone: string;     onPhone: (v: string) => void;
  otp: string;       onOtp: (v: string) => void;
  valid: boolean;    loading: boolean; error: string;
  onBack: () => void; onNext: () => void;
}

export function SignupFlow({
  step, name, onName, birthDate, onBirthDate, gender, onGender,
  phone, onPhone, otp, onOtp, valid, loading, error, onBack, onNext,
}: SignupFlowProps) {
  const info = SIGNUP_STEPS[step];
  const isLast = step === 3;

  return (
    <View style={s.formWrap}>
      <View style={s.progressRow}>
        <Pressable onPress={onBack} hitSlop={8}>
          <ArrowLeft size={20} color="#9ca3af" />
        </Pressable>
        <View style={s.progressBars}>
          {SIGNUP_STEPS.map((_, i) => (
            <View key={i} style={[s.progressBar, i <= step && s.progressBarFilled]} />
          ))}
        </View>
      </View>

      <Text style={s.stepTitle}>{info.title}</Text>
      <Text style={s.stepSub}>{info.sub}</Text>

      {step === 0 && (
        <Field
          icon={<User size={16} color="#6b7280" />}
          placeholder="Full name"
          value={name} onChangeText={onName}
          autoFocus onSubmitEditing={onNext}
        />
      )}

      {step === 1 && (
        <>
          <Field
            icon={<Text style={{ color: '#6b7280', fontSize: 14 }}>📅</Text>}
            placeholder="Date of birth"
            value={birthDate} onChangeText={onBirthDate}
            keyboardType="numbers-and-punctuation"
            autoFocus
            hint={`YYYY-MM-DD  ·  Must be ${MIN_AGE}+`}
          />
          <View style={s.genderRow}>
            {GENDERS.map((g) => (
              <Pressable
                key={g}
                style={[s.genderBtn, gender === g && s.genderBtnActive]}
                onPress={() => onGender(g)}
              >
                <Text style={[s.genderText, gender === g && s.genderTextActive]}>{g}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {step === 2 && (
        <View style={s.phoneInputRow}>
          <View style={s.countryCode}>
            <Text style={s.countryText}>🇮🇳 +91</Text>
          </View>
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="98765 43210"
            placeholderTextColor="#4b5563"
            value={phone} onChangeText={onPhone}
            keyboardType="phone-pad" maxLength={12} autoFocus
            onSubmitEditing={onNext}
          />
        </View>
      )}

      {step === 3 && (
        <TextInput
          style={[s.input, s.otpInput]}
          placeholder="• • • • • •"
          placeholderTextColor="#4b5563"
          value={otp}
          onChangeText={(t) => onOtp(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad" maxLength={6} autoFocus
          onSubmitEditing={onNext}
        />
      )}

      {error ? <Text style={s.errorText}>{error}</Text> : null}

      <PurpleBtn
        label={isLast ? 'Verify & Join' : step === 2 ? 'Send OTP' : 'Continue'}
        rightIcon={!isLast && step < 2}
        loading={loading}
        disabled={!valid}
        onPress={onNext}
      />
    </View>
  );
}
