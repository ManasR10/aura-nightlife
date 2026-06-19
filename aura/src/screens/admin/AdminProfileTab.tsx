import React, { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import { ChevronRight, MapPin, Mail, HelpCircle, LogOut, Key } from 'lucide-react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT, SPACING, RADIUS } from '../../theme';
import { useAuth } from '../../auth/useAuth';
import type { VenueOption } from '../AdminDashboardScreen';

interface Props { venues: VenueOption[] }

export function AdminProfileTab({ venues }: Props) {
  const insets  = useSafeAreaInsets();
  const { userDoc, venueAdminDoc, signOut } = useAuth();
  const [sendingReset, setSendingReset] = useState(false);

  const name    = userDoc?.displayName ?? venueAdminDoc?.email ?? 'Admin';
  const initial = name.charAt(0).toUpperCase();
  const email   = venueAdminDoc?.email ?? auth().currentUser?.email ?? '';

  async function handleResetPassword() {
    if (!email) { Alert.alert('No email on record'); return; }
    setSendingReset(true);
    try {
      await auth().sendPasswordResetEmail(email);
      Alert.alert('Reset email sent', `Check ${email} for a link to reset your password.`);
    } catch (err: unknown) {
      Alert.alert('Failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSendingReset(false);
    }
  }

  function handleContactSupport() {
    Linking.openURL('mailto:support@auraapp.in?subject=Venue Admin Support').catch(() =>
      Alert.alert('Contact', 'Reach us at support@auraapp.in'),
    );
  }

  return (
    <ScrollView
      style={[s.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Profile</Text>
      </View>

      {/* Identity card */}
      <View style={s.card}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initial}</Text>
        </View>
        <Text style={s.name}>{name}</Text>
        <Text style={s.email}>{email}</Text>
        <View style={s.adminBadge}>
          <Text style={s.adminBadgeText}>Venue Admin · {venues.length} venue{venues.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {/* Managed venues */}
      {venues.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>MANAGED VENUES</Text>
          {venues.map((v) => (
            <View key={v.id} style={s.venueRow}>
              <MapPin size={14} color={COLORS.purple400} />
              <Text style={s.venueName}>{v.name}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>ACCOUNT</Text>

        <Pressable
          style={s.actionRow}
          onPress={handleResetPassword}
          disabled={sendingReset}
        >
          <Key size={16} color="#9ca3af" />
          <Text style={s.actionLabel}>
            {sendingReset ? 'Sending reset email…' : 'Reset Password'}
          </Text>
          <ChevronRight size={16} color="#4b5563" />
        </Pressable>

        <Pressable style={s.actionRow} onPress={handleContactSupport}>
          <HelpCircle size={16} color="#9ca3af" />
          <Text style={s.actionLabel}>Contact Aura Support</Text>
          <ChevronRight size={16} color="#4b5563" />
        </Pressable>

        <Pressable style={s.actionRow} onPress={() => Linking.openURL('mailto:support@auraapp.in?subject=Venue Access Issue')}>
          <Mail size={16} color="#9ca3af" />
          <Text style={s.actionLabel}>Venue Access Issues</Text>
          <ChevronRight size={16} color="#4b5563" />
        </Pressable>
      </View>

      {/* Sign out */}
      <Pressable style={s.signOut} onPress={signOut}>
        <LogOut size={16} color="#6b7280" />
        <Text style={s.signOutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  header:    { paddingHorizontal: SPACING.base, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  title:     { color: COLORS.white, fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold },

  card: {
    margin: SPACING.base, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937',
    borderRadius: 16, padding: SPACING.xl, alignItems: 'center', gap: SPACING.sm,
  },
  avatar:      { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.purple700, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xs },
  avatarText:  { color: COLORS.white, fontSize: 28, fontWeight: FONT_WEIGHT.bold },
  name:        { color: COLORS.white, fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold },
  email:       { color: '#9ca3af', fontSize: FONT_SIZE.body },
  adminBadge:  { backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151', borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  adminBadgeText: { color: '#9ca3af', fontSize: FONT_SIZE.xs },

  section:      { marginHorizontal: SPACING.base, marginBottom: SPACING.base, gap: SPACING.xs },
  sectionLabel: { color: '#6b7280', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 0.8, marginBottom: 4 },

  venueRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937',
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.base, paddingVertical: SPACING.md,
  },
  venueName: { flex: 1, color: COLORS.white, fontSize: FONT_SIZE.body },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937',
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.base, paddingVertical: SPACING.md,
  },
  actionLabel: { flex: 1, color: '#d1d5db', fontSize: FONT_SIZE.body },

  signOut: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.base, borderWidth: 1, borderColor: '#1f2937',
    borderRadius: 12, height: 44, marginTop: SPACING.sm,
  },
  signOutText: { color: '#6b7280', fontSize: FONT_SIZE.body },
});
