/**
 * LiveFeedScreen — TikTok/Reels-style full-screen vertical video feed.
 *
 * Each card is the full screen height. Snap-scrolling vertically.
 * Active card auto-plays video; others are paused.
 *
 * Right action rail: Like · Comment · Share · Check In & Earn
 * Bottom overlay: venue name · author · vibe pill · caption · Visit Venue
 *
 * Data: Firestore /liveSignals where signalType=='video', expiresAt > now
 * joined with /venues for venue name.
 */
import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import Video from 'react-native-video';
import {
  Heart, Share2, MapPin,
  User, Sparkles, CheckCircle,
} from 'lucide-react-native';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme';
import { timeAgo } from '../utils/time';
import type { LiveSignalDoc } from '../services/events';

// Types

interface FeedItem {
  signal:    LiveSignalDoc;
  venueName: string;
}

// Helpers

const { width: SW, height: SH } = Dimensions.get('window');

const VIBE_LABEL: Record<string, { emoji: string; label: string; color: string }> = {
  hot:  { emoji: '🔥', label: 'Hot',  color: '#f97316' },
  okay: { emoji: '✅', label: 'Okay', color: '#34d399' },
  slow: { emoji: '😴', label: 'Slow', color: '#9ca3af' },
};

// Root screen

interface Props {
  onNavigate: (venueId: string, venueName: string) => void;
}

type FilterId = 'all' | 'hot' | 'okay' | 'slow' | 'geo' | 'official';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all',      label: 'All'       },
  { id: 'hot',      label: '🔥 Hot'    },
  { id: 'okay',     label: '✅ Okay'   },
  { id: 'slow',     label: '😴 Slow'   },
  { id: 'geo',      label: '📍 Nearby' },
  { id: 'official', label: '💜 Official'},
];

export function LiveFeedScreen({ onNavigate }: Props) {
  const insets = useSafeAreaInsets();

  const [items,      setItems]      = useState<FeedItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeIdx,  setActiveIdx]  = useState(0);
  const [filter,     setFilter]     = useState<FilterId>('all');

  const [itemH, setItemH] = useState(SH);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      // Simple query — only signalType==video ordered by createdAt.
      // Avoids composite index requirement on expiresAt + signalType.
      // We filter expired signals client-side.
      const snap = await firestore()
        .collection('liveSignals')
        .where('signalType', '==', 'video')
        .orderBy('createdAt', 'desc')
        .limit(40)
        .get();

      const now = Date.now();
      const live = snap.docs
        .map((d) => ({ signalId: d.id, ...d.data() } as LiveSignalDoc))
        .filter((s) => s.expiresAt.toMillis() > now);

      if (live.length === 0) { setItems([]); return; }

      const venueIds = [...new Set(live.map((s) => s.venueId))];
      const vSnaps   = await Promise.all(
        venueIds.map((id) => firestore().collection('venues').doc(id).get()),
      );
      const nameMap = new Map<string, string>();
      vSnaps.forEach((s) => {
        if (s.exists()) nameMap.set(s.id, (s.data() as { name?: string }).name ?? s.id);
      });

      setItems(live.map((sig) => ({
        signal:    sig,
        venueName: nameMap.get(sig.venueId) ?? 'Unknown Venue',
      })));
    } catch (err) {
      console.warn('LiveFeedScreen load error:', err);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Client-side filter
  const displayItems = useMemo(() => {
    if (filter === 'all')      return items;
    if (filter === 'geo')      return items.filter((i) => i.signal.geoVerified);
    if (filter === 'official') return items.filter((i) => i.signal.sourceType === 'admin');
    return items.filter((i) => i.signal.vibeTag === filter);
  }, [items, filter]);

  function handleFilterChange(id: FilterId) {
    setFilter(id);
    setActiveIdx(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) setActiveIdx(viewableItems[0].index ?? 0);
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  // Render

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={COLORS.purple400} size="large" />
        <Text style={s.loadingText}>Loading feed…</Text>
      </View>
    );
  }

  const noResults = displayItems.length === 0;

  // Feed

  return (
    <View
      style={s.container}
      onLayout={(e) => setItemH(e.nativeEvent.layout.height)}
    >
      {/* Floating header */}
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <Text style={s.headerTitle}>Feed</Text>
        {!noResults && (
          <Text style={s.headerCount}>{activeIdx + 1} / {displayItems.length}</Text>
        )}
      </View>

      {/* Filter chip row — overlaid below header */}
      <View style={[s.filterRow, { top: insets.top + 44 }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterContent}
        >
          {FILTERS.map((f) => (
            <Pressable
              key={f.id}
              style={[s.filterChip, filter === f.id && s.filterChipActive]}
              onPress={() => handleFilterChange(f.id)}
            >
              <Text style={[s.filterChipText, filter === f.id && s.filterChipTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {noResults ? (
        <View style={s.center}>
          <Text style={{ fontSize: 36 }}>🔍</Text>
          <Text style={s.emptyTitle}>No clips match this filter</Text>
          <Pressable onPress={() => handleFilterChange('all')} style={s.clearFilterBtn}>
            <Text style={s.clearFilterText}>Show all</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={displayItems}
          keyExtractor={(item) => item.signal.signalId}
          renderItem={({ item, index }) => (
            <ReelCard
              item={item}
              isActive={index === activeIdx}
              itemH={itemH}
              onNavigate={onNavigate}
            />
          )}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(_, index) => ({ length: itemH, offset: itemH * index, index })}
          onRefresh={() => { setRefreshing(true); load(); }}
          refreshing={refreshing}
          style={{ flex: 1 }}
        />
      )}
    </View>
  );
}

// Reel card

interface ReelCardProps {
  item:       FeedItem;
  isActive:   boolean;
  itemH:      number;
  onNavigate: (venueId: string, venueName: string) => void;
}

const ReelCard = React.memo(function ReelCard({ item, isActive, itemH, onNavigate }: ReelCardProps) {
  const { signal, venueName } = item;

  const [paused,   setPaused]   = useState(true);
  const [liked,    setLiked]    = useState(false);
  const [errored,  setErrored]  = useState(false);
  const [showPlay, setShowPlay] = useState(false);
  const playTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-play when this card becomes active
  useEffect(() => {
    if (isActive) {
      setPaused(false);
    } else {
      setPaused(true);
    }
  }, [isActive]);

  // Clean up the play-icon timeout on unmount
  useEffect(() => () => {
    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
  }, []);

  function handleTap() {
    setPaused((p) => {
      const next = !p;
      // Show play icon briefly when pausing
      if (next) {
        setShowPlay(true);
        if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
        playTimeoutRef.current = setTimeout(() => setShowPlay(false), 800);
      }
      return next;
    });
  }

  async function handleShare() {
    try {
      await Share.share({
        message: `Check out ${venueName} on Aura — it's live right now! 🔥`,
        title:   `${venueName} is live on Aura`,
      });
    } catch { /* cancelled */ }
  }

  const vibe    = signal.vibeTag ? VIBE_LABEL[signal.vibeTag] : null;
  const isAdmin = signal.sourceType === 'admin';
  const timeStr = timeAgo(signal.createdAt);
  const hasMedia = !!signal.mediaUrl && !errored;

  return (
    <View style={[s.reel, { height: itemH }]}>
      {/* Video / poster */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleTap}>
        {/* Always render thumbnail first as background so there's never a black frame */}
        {signal.thumbnailUrl ? (
          <Image
            source={{ uri: signal.thumbnailUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#111' }]} />
        )}

        {/* Video on top — mount only when the card is the active reel so we
            don't load all 40 sources at once. The thumbnail above stays visible
            until the active video paints. */}
        {hasMedia && isActive && (
          <Video
            source={{ uri: signal.mediaUrl! }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            paused={paused}
            repeat
            onError={() => setErrored(true)}
          />
        )}

        {/* Gradient overlays */}
        <View style={s.gradientTop} />
        <View style={s.gradientBottom} />

        {/* Play/pause flash icon */}
        {showPlay && (
          <View style={s.playFlash} pointerEvents="none">
            <Text style={s.playFlashIcon}>⏸</Text>
          </View>
        )}
      </Pressable>

      {/* LIVE badge */}
      <View style={s.liveBadge}>
        <View style={s.liveDot} />
        <Text style={s.liveText}>LIVE</Text>
      </View>

      {/* Geo-verified badge */}
      {signal.geoVerified && (
        <View style={s.geoBadge}>
          <CheckCircle size={10} color="#4ade80" />
          <Text style={s.geoText}>Verified</Text>
        </View>
      )}

      {/* Right action rail */}
      <View style={[s.rail, { bottom: 100 }]}>

        {/* Like */}
        <Pressable style={s.railBtn} onPress={() => setLiked((v) => !v)}>
          <Heart
            size={30}
            color={liked ? '#ef4444' : '#fff'}
            fill={liked ? '#ef4444' : 'none'}
          />
          <Text style={s.railLabel}>{liked ? '1' : '0'}</Text>
        </Pressable>

        {/* Share */}
        <Pressable style={s.railBtn} onPress={handleShare}>
          <Share2 size={26} color="#fff" />
          <Text style={s.railLabel}>Share</Text>
        </Pressable>

        {/* Check In & Earn — Aura's primary CTA */}
        <Pressable
          style={s.checkInBtn}
          onPress={() => onNavigate(signal.venueId, venueName)}
        >
          <MapPin size={20} color="#fff" />
          <Text style={s.checkInLabel}>Check In</Text>
          <Text style={s.checkInSub}>& Earn</Text>
        </Pressable>
      </View>

      {/* Bottom info overlay */}
      <View style={s.bottomInfo}>

        {/* Venue name */}
        <Pressable
          style={s.venueRow}
          onPress={() => onNavigate(signal.venueId, venueName)}
        >
          <MapPin size={14} color={COLORS.purple400} />
          <Text style={s.venueName}>{venueName}</Text>
        </Pressable>

        {/* Author + time */}
        <View style={s.authorRow}>
          <View style={s.authorAvatar}>
            <User size={13} color="#9ca3af" />
          </View>
          <Text style={s.authorName}>
            {isAdmin ? venueName : `@${(signal.userId ?? '').slice(0, 10)}`}
          </Text>
          <Text style={s.authorTime}>· {timeStr}</Text>
        </View>

        {/* Vibe pill + Official badge */}
        <View style={s.pillRow}>
          {vibe && (
            <View style={[s.vibePill, { borderColor: vibe.color + '55', backgroundColor: vibe.color + '22' }]}>
              <Sparkles size={10} color={vibe.color} />
              <Text style={[s.vibePillText, { color: vibe.color }]}>
                {vibe.label} {vibe.emoji}
              </Text>
            </View>
          )}
          {isAdmin && (
            <View style={s.officialPill}>
              <Text style={s.officialText}>Official</Text>
            </View>
          )}
        </View>

        {/* Caption from vibe */}
        {signal.vibeTag && (
          <Text style={s.caption} numberOfLines={2}>
            {signal.vibeTag === 'hot'
              ? 'Packed and buzzing right now 🔥'
              : signal.vibeTag === 'okay'
              ? 'Good crowd and decent vibes ✅'
              : 'Quiet tonight, perfect for a chilled night out 😴'}
          </Text>
        )}

        {/* Visit Venue CTA */}
        <Pressable
          style={s.visitBtn}
          onPress={() => onNavigate(signal.venueId, venueName)}
        >
          <Text style={s.visitBtnText}>Visit Venue</Text>
        </Pressable>
      </View>
    </View>
  );
});

// Styles

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center:    { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, padding: SPACING.xl },
  emptyEmoji:{ fontSize: 44 },
  emptyTitle:{ color: COLORS.text,    fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold, textAlign: 'center' },
  emptySub:  { color: COLORS.textSub, fontSize: FONT_SIZE.body,   textAlign: 'center', lineHeight: 22 },

  loadingText:    { color: COLORS.textSub, fontSize: FONT_SIZE.body, marginTop: SPACING.sm },
  clearFilterBtn:{ marginTop: SPACING.md, backgroundColor: COLORS.purple600, borderRadius: RADIUS.full, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm },
  clearFilterText:{ color: '#fff', fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold },

  // Filter chips overlay
  filterRow: {
    position: 'absolute', left: 0, right: 0, zIndex: 15,
  },
  filterContent: { paddingHorizontal: SPACING.base, gap: SPACING.xs, paddingVertical: SPACING.xs },
  filterChip: {
    paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.full,
    backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  filterChipActive:    { backgroundColor: COLORS.purple600, borderColor: COLORS.purple500 },
  filterChipText:      { color: 'rgba(255,255,255,0.75)', fontSize: FONT_SIZE.sm },
  filterChipTextActive:{ color: '#fff', fontWeight: FONT_WEIGHT.semibold },

  // Floating header
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.base, paddingBottom: SPACING.sm,
    // subtle top gradient handled by reel's gradientTop
  },
  headerTitle:{ color: '#fff', fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold },
  headerCount:{ color: 'rgba(255,255,255,0.6)', fontSize: FONT_SIZE.sm },

  // Full-screen reel
  reel: { width: SW, backgroundColor: '#000', overflow: 'hidden' },

  // Gradient overlays (simulate gradient without LinearGradient)
  gradientTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 120,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  gradientBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 280,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },

  // Play flash
  playFlash: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  playFlashIcon: { fontSize: 56, opacity: 0.8 },

  // Badges
  liveBadge: {
    position: 'absolute', top: 56, left: SPACING.base,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#dc2626', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full,
  },
  liveDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText:  { color: '#fff', fontSize: 10, fontWeight: FONT_WEIGHT.bold },
  geoBadge: {
    position: 'absolute', top: 56, right: SPACING.base,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: '#16a34a',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.full,
  },
  geoText: { color: '#4ade80', fontSize: 10 },

  // Right action rail
  rail: {
    position: 'absolute', right: SPACING.base,
    alignItems: 'center', gap: SPACING.xl,
  },
  railBtn: { alignItems: 'center', gap: 4 },
  railLabel:{ color: '#fff', fontSize: 11, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },

  // Check In & Earn button (distinctive)
  checkInBtn: {
    alignItems: 'center', gap: 2,
    backgroundColor: COLORS.purple600,
    borderRadius: RADIUS.md, paddingVertical: 8, paddingHorizontal: 10,
    shadowColor: COLORS.purple500, shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 6,
  },
  checkInLabel: { color: '#fff', fontSize: 11, fontWeight: FONT_WEIGHT.bold },
  checkInSub:   { color: 'rgba(255,255,255,0.8)', fontSize: 9 },

  // Bottom info
  bottomInfo: {
    position: 'absolute', bottom: 0, left: 0, right: 72,
    padding: SPACING.base, paddingBottom: SPACING.lg,
    gap: SPACING.xs,
  },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  venueName:{ color: '#fff', fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.bold, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },

  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  authorAvatar: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#374151',
    alignItems: 'center', justifyContent: 'center',
  },
  authorName:{ color: '#fff', fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium },
  authorTime:{ color: 'rgba(255,255,255,0.6)', fontSize: FONT_SIZE.sm },

  pillRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  vibePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full,
  },
  vibePillText:  { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.medium },
  officialPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full,
  },
  officialText: { color: '#fff', fontSize: FONT_SIZE.xs },

  caption:  { color: 'rgba(255,255,255,0.85)', fontSize: FONT_SIZE.body, lineHeight: 20 },

  visitBtn: {
    alignSelf: 'flex-start', marginTop: 4,
    backgroundColor: '#fff', paddingHorizontal: SPACING.md, paddingVertical: 7, borderRadius: RADIUS.full,
  },
  visitBtnText: { color: '#111', fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold },
});
