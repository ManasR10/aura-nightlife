/**
 * AdminEditVenueScreen — venue admin enriches their venue profile.
 *
 * Editable fields (server enforced in adminUpdateVenue):
 *   openingNote, coverCharge, dressCode, ageLimit,
 *   instagramHandle, phone, website,
 *   bannerUrl, promotions[]
 *
 * Read-only (synced from Google Places):
 *   name, address, rating, opening hours
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import firestore from '@react-native-firebase/firestore';
import { fnSouth } from '../firebase/fns';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme';
import { IconBack, IconX } from '../components/Icon';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminEditVenue'>;

interface VenueAdminFields {
  instagramHandle: string;
  phone:           string;
  website:         string;
  dressCode:       string;
  ageLimit:        string;
  coverCharge:     string;
  openingNote:     string;
  bannerUrl:       string;
}

export function AdminEditVenueScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { venueId } = route.params;

  const [venueName,   setVenueName]   = useState('');
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [fields,      setFields]      = useState<VenueAdminFields>({
    instagramHandle: '',
    phone:           '',
    website:         '',
    dressCode:       '',
    ageLimit:        '',
    coverCharge:     '',
    openingNote:     '',
    bannerUrl:       '',
  });
  const [promotions,    setPromotions]    = useState<string[]>([]);
  const [promoInput,    setPromoInput]    = useState('');

  useEffect(() => {
    firestore().collection('venues').doc(venueId).get().then((snap) => {
      if (!snap.exists()) return;
      const d = snap.data()!;
      setVenueName(d.name ?? '');
      setFields({
        instagramHandle: d.instagramHandle ?? '',
        phone:           d.phone ?? '',
        website:         d.website ?? '',
        dressCode:       d.dressCode ?? '',
        ageLimit:        d.ageLimit  != null ? String(d.ageLimit)  : '',
        coverCharge:     d.coverCharge != null ? String(d.coverCharge) : '',
        openingNote:     d.openingNote ?? '',
        bannerUrl:       d.bannerUrl ?? '',
      });
      setPromotions(Array.isArray(d.promotions) ? d.promotions : []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [venueId]);

  function set(key: keyof VenueAdminFields, val: string) {
    setFields((prev) => ({ ...prev, [key]: val }));
  }

  function addPromo() {
    const trimmed = promoInput.trim();
    if (!trimmed) return;
    if (promotions.length >= 5) {
      Alert.alert('Limit reached', 'Maximum 5 promotions allowed.');
      return;
    }
    setPromotions((prev) => [...prev, trimmed]);
    setPromoInput('');
  }

  function removePromo(idx: number) {
    setPromotions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        instagramHandle: fields.instagramHandle.trim() || null,
        phone:           fields.phone.trim()           || null,
        website:         fields.website.trim()         || null,
        dressCode:       fields.dressCode.trim()       || null,
        ageLimit:        fields.ageLimit  ? Number(fields.ageLimit)     : null,
        coverCharge:     fields.coverCharge ? Number(fields.coverCharge) : null,
        openingNote:     fields.openingNote.trim() || null,
        bannerUrl:       fields.bannerUrl.trim()   || null,
        promotions:      promotions.filter(Boolean),
      };

      await fnSouth.httpsCallable('adminUpdateVenue')({ venueId, updates });
      Alert.alert('Saved ✓', 'Venue profile updated. Changes are live immediately.');
      navigation.goBack();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.purple400} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <IconBack size={22} color={COLORS.textSub} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{venueName}</Text>
        <Pressable style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color={COLORS.white} size="small" />
            : <Text style={styles.saveBtnText}>Save</Text>
          }
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* Tonight */}
        <SectionHeader label="Tonight" />
        <Field label="Opening Note">
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={fields.openingNote}
            onChangeText={(v) => set('openingNote', v)}
            placeholder="e.g. Guest list till 11 PM, free entry before 10"
            placeholderTextColor={COLORS.textMuted}
            multiline numberOfLines={3}
          />
        </Field>
        <Field label="Cover Charge (₹)">
          <TextInput
            style={styles.input}
            value={fields.coverCharge}
            onChangeText={(v) => set('coverCharge', v)}
            placeholder="0 = free entry"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numeric"
          />
        </Field>

        {/* Promotions */}
        <SectionHeader label="Promotions" topMargin />
        <Text style={styles.fieldHint}>
          Shown on the venue page under "Today's Promotions". Max 5 items.
        </Text>
        {promotions.map((promo, idx) => (
          <View key={idx} style={styles.promoRow}>
            <Text style={styles.promoText} numberOfLines={1}>{promo}</Text>
            <Pressable onPress={() => removePromo(idx)} hitSlop={8}>
              <IconX size={16} color={COLORS.textMuted} />
            </Pressable>
          </View>
        ))}
        {promotions.length < 5 && (
          <View style={styles.promoInputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={promoInput}
              onChangeText={setPromoInput}
              placeholder="e.g. Ladies night – free entry till 11 PM"
              placeholderTextColor={COLORS.textMuted}
              onSubmitEditing={addPromo}
              returnKeyType="done"
            />
            <Pressable style={styles.addBtn} onPress={addPromo}>
              <Text style={styles.addBtnText}>+ Add</Text>
            </Pressable>
          </View>
        )}

        {/* Policies */}
        <SectionHeader label="Policies" topMargin />
        <Field label="Dress Code">
          <TextInput
            style={styles.input}
            value={fields.dressCode}
            onChangeText={(v) => set('dressCode', v)}
            placeholder="e.g. Smart casual · No shorts"
            placeholderTextColor={COLORS.textMuted}
          />
        </Field>
        <Field label="Age Limit">
          <TextInput
            style={styles.input}
            value={fields.ageLimit}
            onChangeText={(v) => set('ageLimit', v)}
            placeholder="e.g. 21"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numeric"
          />
        </Field>

        {/* Branding */}
        <SectionHeader label="Branding" topMargin />
        <Field label="Banner Image URL">
          <TextInput
            style={styles.input}
            value={fields.bannerUrl}
            onChangeText={(v) => set('bannerUrl', v)}
            placeholder="https://cdn.yourvenue.com/banner.jpg"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
            keyboardType="url"
          />
        </Field>
        <Text style={styles.fieldHint}>
          Replaces the Google Places cover photo on your venue page. Use a high-quality landscape image (16:9 or wider).
        </Text>

        {/* Contact & Social */}
        <SectionHeader label="Contact & Social" topMargin />
        <Field label="Instagram">
          <TextInput
            style={styles.input}
            value={fields.instagramHandle}
            onChangeText={(v) => set('instagramHandle', v)}
            placeholder="@yourvenue"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
          />
        </Field>
        <Field label="Phone">
          <TextInput
            style={styles.input}
            value={fields.phone}
            onChangeText={(v) => set('phone', v)}
            placeholder="+91 98765 43210"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="phone-pad"
          />
        </Field>
        <Field label="Website">
          <TextInput
            style={styles.input}
            value={fields.website}
            onChangeText={(v) => set('website', v)}
            placeholder="https://yourvenue.com"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
            keyboardType="url"
          />
        </Field>

        <View style={styles.readOnlyNote}>
          <Text style={styles.readOnlyText}>
            Location, address, Google ratings, and opening hours are synced from Google Places and cannot be edited here.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionHeader({ label, topMargin }: { label: string; topMargin?: boolean }) {
  return <Text style={[styles.sectionLabel, topMargin && { marginTop: SPACING.lg }]}>{label.toUpperCase()}</Text>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center:    { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm,
  },
  backBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:     { flex: 1, color: COLORS.text, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
  saveBtn:   {
    backgroundColor: COLORS.purple600, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.sm, minWidth: 60, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { color: COLORS.white, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold },
  scroll:        { flex: 1 },
  scrollContent: { padding: SPACING.xl, gap: SPACING.base, paddingBottom: SPACING.xxxl },
  sectionLabel: {
    color: COLORS.textMuted, fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold, letterSpacing: 1, marginBottom: SPACING.xs,
  },
  fieldWrap:  { gap: SPACING.xs },
  fieldLabel: { color: COLORS.textSub, fontSize: FONT_SIZE.sm },
  fieldHint:  { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, lineHeight: 16 },
  input: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.base, paddingVertical: SPACING.sm,
    color: COLORS.text, fontSize: FONT_SIZE.body, minHeight: 44,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  // Promotions
  promoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, paddingHorizontal: SPACING.base, paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  promoText:     { flex: 1, color: COLORS.text, fontSize: FONT_SIZE.body },
  promoInputRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  addBtn: {
    backgroundColor: COLORS.purple600, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, alignItems: 'center',
  },
  addBtnText: { color: COLORS.white, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium },
  readOnlyNote: {
    marginTop: SPACING.xl, padding: SPACING.base,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
  },
  readOnlyText: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, lineHeight: 20 },
});
