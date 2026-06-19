/**
 * ProfileScreen — account hub.
 *
 * Three expandable sections (accordion):
 *   ♥  Saved Venues   — users/{uid}/savedVenues subcollection
 *   ◷  Check-in History — checkInSessions where uid == me, newest first
 *   ⚙  Settings       — edit displayName + UPI ID inline
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { useAuth } from '../auth/useAuth';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme';
import {
  IconSettings, IconGift, IconLogout, IconMapPin, IconBookmark, IconX,
} from '../components/Icon';
import {
  Stat, EmptyCard, AccordionSection, LevelDots,
  RewardStatusPill, RewardStatusBadge, ProgressBar,
} from '../components/profile/atoms';
import { SettingsPanel } from '../components/profile/SettingsPanel';

// Types

interface RewardItem {
  id:             string;
  emoji:          string;
  title:          string;
  value:          string;
  redemptionCode: string;
  status:         'active' | 'redeemed' | 'expired';
  createdAt:      FirebaseFirestoreTypes.Timestamp | null;
}

interface SavedVenue {
  placeId:   string;
  venueName: string;
  savedAt:   FirebaseFirestoreTypes.Timestamp;
}

interface CheckInHistoryItem {
  sessionId:    string;
  venueId:      string;
  venueName:    string;
  nightKey:     string;
  level:        0 | 1 | 2 | 3;
  rewardStatus: 'locked' | 'unlocked' | 'claimed';
}

type SectionKey = 'saved' | 'history' | 'settings' | null;

// Helpers

function formatNightKey(nightKey: string): string {
  const d = new Date(nightKey + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// Screen

interface Props {
  onNavigate: (venueId: string, venueName: string) => void;
}

export function ProfileScreen({ onNavigate }: Props) {
  const insets = useSafeAreaInsets();
  const { authUser, userDoc, signOut } = useAuth();

  // Core data
  const [rewards,      setRewards]      = useState<RewardItem[]>([]);
  const [checkinCount, setCheckinCount] = useState<number | null>(null);
  const [loadingCore,  setLoadingCore]  = useState(true);
  const [signingOut,   setSigningOut]   = useState(false);

  // Section state
  const [openSection, setOpenSection] = useState<SectionKey>(null);

  // Saved venues
  const [savedVenues,       setSavedVenues]       = useState<SavedVenue[]>([]);
  const [loadingSaved,      setLoadingSaved]      = useState(false);
  const [savedLoaded,       setSavedLoaded]       = useState(false);

  // Check-in history
  const [history,           setHistory]           = useState<CheckInHistoryItem[]>([]);
  const [loadingHistory,    setLoadingHistory]    = useState(false);
  const [historyLoaded,     setHistoryLoaded]     = useState(false);

  // Settings
  const [editName,  setEditName]  = useState('');
  const [saving,    setSaving]    = useState(false);

  // Load core data

  useEffect(() => {
    if (!authUser?.uid) return;
    const uid = authUser.uid;
    let cancelled = false;

    async function load() {
      try {
        const [rewardsSnap, checkinsSnap] = await Promise.all([
          firestore()
            .collection('rewardClaims')
            .where('uid', '==', uid)
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get(),
          firestore()
            .collection('checkInSessions')
            .where('uid', '==', uid)
            .count()
            .get(),
        ]);
        if (cancelled) return;
        setRewards(rewardsSnap.docs.map((d) => ({
          id:             d.id,
          emoji:          d.data().emoji          ?? '🎁',
          title:          d.data().title          ?? 'Aura Reward',
          value:          d.data().value          ?? '',
          redemptionCode: d.data().redemptionCode ?? '',
          status:         d.data().status         ?? 'active',
          createdAt:      d.data().createdAt      ?? null,
        })));
        setCheckinCount(checkinsSnap.data().count);
      } catch (err) {
        console.warn('ProfileScreen core load error:', err);
      } finally {
        if (!cancelled) setLoadingCore(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [authUser?.uid]);

  // Lazy-load section data when opened

  useEffect(() => {
    if (openSection === 'saved' && !savedLoaded && authUser?.uid) {
      setLoadingSaved(true);
      firestore()
        .collection('users').doc(authUser.uid).collection('savedVenues')
        .orderBy('savedAt', 'desc')
        .limit(30)
        .get()
        .then((snap) => {
          setSavedVenues(snap.docs.map((d) => ({
            placeId:   d.id,
            venueName: d.data().venueName ?? d.id,
            savedAt:   d.data().savedAt,
          })));
          setSavedLoaded(true);
        })
        .catch(() => {})
        .finally(() => setLoadingSaved(false));
    }
  }, [openSection, savedLoaded, authUser?.uid]);

  useEffect(() => {
    if (openSection === 'history' && !historyLoaded && authUser?.uid) {
      setLoadingHistory(true);
      firestore()
        .collection('checkInSessions')
        .where('uid', '==', authUser.uid)
        .orderBy('nightKey', 'desc')
        .limit(15)
        .get()
        .then((snap) => {
          setHistory(snap.docs.map((d) => {
            const data = d.data();
            return {
              sessionId:    d.id,
              venueId:      data.venueId ?? '',
              venueName:    data.venueName ?? data.venueId ?? 'Unknown venue',
              nightKey:     data.nightKey ?? '',
              level:        ([0, 1, 2, 3].includes(data.level) ? data.level : 0) as 0 | 1 | 2 | 3,
              rewardStatus: data.rewardStatus ?? 'locked',
            };
          }));
          setHistoryLoaded(true);
        })
        .catch(() => {})
        .finally(() => setLoadingHistory(false));
    }
  }, [openSection, historyLoaded, authUser?.uid]);

  useEffect(() => {
    if (openSection === 'settings') {
      setEditName(userDoc?.displayName ?? authUser?.displayName ?? '');
    }
  }, [openSection, userDoc, authUser?.displayName]);

  // Actions

  const toggleSection = useCallback((key: SectionKey) => {
    setOpenSection((cur) => (cur === key ? null : key));
  }, []);

  function unsaveVenue(placeId: string) {
    if (!authUser?.uid) return;
    setSavedVenues((prev) => prev.filter((v) => v.placeId !== placeId));
    firestore()
      .collection('users').doc(authUser.uid).collection('savedVenues').doc(placeId)
      .delete().catch(() => {});
  }

  async function handleSaveSettings() {
    if (!authUser?.uid) return;
    const name = editName.trim();
    if (!name) { Alert.alert('Name cannot be empty'); return; }
    setSaving(true);
    try {
      await firestore().collection('users').doc(authUser.uid).update({
        displayName: name,
      });
      setOpenSection(null);
    } catch {
      Alert.alert('Save failed', 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try { await signOut(); } finally { setSigningOut(false); }
  }

  // Derived

  const userName      = userDoc?.displayName || authUser?.displayName || 'Aura User';
  const initials      = userName.trim()?.[0]?.toUpperCase() ?? 'A';
  const checkinsDone  = checkinCount ?? 0;
  const level         = Math.min(Math.floor(checkinsDone / 5) + 1, 10);
  const inLevelDone   = checkinsDone % 5;

  // Render

  return (
    <ScrollView
      style={[s.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ padding: SPACING.base, paddingBottom: insets.bottom + 90 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={s.pageHeader}>
        <Text style={s.pageTitle}>Profile</Text>
        <Pressable
          style={s.settingsBtn}
          onPress={() => toggleSection('settings')}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <IconSettings size={22} color={openSection === 'settings' ? COLORS.purple400 : COLORS.text} />
        </Pressable>
      </View>

      {/* Profile card */}
      <View style={s.profileCard}>
        <View style={s.profileTop}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={s.profileInfo}>
            <Text style={s.profileName}>{userName}</Text>
            <Text style={s.profileSub}>{authUser?.phoneNumber ?? authUser?.email ?? 'Account verified'}</Text>
          </View>
        </View>

        <View style={s.progressBlock}>
          <View style={s.progressHeader}>
            <Text style={s.progressLabel}>Level {level} · Check-in Progress</Text>
            <Text style={s.progressPoints}>{inLevelDone}/5</Text>
          </View>
          <ProgressBar progress={inLevelDone / 5} />
          <Text style={s.progressHint}>{5 - inLevelDone} more check-ins to Level {Math.min(level + 1, 10)}</Text>
        </View>

        <View style={s.statsRow}>
          <Stat value={String(checkinsDone)} label="Check-ins" />
          <View style={s.statDivider} />
          <Stat value={String(rewards.length)} label="Rewards" />
          <View style={s.statDivider} />
          <Stat value={String(level)} label="Level" />
        </View>
      </View>

      {/* Recent Rewards */}
      <View style={s.section}>
        <View style={s.sectionHd}>
          <IconGift size={18} color={COLORS.purple400} />
          <Text style={s.sectionTitle}>Recent Rewards</Text>
        </View>
        {loadingCore ? (
          <ActivityIndicator color={COLORS.purple400} style={{ marginTop: SPACING.md }} />
        ) : rewards.length === 0 ? (
          <EmptyCard text="No rewards yet. Complete a 3-step check-in at a venue to earn your first reward." />
        ) : (
          <View style={s.list}>
            {rewards.map((r) => (
              <View key={r.id} style={s.rewardRow}>
                <Text style={s.rewardEmoji}>{r.emoji}</Text>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={s.rewardAmt}>{r.title}</Text>
                  <Text style={s.rewardUpi}>{r.value}</Text>
                  {r.redemptionCode ? (
                    <Text style={s.rewardCode}>{r.redemptionCode}</Text>
                  ) : null}
                </View>
                <RewardStatusPill status={r.status} />
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Saved Venues */}
      <AccordionSection
        icon={<IconBookmark size={18} color={COLORS.purple400} />}
        title="Saved Venues"
        badge={savedLoaded ? savedVenues.length : undefined}
        open={openSection === 'saved'}
        onToggle={() => toggleSection('saved')}
      >
        {loadingSaved ? (
          <ActivityIndicator color={COLORS.purple400} style={{ marginVertical: SPACING.md }} />
        ) : savedVenues.length === 0 ? (
          <EmptyCard text="No saved venues yet. Bookmark venues from Explore." />
        ) : (
          <View style={s.list}>
            {savedVenues.map((v) => (
              <Pressable
                key={v.placeId}
                style={s.venueRow}
                onPress={() => onNavigate(v.placeId, v.venueName)}
                accessibilityRole="button"
              >
                <IconMapPin size={14} color={COLORS.purple400} />
                <Text style={s.venueRowName} numberOfLines={1}>{v.venueName}</Text>
                <Pressable
                  onPress={() => unsaveVenue(v.placeId)}
                  hitSlop={8}
                  style={s.unsaveBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Remove from saved"
                >
                  <IconX size={14} color={COLORS.textMuted} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        )}
      </AccordionSection>

      {/* Check-in History */}
      <AccordionSection
        icon={<Text style={s.sectionIconText}>◷</Text>}
        title="Check-in History"
        badge={historyLoaded ? history.length : undefined}
        open={openSection === 'history'}
        onToggle={() => toggleSection('history')}
      >
        {loadingHistory ? (
          <ActivityIndicator color={COLORS.purple400} style={{ marginVertical: SPACING.md }} />
        ) : history.length === 0 ? (
          <EmptyCard text="No check-ins yet. Visit a venue and tap Check In & Earn." />
        ) : (
          <View style={s.list}>
            {history.map((item) => (
              <Pressable
                key={item.sessionId}
                style={s.historyRow}
                onPress={() => onNavigate(item.venueId, item.venueName)}
                accessibilityRole="button"
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.historyVenue} numberOfLines={1}>{item.venueName}</Text>
                  <Text style={s.historyDate}>{formatNightKey(item.nightKey)}</Text>
                </View>
                <View style={s.historyRight}>
                  <LevelDots level={item.level} />
                  <RewardStatusBadge status={item.rewardStatus} />
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </AccordionSection>

      {/* Settings */}
      <AccordionSection
        icon={<IconSettings size={18} color={COLORS.purple400} />}
        title="Settings"
        open={openSection === 'settings'}
        onToggle={() => toggleSection('settings')}
      >
        <SettingsPanel
          authUser={authUser}
          userDoc={userDoc}
          editName={editName}   setEditName={setEditName}
          saving={saving}
          onSave={handleSaveSettings}
        />
      </AccordionSection>

      {/* Sign out */}
      <Pressable
        style={s.signOutBtn}
        onPress={handleSignOut}
        disabled={signingOut}
        accessibilityRole="button"
      >
        <IconLogout size={18} color={COLORS.textSub} />
        <Text style={s.signOutText}>{signingOut ? 'Signing out…' : 'Sign Out'}</Text>
      </Pressable>
    </ScrollView>
  );
}

// Styles

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xl },
  pageTitle:  { color: COLORS.text, fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold },
  settingsBtn:{ padding: SPACING.xs },

  // Profile card
  profileCard: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.xl, marginBottom: SPACING.xl, gap: SPACING.base,
  },
  profileTop:       { flexDirection: 'row', alignItems: 'center', gap: SPACING.base },
  avatar:           { width: 64, height: 64, borderRadius: RADIUS.full, backgroundColor: COLORS.purple700, alignItems: 'center', justifyContent: 'center' },
  avatarText:       { color: COLORS.white, fontSize: FONT_SIZE.display, fontWeight: FONT_WEIGHT.bold },
  profileInfo:      { flex: 1, gap: 4 },
  profileName:      { color: COLORS.text,    fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold },
  profileSub:       { color: COLORS.textSub, fontSize: FONT_SIZE.body },
  profileUpi:       { color: COLORS.textMuted, fontSize: FONT_SIZE.base },
  profileUpiMissing:{ color: COLORS.warning,   fontSize: FONT_SIZE.base },
  progressBlock:    { backgroundColor: COLORS.borderLight, borderRadius: RADIUS.sm, padding: SPACING.base, gap: SPACING.sm },
  progressHeader:   { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel:    { color: COLORS.textSub,  fontSize: FONT_SIZE.body },
  progressPoints:   { color: COLORS.purple400, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium },
  progressHint:     { color: COLORS.textSub,  fontSize: FONT_SIZE.base, marginTop: 2 },
  statsRow:         { flexDirection: 'row', backgroundColor: COLORS.borderLight, borderRadius: RADIUS.sm, padding: SPACING.base },
  stat:             { flex: 1, alignItems: 'center', gap: 2 },
  statDivider:      { width: 1, backgroundColor: COLORS.border },
  statNum:          { color: COLORS.purple400, fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold },
  statLbl:          { color: COLORS.textSub, fontSize: FONT_SIZE.base },

  // Rewards section
  section:    { marginBottom: SPACING.xl },
  sectionHd:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  sectionTitle:    { color: COLORS.text, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
  sectionIconText: { color: COLORS.purple400, fontSize: 18, width: 18, textAlign: 'center' },
  list:       { gap: SPACING.sm },
  rewardRow:  {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, padding: SPACING.base,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  rewardEmoji:{ fontSize: 24, marginRight: SPACING.sm },
  rewardAmt:  { color: COLORS.text,    fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
  rewardUpi:  { color: COLORS.textSub, fontSize: FONT_SIZE.body },
  rewardCode: { color: COLORS.purple400, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, letterSpacing: 2, fontFamily: 'monospace' },
  paidBadge:  { backgroundColor: '#052e16', borderWidth: 1, borderColor: '#16a34a', paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  paidBadgeText: { color: '#4ade80', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.medium },

  emptyCard:     { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.xl, alignItems: 'center' },
  emptyCardText: { color: COLORS.textSub, fontSize: FONT_SIZE.body, textAlign: 'center', lineHeight: 22 },

  // Accordion
  accordionWrap: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, marginBottom: SPACING.sm, overflow: 'hidden' },
  accordionHd:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.base },
  accordionLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  accordionTitle:{ color: COLORS.text, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
  accordionBadge:{ backgroundColor: COLORS.purpleBg10, borderWidth: 1, borderColor: COLORS.purple700, paddingHorizontal: 6, paddingVertical: 1, borderRadius: RADIUS.full },
  accordionBadgeText: { color: COLORS.purple400, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },
  accordionBody: { paddingHorizontal: SPACING.base, paddingBottom: SPACING.base, borderTopWidth: 1, borderTopColor: COLORS.border },

  // Saved venues
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  venueRowName: { flex: 1, color: COLORS.text, fontSize: FONT_SIZE.body },
  unsaveBtn: { padding: 4 },

  // Check-in history
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm },
  historyVenue: { color: COLORS.text,    fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium },
  historyDate:  { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  historyRight: { gap: SPACING.xs, alignItems: 'flex-end' },
  levelDots:   { flexDirection: 'row', gap: 4 },
  dot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  dotFilled:   { backgroundColor: COLORS.purple500 },
  statusBadge: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.full },
  statusBadgeText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.medium },

  // Settings form
  settingsForm: { gap: SPACING.base, paddingTop: SPACING.md },
  field:        { gap: SPACING.xs },
  fieldLabel:   { color: COLORS.textSub, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
  fieldInput: {
    height: 44, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, paddingHorizontal: SPACING.base,
    color: COLORS.text, fontSize: FONT_SIZE.body,
  },
  saveBtn: {
    height: 44, backgroundColor: COLORS.purple600, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center', marginTop: SPACING.xs,
  },
  btnDisabled: { opacity: 0.5 },
  saveBtnText: { color: COLORS.white, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },

  // Sign out
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm,
    height: 44, gap: SPACING.sm, marginTop: SPACING.base,
  },
  signOutText: { color: COLORS.textSub, fontSize: FONT_SIZE.bodyLg },
});
