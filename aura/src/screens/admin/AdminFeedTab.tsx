/**
 * AdminFeedTab — venue operator's video feed.
 *
 * Sub-tabs:
 *   Guest Posts  — videos posted by users (sourceType: 'user') at this venue
 *   Our Posts    — videos posted by the venue admin (sourceType: 'admin')
 *
 * Filters:
 *   Tonight   — last 18 h, sorted newest first
 *   This Week — last 7 days, sorted most-viewed first
 *   All Time  — all signals, sorted most-viewed first
 *
 * Tap any thumbnail → full-screen video player modal.
 * Viewing a video increments its viewCount (only field admins can update).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import Video from 'react-native-video';
import { Eye, X, CheckCircle, Video as VideoIcon, Trash2 } from 'lucide-react-native';
import { fnSouth } from '../../firebase/fns';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../theme';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Signal {
  signalId:    string;
  venueId:     string;
  userId:      string;
  sourceType:  'user' | 'admin';
  thumbnailUrl:string | null;
  mediaUrl:    string | null;
  vibeTag:     string | null;
  geoVerified: boolean;
  viewCount:   number;
  createdAt:   FirebaseFirestoreTypes.Timestamp;
  expiresAt:   FirebaseFirestoreTypes.Timestamp;
}

type SubTab  = 'guest' | 'venue';
type Filter  = 'tonight' | 'week' | 'all';

const { width: SW, height: SH } = Dimensions.get('window');
const THUMB_W = (SW - SPACING.base * 2 - SPACING.sm) / 2;
const THUMB_H = THUMB_W * (16 / 9);

const TONIGHT_MS = 18  * 60 * 60 * 1000;
const WEEK_MS    = 7   * 24 * 60 * 60 * 1000;

import { timeAgo as minsAgo } from '../../utils/time';

function fmtViews(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props { venueId: string; requestedSubTab?: SubTab }

export function AdminFeedTab({ venueId, requestedSubTab }: Props) {
  const insets = useSafeAreaInsets();

  const [subTab,     setSubTab]     = useState<SubTab>('guest');

  // Reset sub-tab when the parent requests a specific one (e.g. navigating from Home)
  useEffect(() => {
    if (requestedSubTab) setSubTab(requestedSubTab);
  }, [requestedSubTab]);
  const [filter,     setFilter]     = useState<Filter>('tonight');
  const [allSignals, setAllSignals] = useState<Signal[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Video modal
  const [activeSignal, setActiveSignal] = useState<Signal | null>(null);
  const [paused,       setPaused]       = useState(true);
  const [errored,      setErrored]      = useState(false);
  const prevId = useRef<string | null>(null);

  // ── Load all video signals for this venue once ────────────────────────────

  const loadSignals = useCallback(async () => {
    if (!venueId) { setLoading(false); return; }
    try {
      // Fetch all videos — filter + sort client-side to avoid composite index
      const snap = await firestore()
        .collection('liveSignals')
        .where('venueId',    '==', venueId)
        .where('signalType', '==', 'video')
        .limit(200)
        .get();

      setAllSignals(snap.docs.map((d) => ({
        signalId:    d.id,
        venueId:     d.data().venueId     ?? '',
        userId:      d.data().userId      ?? '',
        sourceType:  d.data().sourceType  ?? 'user',
        thumbnailUrl:d.data().thumbnailUrl ?? null,
        mediaUrl:    d.data().mediaUrl    ?? null,
        vibeTag:     d.data().vibeTag     ?? null,
        geoVerified: d.data().geoVerified ?? false,
        viewCount:   d.data().viewCount   ?? 0,
        createdAt:   d.data().createdAt,
        expiresAt:   d.data().expiresAt,
      } as Signal)));
    } catch (err) {
      console.warn('AdminFeedTab load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [venueId]);

  useEffect(() => { loadSignals(); }, [loadSignals]);

  // ── Derived list based on sub-tab + filter ────────────────────────────────

  const displayList: Signal[] = (() => {
    const sourceType = subTab === 'guest' ? 'user' : 'admin';
    let items = allSignals.filter((s) => s.sourceType === sourceType);

    const now = Date.now();
    if (filter === 'tonight') {
      items = items.filter((s) => s.createdAt.toMillis() >= now - TONIGHT_MS);
      items.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()); // newest first
    } else if (filter === 'week') {
      items = items.filter((s) => s.createdAt.toMillis() >= now - WEEK_MS);
      items.sort((a, b) => (b.viewCount - a.viewCount) || (b.createdAt.toMillis() - a.createdAt.toMillis()));
    } else {
      items.sort((a, b) => (b.viewCount - a.viewCount) || (b.createdAt.toMillis() - a.createdAt.toMillis()));
    }

    return items;
  })();

  // ── Open video + increment viewCount ──────────────────────────────────────

  function openVideo(signal: Signal) {
    setPaused(true);
    setErrored(false);
    setActiveSignal(signal);

    // Increment view count — only viewCount field, allowed by Firestore rule
    firestore().collection('liveSignals').doc(signal.signalId)
      .update({ viewCount: firestore.FieldValue.increment(1) })
      .then(() => {
        // Update local state so count reflects immediately
        setAllSignals((prev) =>
          prev.map((s) => s.signalId === signal.signalId ? { ...s, viewCount: s.viewCount + 1 } : s),
        );
      })
      .catch(() => {});
  }

  function closeVideo() {
    setPaused(true);
    setActiveSignal(null);
  }

  // Reset player state when signal changes
  if (activeSignal?.signalId !== prevId.current) {
    prevId.current = activeSignal?.signalId ?? null;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>

      {/* ── Sub-tab row ────────────────────────────────────────────────── */}
      <View style={s.subTabRow}>
        {(['guest', 'venue'] as SubTab[]).map((tab) => (
          <Pressable
            key={tab}
            style={[s.subTab, subTab === tab && s.subTabActive]}
            onPress={() => setSubTab(tab)}
          >
            <Text style={[s.subTabText, subTab === tab && s.subTabTextActive]}>
              {tab === 'guest' ? 'Guest Posts' : 'Our Posts'}
            </Text>
            {subTab === tab && <View style={s.subTabIndicator} />}
          </Pressable>
        ))}
      </View>

      {/* ── Filter chips ──────────────────────────────────────────────── */}
      <View style={s.filterRow}>
        {(['tonight', 'week', 'all'] as Filter[]).map((f) => (
          <Pressable
            key={f}
            style={[s.filterChip, filter === f && s.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterChipText, filter === f && s.filterChipTextActive]}>
              {f === 'tonight' ? 'Tonight' : f === 'week' ? 'This Week' : 'All Time'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Content ───────────────────────────────────────────────────── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={COLORS.purple400} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.grid}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadSignals(); }}
              tintColor={COLORS.purple400}
            />
          }
        >
          {displayList.length === 0 ? (
            <View style={s.emptyWrap}>
              <VideoIcon size={36} color="#374151" />
              <Text style={s.emptyTitle}>
                {filter === 'tonight'
                  ? `No ${subTab === 'guest' ? 'guest' : 'venue'} posts tonight yet`
                  : `No ${subTab === 'guest' ? 'guest' : 'venue'} posts in this period`}
              </Text>
              {subTab === 'guest' && (
                <Text style={s.emptySub}>Posts appear when users check in and share clips.</Text>
              )}
            </View>
          ) : (
            <View style={s.gridRow}>
              {displayList.map((sig) => (
                <Pressable
                  key={sig.signalId}
                  style={[s.thumb, { width: THUMB_W, height: THUMB_H }]}
                  onPress={() => openVideo(sig)}
                >
                  {sig.thumbnailUrl ? (
                    <Image source={{ uri: sig.thumbnailUrl }} style={s.thumbImg} resizeMode="cover" />
                  ) : (
                    <View style={[s.thumbImg, s.thumbFallback]}>
                      <VideoIcon size={24} color="#4b5563" />
                    </View>
                  )}

                  {/* Overlays */}
                  <View style={s.thumbScrim} />

                  {/* Top row: badges + delete (admin posts only) */}
                  <View style={s.thumbTopRow}>
                    {sig.geoVerified && (
                      <View style={s.geoBadge}>
                        <CheckCircle size={10} color="#4ade80" />
                      </View>
                    )}
                    {sig.vibeTag && (
                      <View style={s.vibePill}>
                        <Text style={s.vibePillText}>
                          {sig.vibeTag === 'hot' ? '🔥' : sig.vibeTag === 'okay' ? '✅' : '😴'}
                        </Text>
                      </View>
                    )}
                    {subTab === 'venue' && (
                      <Pressable
                        style={s.deleteBtn}
                        hitSlop={8}
                        onPress={() => {
                          Alert.alert('Delete this post?', 'It will be removed from the feed immediately.', [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete', style: 'destructive',
                              onPress: async () => {
                                try {
                                  await fnSouth.httpsCallable('deleteSignal')({ signalId: sig.signalId });
                                  setAllSignals((prev) => prev.filter((s) => s.signalId !== sig.signalId));
                                } catch (err: unknown) {
                                  Alert.alert('Failed', (err as { message?: string })?.message ?? 'Try again.');
                                }
                              },
                            },
                          ]);
                        }}
                      >
                        <Trash2 size={12} color="#f87171" />
                      </Pressable>
                    )}
                  </View>

                  {/* Bottom meta */}
                  <View style={s.thumbBottom}>
                    <Text style={s.thumbTime}>{minsAgo(sig.createdAt)}</Text>
                    <View style={s.thumbViews}>
                      <Eye size={10} color="rgba(255,255,255,0.6)" />
                      <Text style={s.thumbViewCount}>{fmtViews(sig.viewCount)}</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Full-screen video modal ────────────────────────────────────── */}
      <Modal visible={!!activeSignal} animationType="fade" transparent={false} onRequestClose={closeVideo}>
        {activeSignal && (
          <View style={s.playerBg}>
            {activeSignal.mediaUrl && !errored ? (
              <Pressable style={s.playerWrap} onPress={() => setPaused((p) => !p)}>
                <Video
                  source={{ uri: activeSignal.mediaUrl }}
                  style={s.player}
                  resizeMode="cover"
                  paused={paused}
                  poster={activeSignal.thumbnailUrl ?? undefined}
                  posterResizeMode="cover"
                  repeat
                  onError={() => setErrored(true)}
                />
                {paused && (
                  <View style={s.playOverlay} pointerEvents="none">
                    <Text style={s.playTriangle}>▶</Text>
                  </View>
                )}
              </Pressable>
            ) : (
              <View style={s.playerWrap}>
                {activeSignal.thumbnailUrl ? (
                  <Image source={{ uri: activeSignal.thumbnailUrl }} style={s.player} resizeMode="cover" />
                ) : (
                  <View style={[s.player, { backgroundColor: '#111' }]} />
                )}
                {errored && (
                  <View style={s.errorNote}>
                    <Text style={s.errorNoteText}>Could not play video</Text>
                  </View>
                )}
              </View>
            )}

            {/* Close */}
            <Pressable
              style={[s.closeBtn, { top: insets.top + SPACING.sm }]}
              onPress={closeVideo}
              hitSlop={12}
            >
              <X size={20} color={COLORS.white} />
            </Pressable>

            {/* Bottom info */}
            <View style={[s.playerInfo, { paddingBottom: insets.bottom + SPACING.base }]}>
              {activeSignal.vibeTag && (
                <Text style={s.playerVibe}>
                  {activeSignal.vibeTag === 'hot' ? '🔥 Hot' : activeSignal.vibeTag === 'okay' ? '✅ Okay' : '😴 Slow'}
                </Text>
              )}
              <View style={s.playerMetaRow}>
                <Text style={s.playerTime}>{minsAgo(activeSignal.createdAt)}</Text>
                {activeSignal.geoVerified && (
                  <View style={s.playerGeoBadge}>
                    <CheckCircle size={11} color="#4ade80" />
                    <Text style={s.playerGeoText}>Geo-verified</Text>
                  </View>
                )}
                <View style={s.playerViewRow}>
                  <Eye size={12} color="rgba(255,255,255,0.6)" />
                  <Text style={s.playerViewCount}>{fmtViews(activeSignal.viewCount + 1)}</Text>
                </View>
              </View>
              {subTab === 'guest' && (
                <Text style={s.playerUserId}>@{activeSignal.userId.slice(0, 10)}</Text>
              )}
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Sub-tabs
  subTabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: '#1f2937',
  },
  subTab: {
    flex: 1, alignItems: 'center', paddingVertical: SPACING.md,
    position: 'relative',
  },
  subTabActive: {},
  subTabText:       { color: '#6b7280', fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium },
  subTabTextActive: { color: COLORS.white },
  subTabIndicator: {
    position: 'absolute', bottom: 0, left: '20%', right: '20%',
    height: 2, backgroundColor: COLORS.purple500, borderRadius: 1,
  },

  // Filters
  filterRow: {
    flexDirection: 'row', gap: SPACING.sm,
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.sm,
  },
  filterChip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full, backgroundColor: '#111827',
    borderWidth: 1, borderColor: '#1f2937',
  },
  filterChipActive:    { backgroundColor: COLORS.purple600, borderColor: COLORS.purple500 },
  filterChipText:      { color: '#9ca3af', fontSize: FONT_SIZE.sm },
  filterChipTextActive:{ color: COLORS.white, fontWeight: FONT_WEIGHT.medium },

  // Grid
  grid:    { padding: SPACING.base, paddingBottom: 100 },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },

  // Thumbnails
  thumb:        { borderRadius: RADIUS.lg, overflow: 'hidden', backgroundColor: '#1f2937' },
  thumbImg:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  thumbFallback:{ alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f2937' },
  thumbScrim: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  thumbTopRow: {
    position: 'absolute', top: SPACING.sm, left: SPACING.sm, right: SPACING.sm,
    flexDirection: 'row', gap: SPACING.xs,
  },
  geoBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  deleteBtn: {
    marginLeft: 'auto' as any,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  vibePill: {
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  vibePillText: { fontSize: 11 },
  thumbBottom: {
    position: 'absolute', bottom: SPACING.sm, left: SPACING.sm, right: SPACING.sm,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  thumbTime:      { color: 'rgba(255,255,255,0.7)', fontSize: 10 },
  thumbViews:     { flexDirection: 'row', alignItems: 'center', gap: 3 },
  thumbViewCount: { color: 'rgba(255,255,255,0.6)', fontSize: 10 },

  // Empty
  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 60, gap: SPACING.sm },
  emptyTitle:{ color: '#6b7280', fontSize: FONT_SIZE.body, textAlign: 'center' },
  emptySub:  { color: '#4b5563', fontSize: FONT_SIZE.sm,  textAlign: 'center', maxWidth: 240 },

  // Player modal
  playerBg:   { flex: 1, backgroundColor: '#000' },
  playerWrap: { flex: 1 },
  player:     { width: SW, height: SH },
  playOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  playTriangle: { color: 'rgba(255,255,255,0.9)', fontSize: 40 },
  closeBtn: {
    position: 'absolute', right: SPACING.base,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  playerInfo: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: SPACING.base, gap: SPACING.xs,
    backgroundColor: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
  },
  playerVibe:     { color: COLORS.white, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
  playerMetaRow:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  playerTime:     { color: 'rgba(255,255,255,0.7)', fontSize: FONT_SIZE.sm },
  playerGeoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  playerGeoText:  { color: '#4ade80', fontSize: FONT_SIZE.xs },
  playerViewRow:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  playerViewCount:{ color: 'rgba(255,255,255,0.6)', fontSize: FONT_SIZE.xs },
  playerUserId:   { color: '#9ca3af', fontSize: FONT_SIZE.sm },
  errorNote: {
    position: 'absolute', alignSelf: 'center', top: SH / 2 - 16,
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: SPACING.base, paddingVertical: SPACING.xs, borderRadius: RADIUS.full,
  },
  errorNoteText: { color: '#9ca3af', fontSize: FONT_SIZE.sm },
});
