/**
 * ExploreScreen — full Mumbai venue catalogue.
 *
 * Initial view: all venues from Firestore, nearest first.
 * Zone chips: filter by neighbourhood.
 * Search (local + Cloud Function): name / address / zone.
 * Save / un-save: users/{uid}/savedVenues/{venueId}.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Geolocation from '@react-native-community/geolocation';
import firestore from '@react-native-firebase/firestore';
import { fnDefault } from '../firebase/fns';
import auth from '@react-native-firebase/auth';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme';
import { IconSearch, IconBookmark, IconStar, IconMapPin, IconX } from '../components/Icon';
import { getVenueLabelsMap, type VenueLabels } from '../services/events';
import { loadCatalogue, formatDistance, haversineKm, type CatalogueVenue } from '../services/discovery';
import { getVibeMatchScore, VIBE_THRESHOLD } from '../utils/vibeMatching';
import type { VenueResult } from '../services/venues';
import { placesPhotoUrl } from '../config';

interface Props {
  onNavigate:    (venueId: string, venueName: string, coverPhotoUrl?: string) => void;
  selectedVibe?: string | null;   // pre-filter from Home vibe selection
  onClearVibe?:  () => void;      // called when user clears the vibe filter
}

interface ExploreVenue {
  venue:  CatalogueVenue;
  labels: VenueLabels;
}

const EMPTY_LABELS: VenueLabels = {
  isLiveNow: false, isTrending: false, isTonightEvent: false, isOngoing: false,
  vibeLabel: 'unknown', liveScore: 0, crowdLabel: null, activeSignalCount: 0,
  vibeBreakdown: { hot: 0, okay: 0, slow: 0 }, vibeConfidence: 0, consensusSampleSize: 0,
};

const VIBE_COLOR: Record<string, string> = {
  hot: '#f97316', okay: '#34d399', slow: '#9ca3af',
};

const MUMBAI_ZONES = [
  'Bandra West', 'Lower Parel', 'Andheri West', 'BKC',
  'Khar West', 'Juhu', 'Colaba', 'Worli', 'Powai', 'Fort',
];

const { width: SW } = Dimensions.get('window');
const CARD_GAP = SPACING.sm;
const CARD_W   = (SW - SPACING.base * 2 - CARD_GAP) / 2;
const CARD_H   = CARD_W * 1.35;

import { AURA_OPTIONS } from '../data/venues';

const AURA_LABELS: Record<string, { emoji: string; label: string }> =
  Object.fromEntries(AURA_OPTIONS.map((o) => [o.id, { emoji: o.emoji, label: o.label }]));

export function ExploreScreen({ onNavigate, selectedVibe, onClearVibe }: Props) {
  const insets = useSafeAreaInsets();

  const [catalogue,     setCatalogue]     = useState<ExploreVenue[]>([]);
  const [searchResults, setSearchResults] = useState<ExploreVenue[] | null>(null);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [searchLoading, setSearchLoading]  = useState(false);
  const [search,        setSearch]         = useState('');
  const [selectedZone,  setSelectedZone]   = useState<string | null>(null);
  const [savedIds,      setSavedIds]       = useState<Set<string>>(new Set());
  const [searchError,   setSearchError]    = useState<string | null>(null);

  const userLocRef  = useRef<{ lat: number; lng: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef  = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Load catalogue
  //
  // Wait for the first GPS fix (with a short timeout fallback) before calling
  // loadCatalogue, so nearest-first sorting uses real coordinates instead of
  // an empty userLocRef on the very first render.

  useEffect(() => {
    let cancelled = false;

    function getLocation(): Promise<{ lat: number; lng: number } | null> {
      return new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) { settled = true; resolve(null); }
        }, 5_500);
        Geolocation.getCurrentPosition(
          ({ coords }) => {
            if (settled) return;
            settled = true; clearTimeout(timer);
            resolve({ lat: coords.latitude, lng: coords.longitude });
          },
          () => {
            if (settled) return;
            settled = true; clearTimeout(timer);
            resolve(null);
          },
          { enableHighAccuracy: false, timeout: 5_000, maximumAge: 120_000 },
        );
      });
    }

    async function load() {
      try {
        const loc = await getLocation();
        if (cancelled) return;
        if (loc) userLocRef.current = loc;

        const venues = await loadCatalogue(loc, 80);
        if (cancelled || venues.length === 0) return;

        // Show venues immediately with empty labels — don't block on label fetch
        const items: ExploreVenue[] = venues.map((venue) => ({
          venue,
          labels: EMPTY_LABELS,
        }));
        if (!cancelled) {
          setCatalogue(items);
          setCatalogueLoading(false);
        }

        // Fetch live labels in the background and update cards quietly
        const labelsMap = await getVenueLabelsMap(venues.map((v) => v.placeId));
        if (cancelled) return;
        setCatalogue(venues.map((venue) => ({
          venue,
          labels: labelsMap.get(venue.placeId) ?? EMPTY_LABELS,
        })));
      } catch (err) {
        console.warn('ExploreScreen load error:', err);
      } finally {
        if (!cancelled) setCatalogueLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // Saved IDs

  useEffect(() => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;
    firestore().collection('users').doc(uid).collection('savedVenues')
      .get()
      .then((snap) => setSavedIds(new Set(snap.docs.map((d) => d.id))))
      .catch(() => {});
  }, []);

  // Debounced search

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = search.trim();
    if (q.length < 3) { setSearchResults(null); setSearchError(null); return; }

    debounceRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      setSearchLoading(true);
      setSearchError(null);
      try {
        const payload: Record<string, unknown> = { query: q, maxResults: 20 };
        if (userLocRef.current) {
          payload.latitude     = userLocRef.current.lat;
          payload.longitude    = userLocRef.current.lng;
          payload.radiusMetres = 15_000;
        }
        const result  = await fnDefault.httpsCallable('searchVenuesByText')(payload);
        if (!mountedRef.current) return;
        const venues: VenueResult[] = (result.data as { venues: VenueResult[] }).venues ?? [];
        if (venues.length === 0) { setSearchResults([]); return; }

        const labelsMap = await getVenueLabelsMap(venues.map((v) => v.placeId));
        if (!mountedRef.current) return;
        const loc = userLocRef.current;
        setSearchResults(
          venues.map((venue) => ({
            venue: {
              ...venue,
              distanceKm: loc
                ? haversineKm(loc.lat, loc.lng, venue.location.lat, venue.location.lng)
                : 999,
            },
            labels: labelsMap.get(venue.placeId) ?? EMPTY_LABELS,
          })),
        );
      } catch (err) {
        if (!mountedRef.current) return;
        console.warn('ExploreScreen search failed:', err);
        setSearchResults([]);
        setSearchError('Search failed. Check your connection and try again.');
      } finally {
        if (mountedRef.current) setSearchLoading(false);
      }
    }, 500);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  // Save / unsave

  const toggleSave = useCallback((venueId: string, venueName: string) => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(venueId)) {
        next.delete(venueId);
        firestore().collection('users').doc(uid).collection('savedVenues').doc(venueId)
          .delete().catch(() => {});
      } else {
        next.add(venueId);
        firestore().collection('users').doc(uid).collection('savedVenues').doc(venueId)
          .set({ savedAt: firestore.FieldValue.serverTimestamp(), venueName, placeId: venueId })
          .catch(() => {});
      }
      return next;
    });
  }, []);

  // Derived display list

  const isSearching = search.trim().length >= 3;

  const displayList = useMemo(() => {
    let base: ExploreVenue[];

    if (isSearching) {
      base = searchResults ?? catalogue.filter(({ venue }) => {
        const q = search.trim().toLowerCase();
        return (
          venue.name.toLowerCase().includes(q) ||
          venue.address.toLowerCase().includes(q) ||
          (venue.zone ?? '').toLowerCase().includes(q)
        );
      });
    } else {
      base = catalogue;
    }

    if (selectedZone) {
      base = base.filter(({ venue }) => venue.zone === selectedZone);
    }

    // Vibe filter from Home: keep venues above relevance threshold, sort by score
    if (selectedVibe && !isSearching) {
      base = base
        .map((item) => ({
          ...item,
          _vibeScore: getVibeMatchScore(item.venue, item.labels, selectedVibe),
        }))
        .filter((item) => item._vibeScore >= VIBE_THRESHOLD)
        .sort((a, b) => b._vibeScore - a._vibeScore);
    }

    return base;
  }, [isSearching, searchResults, catalogue, search, selectedZone, selectedVibe]);

  const loading = catalogueLoading || (isSearching && searchLoading && !searchResults);

  // Render

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Explore</Text>
        {savedIds.size > 0 && (
          <View style={styles.savedBadge}>
            <IconBookmark size={14} color={COLORS.purple400} />
            <Text style={styles.savedBadgeText}>{savedIds.size} saved</Text>
          </View>
        )}
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <IconSearch size={18} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search venues, areas, vibes…"
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <IconX size={16} color={COLORS.textMuted} />
          </Pressable>
        )}
        {searchLoading && <ActivityIndicator size="small" color={COLORS.purple400} style={{ marginLeft: 4 }} />}
      </View>

      {/* Active vibe pill (from Home selection) */}
      {selectedVibe && !isSearching && AURA_LABELS[selectedVibe] && (
        <View style={styles.vibePillRow}>
          <View style={styles.vibePill}>
            <Text style={styles.vibePillText}>
              {AURA_LABELS[selectedVibe].emoji} {AURA_LABELS[selectedVibe].label}
            </Text>
            <Pressable onPress={onClearVibe} hitSlop={8}>
              <IconX size={14} color={COLORS.purple400} />
            </Pressable>
          </View>
          <Text style={styles.vibePillSub}>Showing matched venues</Text>
        </View>
      )}

      {/* Zone filter chips */}
      {!isSearching && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.zoneScroll}
          contentContainerStyle={styles.zoneRow}
        >
          {MUMBAI_ZONES.map((zone) => {
            const active = selectedZone === zone;
            return (
              <Pressable
                key={zone}
                style={[styles.zoneChip, active && styles.zoneChipActive]}
                onPress={() => setSelectedZone((z) => (z === zone ? null : zone))}
              >
                <Text style={[styles.zoneChipText, active && styles.zoneChipTextActive]}>
                  {zone}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {isSearching && (
        <Text style={[styles.searchHint, searchError ? { color: COLORS.live } : null]}>
          {searchError
            ? searchError
            : searchResults
              ? `${searchResults.length} results for "${search.trim()}"`
              : 'Searching Mumbai venues…'}
        </Text>
      )}

      {/* Grid */}
      <View style={styles.gridSection}>
        <View style={styles.gridHeader}>
          <Text style={styles.gridTitle}>
            {isSearching
              ? 'Results'
              : selectedVibe && AURA_LABELS[selectedVibe]
                ? `${AURA_LABELS[selectedVibe].emoji} ${AURA_LABELS[selectedVibe].label} Spots`
                : selectedZone ?? 'All Mumbai Venues'}
          </Text>
          <Text style={styles.gridCount}>{displayList.length} places</Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={COLORS.purple400} />
            <Text style={styles.loadingText}>
              {isSearching ? `Searching for "${search.trim()}"…` : 'Loading venues…'}
            </Text>
          </View>
        ) : displayList.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              {isSearching
                ? `No venues found for "${search.trim()}"`
                : selectedZone
                  ? `No venues found in ${selectedZone} yet`
                  : 'No venues — run the catalogue seeder first.'}
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {displayList.map(({ venue, labels }) => {
              const isSaved = savedIds.has(venue.placeId);
              const vibe    = labels.vibeLabel !== 'unknown' ? VIBE_COLOR[labels.vibeLabel] : null;
              const photo   = venue.photos?.[0] ? placesPhotoUrl(venue.photos[0]) : null;
              const dist    = formatDistance(venue.distanceKm);

              return (
                <Pressable
                  key={venue.placeId}
                  style={[styles.card, { width: CARD_W, height: CARD_H }]}
                  onPress={() => onNavigate(venue.placeId, venue.name, photo || undefined)}
                  accessibilityRole="button"
                >
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.cardImg} resizeMode="cover" />
                  ) : (
                    <View style={[styles.cardImg, styles.cardImgFallback]}>
                      <IconMapPin size={24} color={COLORS.textMuted} />
                    </View>
                  )}
                  <View style={styles.cardOverlay} />

                  {labels.isLiveNow && <View style={styles.cardLiveDot} />}

                  <Pressable
                    style={styles.saveBtn}
                    onPress={() => toggleSave(venue.placeId, venue.name)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={isSaved ? 'Unsave venue' : 'Save venue'}
                  >
                    <IconBookmark size={18} color={isSaved ? COLORS.purple400 : 'rgba(255,255,255,0.7)'} />
                  </Pressable>

                  <View style={styles.cardInfo}>
                    <View style={styles.cardTopRow}>
                      {vibe && (
                        <View style={[styles.cardVibePill, { borderColor: vibe + '66' }]}>
                          <Text style={[styles.cardVibePillText, { color: vibe }]}>
                            {labels.vibeLabel === 'hot' ? '🔥' : labels.vibeLabel === 'okay' ? '✅' : '😴'}
                          </Text>
                        </View>
                      )}
                      {dist ? <Text style={styles.cardDist}>{dist}</Text> : null}
                    </View>
                    <Text style={styles.cardName} numberOfLines={2}>{venue.name}</Text>
                    <View style={styles.cardMeta}>
                      {venue.rating != null && (
                        <View style={styles.cardRating}>
                          <IconStar size={11} color={COLORS.warning} />
                          <Text style={styles.cardRatingText}>{venue.rating.toFixed(1)}</Text>
                        </View>
                      )}
                      {venue.priceLevel && <Text style={styles.cardPrice}>{venue.priceLevel}</Text>}
                      {venue.zone && <Text style={styles.cardZone} numberOfLines={1}>{venue.zone}</Text>}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// Styles

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.base, paddingTop: SPACING.md, paddingBottom: SPACING.sm,
  },
  headerTitle:    { color: COLORS.text, fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold },
  savedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.purpleBg10, borderWidth: 1, borderColor: COLORS.purple700,
    paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full,
  },
  savedBadgeText: { color: COLORS.purple400, fontSize: FONT_SIZE.sm },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: SPACING.base, marginBottom: SPACING.sm,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, height: 44, paddingHorizontal: SPACING.md, gap: SPACING.sm,
  },
  searchInput: { flex: 1, color: COLORS.text, fontSize: FONT_SIZE.body },

  zoneScroll:  { marginBottom: SPACING.sm },
  zoneRow: { paddingHorizontal: SPACING.base, gap: SPACING.sm, alignItems: 'center' },
  zoneChip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderLight,
    backgroundColor: COLORS.bgCard,
  },
  zoneChipActive: { borderColor: COLORS.purple500, backgroundColor: COLORS.purpleBg10 },
  zoneChipText:   { color: COLORS.textSub, fontSize: FONT_SIZE.sm },
  zoneChipTextActive: { color: COLORS.purple400, fontWeight: FONT_WEIGHT.medium },

  vibePillRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.base, marginBottom: SPACING.sm },
  vibePill:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: COLORS.purpleBg10, borderWidth: 1, borderColor: COLORS.purple700, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 5 },
  vibePillText:{ color: COLORS.purple400, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
  vibePillSub: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },

  searchHint: {
    color: COLORS.textMuted, fontSize: FONT_SIZE.sm,
    paddingHorizontal: SPACING.base, marginBottom: SPACING.sm,
  },

  gridSection: { paddingHorizontal: SPACING.base },
  gridHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  gridTitle:   { color: COLORS.text,    fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
  gridCount:   { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },

  loadingBox:  { alignItems: 'center', paddingVertical: SPACING.xxxl, gap: SPACING.sm },
  loadingText: { color: COLORS.textSub, fontSize: FONT_SIZE.body },
  emptyBox:    { alignItems: 'center', paddingVertical: SPACING.xl },
  emptyText:   { color: COLORS.textSub, fontSize: FONT_SIZE.body, textAlign: 'center' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP },

  card:            { borderRadius: RADIUS.md, overflow: 'hidden', backgroundColor: COLORS.bgCard },
  cardImg:         { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  cardImgFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.border },
  cardOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  cardLiveDot: {
    position: 'absolute', top: SPACING.sm, left: SPACING.sm,
    width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.live,
    borderWidth: 1.5, borderColor: COLORS.white,
  },
  saveBtn: {
    position: 'absolute', top: SPACING.sm, right: SPACING.sm,
    width: 30, height: 30, borderRadius: RADIUS.full,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  cardInfo:    { position: 'absolute', bottom: 0, left: 0, right: 0, padding: SPACING.sm, gap: 4 },
  cardTopRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardVibePill: {
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: RADIUS.full,
    paddingHorizontal: 6, paddingVertical: 1, backgroundColor: 'rgba(0,0,0,0.35)',
  },
  cardVibePillText: { fontSize: 11 },
  cardDist:    { color: 'rgba(255,255,255,0.65)', fontSize: FONT_SIZE.xs },
  cardName:    { color: COLORS.white, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, lineHeight: 18 },
  cardMeta:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  cardRating:  { flexDirection: 'row', alignItems: 'center', gap: 2 },
  cardRatingText: { color: 'rgba(255,255,255,0.75)', fontSize: FONT_SIZE.xs },
  cardPrice:   { color: 'rgba(255,255,255,0.65)', fontSize: FONT_SIZE.xs },
  cardZone:    { color: 'rgba(255,255,255,0.5)', fontSize: FONT_SIZE.xs, flex: 1 },
});
