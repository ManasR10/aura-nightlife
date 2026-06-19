/**
 * AdminHomeTab — venue operator home.
 *
 * Fixed:
 *   - Occupancy removed entirely
 *   - Buzz metric uses activeSignalCount with accurate copy
 *   - Venue switcher for multi-venue admins
 *   - Weekly analytics restored (impressions, check-ins, conversion, repeat)
 *   - Venue name/context received from parent (no redundant fetch)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import {
  CheckCircle, Video, ChevronDown, ChevronRight, Check,
} from 'lucide-react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../theme';
import { timeAgo } from '../../utils/time';
import type { RootStackParamList, VenueLive } from '../../types';
import type { VenueOption } from '../AdminDashboardScreen';
import auth from '@react-native-firebase/auth';

// Types

interface Props {
  navigation:    NativeStackNavigationProp<RootStackParamList, 'AdminDashboard'>;
  venue:         VenueOption;
  venues:        VenueOption[];
  onSwitchVenue: (idx: number) => void;
  onGoToFeed:    () => void;
}

interface SignalPost {
  signalId:    string;
  userId:      string;
  thumbnailUrl:string | null;
  vibeTag:     string | null;
  geoVerified: boolean;
  createdAt:   FirebaseFirestoreTypes.Timestamp;
}

interface WeeklyStats {
  impressions:    number;
  detailViews:    number;
  checkins:       number;
  uniqueUsers:    number;
  conversionRate: number;
  repeatRate:     number;
}

const QUICK_ACTIONS = [
  { emoji: '📹', label: 'Post Now',      action: 'upload'  },
  { emoji: '🔔', label: 'Notify Nearby', action: 'notify'  },
  { emoji: '🎁', label: 'Rewards',       action: 'rewards' },
  { emoji: '🎉', label: 'Events',        action: 'events'  },
];

function currentWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// Animated counter

function useCountAnim(target: number) {
  const anim    = useRef(new Animated.Value(0)).current;
  const prevRef = useRef(0);
  useEffect(() => {
    if (target === prevRef.current) return;
    prevRef.current = target;
    Animated.timing(anim, { toValue: target, duration: 900, useNativeDriver: false }).start();
  }, [target, anim]);
  return anim;
}

// Component

export function AdminHomeTab({ navigation, venue, venues, onSwitchVenue, onGoToFeed }: Props) {
  const insets = useSafeAreaInsets();

  const [live,       setLive]       = useState<VenueLive | null>(null);
  const [weekly,     setWeekly]     = useState<WeeklyStats | null>(null);
  const [recentClips, setRecentClips] = useState<SignalPost[]>([]);
  const [refreshing,  setRefreshing]  = useState(false);
  const [pickerOpen,  setPickerOpen]  = useState(false);

  const signalCount = live?.activeSignalCount ?? 0;
  const countAnim   = useCountAnim(signalCount);

  const venueId      = venue.id;
  const venueName    = venue.name;
  const initial      = venueName.charAt(0).toUpperCase() || '?';
  const venueAdminUid = auth().currentUser?.uid ?? '';

  const load = useCallback(async () => {
    if (!venueId) return;
    try {
      const now = firestore.Timestamp.now();

      const [liveSnap, weeklySnap, clipsSnap] = await Promise.all([
        firestore().collection('venueLive').doc(venueId).get(),
        firestore().collection('venueAnalyticsWeekly')
          .doc(`${venueId}_${currentWeekStart()}`)
          .get(),
        // Most recent 4 clips (any source) for the preview strip
        firestore().collection('liveSignals')
          .where('venueId',    '==', venueId)
          .where('signalType', '==', 'video')
          .where('expiresAt',  '>', now)
          .orderBy('expiresAt', 'desc')
          .limit(4)
          .get(),
      ]);

      if (liveSnap.exists()) setLive(liveSnap.data() as VenueLive);
      else setLive(null);

      setRecentClips(clipsSnap.docs.map((d) => ({
        signalId:    d.id,
        userId:      d.data().userId      ?? '',
        thumbnailUrl:d.data().thumbnailUrl ?? null,
        vibeTag:     d.data().vibeTag     ?? null,
        geoVerified: d.data().geoVerified ?? false,
        createdAt:   d.data().createdAt,
      })));

      if (weeklySnap.exists()) {
        const w = weeklySnap.data()!;
        setWeekly({
          impressions:    w.impressions    ?? 0,
          detailViews:    w.detailViews    ?? 0,
          checkins:       w.checkins       ?? 0,
          uniqueUsers:    w.uniqueUsers    ?? 0,
          conversionRate: w.conversionRate ?? 0,
          repeatRate:     w.repeatRate     ?? 0,
        });
      } else {
        setWeekly(null);
      }
    } catch (err) {
      console.warn('AdminHomeTab load error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [venueId]);

  useEffect(() => { load(); }, [load]);

  const vibeLabel = live?.vibeLabel ?? 'unknown';
  const timeStr   = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  function handleQuickAction(action: string) {
    switch (action) {
      case 'upload':  navigation.navigate('AdminUpload',    { venueId, venueName }); break;
      case 'notify':  navigation.navigate('AdminNotify',    { venueId, venueName }); break;
      case 'rewards': navigation.navigate('AdminRewards',   { venueId, venueName }); break;
      case 'edit':    navigation.navigate('AdminEditVenue', { venueId });            break;
      case 'events':  navigation.navigate('AdminEvents',    { venueId, venueName }); break;
    }
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={[s.content, { paddingTop: insets.top + SPACING.base }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          tintColor={COLORS.purple400}
        />
      }
    >
      {/* Venue identity bar */}
      <View style={s.identityBar}>
        <View style={{ flex: 1 }}>
          <Pressable
            style={s.identityNameRow}
            onPress={() => venues.length > 1 && setPickerOpen(true)}
            disabled={venues.length <= 1}
          >
            <Text style={s.identityName} numberOfLines={1}>{venueName || '—'}</Text>
            <CheckCircle size={16} color={COLORS.purple400} />
            {venues.length > 1 && <ChevronDown size={16} color="#9ca3af" />}
          </Pressable>
          <View style={s.adminBadge}>
            <Text style={s.adminBadgeText}>Venue Admin</Text>
          </View>
        </View>
        <View style={s.venueAvatar}>
          <Text style={s.venueAvatarText}>{initial}</Text>
        </View>
      </View>

      {/* Live status card */}
      <View style={s.liveCard}>
        <View style={s.liveCardTop}>
          <Text style={s.liveTime}>{timeStr} · Live</Text>
          <View style={[s.pulseDot, live?.isLiveNow && s.pulseDotActive]} />
        </View>

        <View style={s.buzzBlock}>
          <Animated.Text style={s.buzzNum}>
            {countAnim.interpolate({
              inputRange:  [0, Math.max(signalCount, 1)],
              outputRange: ['0', String(signalCount)],
            })}
          </Animated.Text>
          <Text style={s.buzzSub}>live clips & updates active now</Text>
          <Text style={s.buzzLabel}>
            {live?.isLiveNow ? '● Live right now' : 'No live signals yet tonight'}
          </Text>
        </View>

        {vibeLabel !== 'unknown' && (
          <View style={[s.vibeChip, {
            backgroundColor: vibeLabel === 'hot' ? '#f9731622' : vibeLabel === 'okay' ? '#34d39922' : '#6b728022',
            borderColor:     vibeLabel === 'hot' ? '#f97316aa' : vibeLabel === 'okay' ? '#34d399aa' : '#6b7280aa',
          }]}>
            <Text style={[s.vibeChipText, {
              color: vibeLabel === 'hot' ? '#fb923c' : vibeLabel === 'okay' ? '#34d399' : '#9ca3af',
            }]}>
              {vibeLabel === 'hot' ? '🔥 Hot' : vibeLabel === 'okay' ? '✅ Okay' : '😴 Slow'}
              {live?.vibeConfidence != null && live.vibeConfidence > 0
                ? `  ·  ${Math.round(live.vibeConfidence * 100)}% confidence`
                : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Quick actions */}
      <View style={s.quickGrid}>
        {QUICK_ACTIONS.map((qa) => (
          <Pressable
            key={qa.action}
            style={s.quickBtn}
            onPress={() => handleQuickAction(qa.action)}
          >
            <Text style={s.quickEmoji}>{qa.emoji}</Text>
            <Text style={s.quickLabel}>{qa.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Weekly analytics */}
      <View style={s.analyticsBlock}>
        <Text style={s.analyticsTitle}>This Week</Text>
        {weekly ? (
          <View style={s.metricsGrid}>
            <MetricCard emoji="👁" label="Profile Views" value={fmt(weekly.detailViews)}
              sub={`${fmt(weekly.impressions)} impressions`} />
            <MetricCard emoji="📍" label="Check-ins" value={fmt(weekly.checkins)}
              sub="verified arrivals" />
            <MetricCard emoji="👥" label="Unique Visitors" value={fmt(weekly.uniqueUsers)}
              sub="this week" />
            <MetricCard emoji="🔄" label="Repeat Rate"
              value={`${(weekly.repeatRate * 100).toFixed(0)}%`}
              sub="returning visitors"
              highlight={weekly.repeatRate > 0.3} />
            <MetricCard emoji="⚡" label="Conversion"
              value={`${(weekly.conversionRate * 100).toFixed(1)}%`}
              sub="views → check-ins"
              highlight={weekly.conversionRate > 0.05} />
            <MetricCard emoji="📣" label="Clicks Out" value={fmt(weekly.impressions > 0
              ? Math.round(weekly.detailViews / weekly.impressions * 100) : 0)}
              sub="% clicked venue card" />
          </View>
        ) : (
          <View style={s.noDataBox}>
            <Text style={s.noDataText}>Analytics appear after the first nightly rollup.</Text>
          </View>
        )}
      </View>

      {/* Recent clips strip */}
      <View style={s.sectionBlock}>
        <View style={s.sectionHd}>
          <Text style={s.sectionTitle}>Recent Clips</Text>
          <Pressable style={s.seeAllBtn} onPress={onGoToFeed}>
            <Text style={s.seeAllText}>View All</Text>
            <ChevronRight size={12} color={COLORS.purple400} />
          </Pressable>
        </View>

        {recentClips.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyCardText}>No active clips right now. Be the first to post.</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.thumbRow}>
            {recentClips.map((p) => (
              <ThumbCard
                key={p.signalId}
                post={p}
                byVenue={p.userId === venueAdminUid}
                venueLabel={venueName}
                onSeeAll={onGoToFeed}
              />
            ))}
          </ScrollView>
        )}
      </View>

      <View style={{ height: SPACING.xxxl }} />

      {/* Venue picker modal */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={s.pickerBackdrop} onPress={() => setPickerOpen(false)}>
          <View style={s.pickerSheet}>
            <View style={s.pickerHandle} />
            <Text style={s.pickerTitle}>Switch Venue</Text>
            {venues.map((v, i) => (
              <Pressable
                key={v.id}
                style={s.pickerRow}
                onPress={() => { onSwitchVenue(i); setPickerOpen(false); }}
              >
                <View style={s.pickerAvatar}>
                  <Text style={s.pickerAvatarText}>{v.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={s.pickerVenueName}>{v.name}</Text>
                {v.id === venueId && <Check size={16} color={COLORS.purple400} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

// Sub-components

function MetricCard({
  emoji, label, value, sub, highlight,
}: { emoji: string; label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <View style={[mc.card, highlight && mc.cardHighlight]}>
      <Text style={mc.emoji}>{emoji}</Text>
      <Text style={mc.label}>{label}</Text>
      <Text style={[mc.value, highlight && mc.valueHL]}>{value}</Text>
      <Text style={mc.sub}>{sub}</Text>
    </View>
  );
}
const mc = StyleSheet.create({
  card:       { width: '48%', backgroundColor: '#0d1117', borderRadius: RADIUS.md, borderWidth: 1, borderColor: '#1f2937', padding: SPACING.md, gap: 2 },
  cardHighlight:{ borderColor: COLORS.purple700, backgroundColor: COLORS.purpleBg10 },
  emoji:      { fontSize: 18, marginBottom: 2 },
  label:      { color: '#6b7280', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.medium },
  value:      { color: COLORS.white, fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, marginTop: 2 },
  valueHL:    { color: COLORS.purple400 },
  sub:        { color: '#4b5563', fontSize: FONT_SIZE.xs },
});

const VIBE_COLOR: Record<string, string> = { hot: '#f97316', okay: '#34d399', slow: '#9ca3af' };

function ThumbCard({
  post, byVenue, venueLabel, onSeeAll,
}: {
  post:        SignalPost;
  byVenue:     boolean;
  venueLabel:  string;
  onSeeAll?:   () => void;
}) {
  return (
    <Pressable style={tc.item} onPress={onSeeAll}>
      <View style={tc.img}>
        {post.thumbnailUrl ? (
          <Image source={{ uri: post.thumbnailUrl }} style={tc.imgInner} resizeMode="cover" />
        ) : (
          <View style={[tc.imgInner, { backgroundColor: '#1f2937', alignItems: 'center', justifyContent: 'center' }]}>
            <Video size={20} color="#4b5563" />
          </View>
        )}
        <View style={tc.topRow}>
          {byVenue ? (
            <View style={tc.officialBadge}><Text style={tc.officialText}>Official</Text></View>
          ) : (
            <View style={tc.guestBadge}><Text style={tc.guestText}>Guest</Text></View>
          )}
          {!byVenue && post.geoVerified && <View style={tc.geoDot} />}
        </View>
        {post.vibeTag && (
          <View style={[tc.vibeStrip, { backgroundColor: VIBE_COLOR[post.vibeTag] ?? '#6b7280' }]} />
        )}
      </View>
      <Text style={tc.user} numberOfLines={1}>
        {byVenue ? venueLabel : `@${post.userId.slice(0, 8)}`}
      </Text>
      <Text style={tc.time}>{timeAgo(post.createdAt)}</Text>
    </Pressable>
  );
}

const tc = StyleSheet.create({
  item:  { width: 112 },
  img:   { width: 112, height: 160, borderRadius: RADIUS.lg, backgroundColor: '#1f2937', overflow: 'hidden', marginBottom: 6, position: 'relative' },
  imgInner: { width: '100%', height: '100%' },
  topRow: { position: 'absolute', top: 6, left: 6, right: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  officialBadge: { backgroundColor: 'rgba(124,58,237,0.85)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  officialText:  { color: COLORS.white, fontSize: 8, fontWeight: FONT_WEIGHT.bold },
  guestBadge:    { backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  guestText:     { color: 'rgba(255,255,255,0.8)', fontSize: 8, fontWeight: FONT_WEIGHT.medium },
  geoDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  vibeStrip:     { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3 },
  user:  { color: COLORS.white, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.medium },
  time:  { color: '#6b7280', fontSize: 10 },
});

// Styles

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  content:   { paddingHorizontal: SPACING.base, gap: SPACING.base },

  identityBar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  identityNameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  identityName:    { color: COLORS.white, fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold, maxWidth: 200 },
  adminBadge: {
    alignSelf: 'flex-start', marginTop: 4,
    backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151',
    borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2,
  },
  adminBadgeText: { color: '#9ca3af', fontSize: 10, fontWeight: FONT_WEIGHT.medium },
  venueAvatar: {
    width: 44, height: 44, borderRadius: RADIUS.lg,
    backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151',
    alignItems: 'center', justifyContent: 'center',
  },
  venueAvatarText: { color: COLORS.white, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.bold },

  liveCard: {
    backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937',
    borderRadius: 16, padding: SPACING.xl, gap: SPACING.sm,
  },
  liveCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveTime:    { color: '#9ca3af', fontSize: FONT_SIZE.xs },
  pulseDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: '#374151' },
  pulseDotActive: { backgroundColor: '#22c55e' },
  buzzBlock:   { gap: 2 },
  buzzNum:     { color: COLORS.white, fontSize: 40, fontWeight: FONT_WEIGHT.bold, lineHeight: 48 },
  buzzSub:     { color: '#9ca3af', fontSize: FONT_SIZE.sm },
  buzzLabel:   { color: COLORS.purple400, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.medium },
  vibeChip: {
    alignSelf: 'flex-start', borderWidth: 1,
    borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 3,
  },
  vibeChipText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },

  quickGrid: { flexDirection: 'row', gap: SPACING.sm },
  quickBtn: {
    flex: 1, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937',
    borderRadius: RADIUS.lg, paddingVertical: SPACING.md, alignItems: 'center', gap: 5,
  },
  quickEmoji: { fontSize: 20 },
  quickLabel: { color: '#d1d5db', fontSize: 10, fontWeight: FONT_WEIGHT.medium, textAlign: 'center' },

  analyticsBlock: { gap: SPACING.sm },
  analyticsTitle: { color: '#9ca3af', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 1, textTransform: 'uppercase' },
  metricsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  noDataBox:      { backgroundColor: '#111827', borderRadius: RADIUS.md, padding: SPACING.base },
  noDataText:     { color: '#4b5563', fontSize: FONT_SIZE.sm, textAlign: 'center' },

  sectionBlock:   { gap: SPACING.sm },
  sectionHd:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  sectionTitle:   { color: COLORS.white, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold },
  sectionSub:     { color: '#6b7280', fontSize: 10 },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: 2 },
  seeAllBtn:      { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full, backgroundColor: '#1f2937' },
  seeAllText:     { color: COLORS.purple400, fontSize: FONT_SIZE.xs },
  postNowBtn:     { backgroundColor: COLORS.purple600, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full },
  postNowBtnText: { color: COLORS.white, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.medium },
  thumbRow:     { gap: SPACING.sm, paddingVertical: 2 },
  emptyCard:    { backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937', borderRadius: RADIUS.lg, padding: SPACING.xl, alignItems: 'center' },
  emptyCardText:{ color: '#9ca3af', fontSize: FONT_SIZE.sm, textAlign: 'center' },

  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: '#111827', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: SPACING.base, paddingBottom: 40, gap: SPACING.sm,
  },
  pickerHandle: { width: 36, height: 4, backgroundColor: '#374151', borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.sm },
  pickerTitle:  { color: COLORS.white, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.xs },
  pickerRow:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md, borderTopWidth: 1, borderTopColor: '#1f2937' },
  pickerAvatar: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#1f2937', alignItems: 'center', justifyContent: 'center' },
  pickerAvatarText: { color: COLORS.white, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  pickerVenueName:  { flex: 1, color: COLORS.white, fontSize: FONT_SIZE.body },
});
