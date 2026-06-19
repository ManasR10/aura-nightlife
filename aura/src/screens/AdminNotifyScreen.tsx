/**
 * AdminNotifyScreen — send a push notification to nearby Aura users.
 *
 * Matches the Lovable VenueNotify design:
 *   Free mode  — 1 organic push/night to followers + nearby users
 *   Boost mode — paid radius-targeted push (1 km → 5 km) with reach estimate
 *
 * Actual FCM dispatch wired to sendVenueNotification Cloud Function.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, CheckCircle } from 'lucide-react-native';
import firestore from '@react-native-firebase/firestore';
import { fnSouth } from '../firebase/fns';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminNotify'>;

type Mode = 'free' | 'boost';

const TEMPLATES = [
  "We're buzzing right now — come in 🔥",
  "Happy hours till 10PM tonight 🍸",
  "DJ live now — dance floor is open 🎵",
  "3 tables just opened up — book now",
  "Special offer tonight only ✨",
  "Write your own…",
];

const RADIUS_OPTIONS = [
  { km: 1, price: 299 },
  { km: 2, price: 399 },
  { km: 3, price: 499 },
  { km: 5, price: 699 },
];

export function AdminNotifyScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { venueId, venueName } = route.params;

  const [mode,             setMode]             = useState<Mode>('free');
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [customMessage,    setCustomMessage]    = useState('');
  const [selectedRadius,   setSelectedRadius]   = useState(0);
  const [sending,          setSending]          = useState(false);
  const [sent,             setSent]             = useState(false);
  const [error,            setError]            = useState('');
  const [followerCount,    setFollowerCount]    = useState<number | null>(null);
  const [boostReach,       setBoostReach]       = useState<number | null>(null);
  const [sentStats,        setSentStats]        = useState<{ sent: number; eligible: number } | null>(null);

  const message = selectedTemplate === 5 ? customMessage : TEMPLATES[selectedTemplate];
  const radius  = RADIUS_OPTIONS[selectedRadius];

  // Fetch real reach counts: saved users (free) + saved+recent check-ins (boost)
  useEffect(() => {
    if (!venueId) return;
    const cutoff = firestore.Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);
    Promise.all([
      firestore().collectionGroup('savedVenues').where('placeId', '==', venueId).count().get(),
      firestore().collection('checkInSessions')
        .where('venueId',    '==', venueId)
        .where('checkedInAt', '>=', cutoff)
        .count()
        .get(),
    ]).then(([savedSnap, recentSnap]) => {
      const saved  = savedSnap.data().count;
      const recent = recentSnap.data().count;
      setFollowerCount(saved);
      // Boost pool = saved + recent check-in users (some overlap, conservative estimate)
      setBoostReach(saved + Math.floor(recent * 0.6));
    }).catch(() => {});
  }, [venueId]);

  async function handleSend() {
    if (!message.trim()) { setError('Choose or write a message first.'); return; }
    setSending(true);
    setError('');
    try {
      const result = await fnSouth.httpsCallable('sendVenueNotification')({
        venueId,
        venueName,
        message: message.trim(),
        mode,
        radiusKm: mode === 'boost' ? radius.km : null,
      });
      const data = result.data as { sent: number; eligible: number };
      setSentStats({ sent: data.sent ?? 0, eligible: data.eligible ?? 0 });
      setSent(true);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? '';
      if (msg.includes('exhausted') || msg.includes('already sent')) {
        setError('2 free notifications already sent tonight. Resets at 3:30 AM.');
      } else {
        setError('Failed to send notification. Please try again.');
      }
    } finally {
      setSending(false);
    }
  }

  // ── Sent success screen ───────────────────────────────────────────────────

  if (sent) {
    return (
      <View style={[s.successScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <CheckCircle size={52} color={COLORS.purple400} />
        <Text style={s.successTitle}>Notification sent!</Text>
        <Text style={s.successSub}>
          {sentStats
            ? `Delivered to ${sentStats.sent} of ${sentStats.eligible} eligible users.`
            : mode === 'free' ? 'Sent to followers & nearby users.' : `Sent within ${radius.km} km.`}
        </Text>
        <Text style={s.successHint}>Track opens in Analytics.</Text>
        <Pressable style={s.doneBtn} onPress={() => navigation.goBack()}>
          <Text style={s.doneBtnText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  // ── Main screen ───────────────────────────────────────────────────────────

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={22} color="#9ca3af" />
        </Pressable>
        <Text style={s.headerTitle}>Notify</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}>

        {/* Mode toggle */}
        <View style={s.modeToggleWrap}>
          <View style={s.modeToggle}>
            <Pressable
              style={[s.modeBtn, mode === 'free' && s.modeBtnActive]}
              onPress={() => setMode('free')}
            >
              <Text style={[s.modeBtnText, mode === 'free' && s.modeBtnTextActive]}>Free Notification</Text>
            </Pressable>
            <Pressable
              style={[s.modeBtn, mode === 'boost' && s.modeBtnActive]}
              onPress={() => setMode('boost')}
            >
              <Text style={[s.modeBtnText, mode === 'boost' && s.modeBtnTextActive]}>Boost Push</Text>
            </Pressable>
          </View>
        </View>

        {/* Mode details */}
        <View style={s.modeCard}>
          {mode === 'free' ? (
            <>
              <Text style={s.modeCardTitle}>Organic — Send to followers & nearby users</Text>
              <Text style={s.modeCardSub}>2 free notifications per night — resets at 3:30 AM</Text>
              <Text style={s.modeCardReach}>
                {followerCount != null
                  ? `${followerCount} saved users + recent check-ins will receive this`
                  : 'Calculating reach…'}
              </Text>
            </>
          ) : (
            <>
              <Text style={s.modeCardTitle}>Boost — Reach People Nearby</Text>
              <Text style={s.modeCardSub}>Sends to Aura users within selected radius</Text>
              <View style={s.radiusRow}>
                {RADIUS_OPTIONS.map((r, i) => (
                  <Pressable
                    key={r.km}
                    style={[s.radiusBtn, selectedRadius === i && s.radiusBtnActive]}
                    onPress={() => setSelectedRadius(i)}
                  >
                    <Text style={[s.radiusBtnText, selectedRadius === i && s.radiusBtnTextActive]}>
                      {r.km} km
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={s.radiusFooter}>
                <Text style={s.reachText}>
                  {boostReach != null ? `~${boostReach} users eligible` : 'Calculating reach…'}
                </Text>
                <Text style={s.priceText}>₹{radius.price}</Text>
              </View>
            </>
          )}
        </View>

        {/* Templates */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Choose a message</Text>
          <View style={s.templateList}>
            {TEMPLATES.map((t, i) => (
              <Pressable
                key={i}
                style={[s.templateBtn, selectedTemplate === i && s.templateBtnActive]}
                onPress={() => setSelectedTemplate(i)}
              >
                <Text style={[s.templateText, selectedTemplate === i && s.templateTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </View>
          {selectedTemplate === 5 && (
            <TextInput
              style={s.customInput}
              placeholder="Type your message…"
              placeholderTextColor="#6b7280"
              value={customMessage}
              onChangeText={(t) => setCustomMessage(t.slice(0, 80))}
              maxLength={80}
              autoFocus
            />
          )}
        </View>

        {/* Preview */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Preview</Text>
          <View style={s.previewCard}>
            <View style={s.previewBubble}>
              <Text style={s.previewVenue}>{venueName}</Text>
              <Text style={s.previewMsg}>{message || 'Your message here…'}</Text>
              <Text style={s.previewCta}>Open in Aura</Text>
            </View>
          </View>
        </View>

        {error ? <Text style={s.errorText}>{error}</Text> : null}

      </ScrollView>

      {/* Send button */}
      <View style={[s.footer, { paddingBottom: insets.bottom + SPACING.sm }]}>
        <Pressable
          style={[s.sendBtn, sending && s.sendBtnDisabled]}
          onPress={handleSend}
          disabled={sending}
        >
          {sending
            ? <ActivityIndicator color={COLORS.white} />
            : (
              <Text style={s.sendBtnText}>
                {mode === 'free' ? 'Send to Followers' : `Send Boost — ₹${radius.price}`}
              </Text>
            )
          }
        </Pressable>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#030712' },
  successScreen: {
    flex: 1, backgroundColor: '#030712',
    alignItems: 'center', justifyContent: 'center',
    gap: SPACING.md, paddingHorizontal: SPACING.xxl,
  },
  successTitle: { color: COLORS.white,   fontSize: FONT_SIZE.xxl,  fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  successSub:   { color: '#9ca3af',     fontSize: FONT_SIZE.body, textAlign: 'center' },
  successHint:  { color: '#6b7280',     fontSize: FONT_SIZE.sm,   textAlign: 'center' },
  doneBtn: {
    marginTop: SPACING.sm, backgroundColor: COLORS.purple600,
    borderRadius: 12, paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.md,
  },
  doneBtnText: { color: COLORS.white, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: '#1f2937',
  },
  headerTitle: { color: COLORS.white, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.bold },

  scroll: { padding: SPACING.base, gap: SPACING.base },

  // Mode toggle
  modeToggleWrap: {},
  modeToggle: {
    flexDirection: 'row', backgroundColor: '#111827',
    borderRadius: 12, padding: 4, gap: 0,
  },
  modeBtn:          { flex: 1, paddingVertical: SPACING.sm, borderRadius: 10, alignItems: 'center' },
  modeBtnActive:    { backgroundColor: COLORS.purple600 },
  modeBtnText:      { color: '#9ca3af', fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
  modeBtnTextActive:{ color: COLORS.white },

  // Mode card
  modeCard: {
    backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937',
    borderRadius: 12, padding: SPACING.base, gap: SPACING.sm,
  },
  modeCardTitle: { color: COLORS.white,   fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold },
  modeCardSub:   { color: '#9ca3af',     fontSize: FONT_SIZE.sm },
  modeCardReach: { color: COLORS.purple400, fontSize: FONT_SIZE.xs },

  radiusRow: { flexDirection: 'row', gap: SPACING.sm },
  radiusBtn: {
    flex: 1, paddingVertical: SPACING.sm, borderRadius: 10,
    backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151',
    alignItems: 'center',
  },
  radiusBtnActive:    { backgroundColor: '#2e1065', borderColor: COLORS.purple500 + '66' },
  radiusBtnText:      { color: '#9ca3af',     fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.medium },
  radiusBtnTextActive:{ color: COLORS.purple400 },
  radiusFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reachText: { color: COLORS.purple400, fontSize: FONT_SIZE.xs },
  priceText: { color: COLORS.white,    fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold },

  // Templates
  section:      { gap: SPACING.sm },
  sectionLabel: { color: '#9ca3af', fontSize: FONT_SIZE.xs },
  templateList: { gap: SPACING.xs },
  templateBtn: {
    paddingVertical: 10, paddingHorizontal: SPACING.base,
    borderRadius: 12, borderWidth: 1, borderColor: '#1f2937',
    backgroundColor: '#111827',
  },
  templateBtnActive:  { backgroundColor: '#2e1065', borderColor: COLORS.purple500 + '66' },
  templateText:       { color: '#d1d5db', fontSize: FONT_SIZE.sm },
  templateTextActive: { color: COLORS.purple400 },
  customInput: {
    marginTop: SPACING.xs, backgroundColor: '#111827', borderWidth: 1, borderColor: '#374151',
    borderRadius: 12, paddingHorizontal: SPACING.base, paddingVertical: SPACING.md,
    color: COLORS.white, fontSize: FONT_SIZE.body,
  },

  // Preview
  previewCard:   { backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937', borderRadius: 12, padding: SPACING.base },
  previewBubble: { backgroundColor: '#1f2937', borderRadius: 10, padding: SPACING.md, gap: 3 },
  previewVenue:  { color: COLORS.white,   fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },
  previewMsg:    { color: '#d1d5db',     fontSize: FONT_SIZE.xs },
  previewCta:    { color: COLORS.purple400, fontSize: 10, marginTop: 2 },

  errorText: { color: COLORS.live, fontSize: FONT_SIZE.sm, textAlign: 'center' },

  footer: {
    paddingHorizontal: SPACING.base, paddingTop: SPACING.sm,
    borderTopWidth: 1, borderTopColor: '#1f2937', backgroundColor: '#030712',
  },
  sendBtn: {
    height: 48, backgroundColor: COLORS.purple600, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: COLORS.white, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
});
