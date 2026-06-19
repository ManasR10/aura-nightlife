// Vibe-first discovery hub: header, hero banner carousel, and the "What's Your
// Aura?" grid. Tapping a vibe hands off to the Explore tab pre-filtered — no venue
// list lives here. Banners load from /banners (active==true, by priority) and fall
// back to PLACEHOLDER_BANNERS when the collection is empty.
import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import { ChevronRight, MapPin, ChevronDown } from 'lucide-react-native';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme';
import { useAuth } from '../auth/useAuth';

const { width: SW } = Dimensions.get('window');
const BANNER_H = SW * 0.625; // 16:10 ratio matching Lovable design

// Types

export interface BannerItem {
  id:       string;
  title:    string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  venueId:  string | null;
}

// Placeholder banners (shown until real venue ads are created)
// Replace with real venue content by creating /banners docs in Firestore.

const PLACEHOLDER_BANNERS: BannerItem[] = [
  {
    id: 'p1',
    title: 'EDM Night Takeover',
    subtitle: '✦ Feel the bass drop ✦',
    imageUrl: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&w=800&q=80',
    ctaLabel: "Let's go",
    venueId: null,
  },
  {
    id: 'p2',
    title: 'Rooftop Sunset Sessions',
    subtitle: '✦ Sky-high cocktails ✦',
    imageUrl: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=800&q=80',
    ctaLabel: 'Explore now',
    venueId: null,
  },
  {
    id: 'p3',
    title: 'Acoustic Chill Sessions',
    subtitle: '✦ Sip & unwind ✦',
    imageUrl: 'https://images.unsplash.com/photo-1571204829887-3b8d69e4094d?auto=format&fit=crop&w=800&q=80',
    ctaLabel: 'Discover',
    venueId: null,
  },
  {
    id: 'p4',
    title: 'Live Jazz & Cocktails',
    subtitle: '✦ Smooth sounds tonight ✦',
    imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
    ctaLabel: 'Book now',
    venueId: null,
  },
];

// Aura options

import { AURA_OPTIONS } from '../data/venues';

const AURA_ITEM_W = (SW - SPACING.base * 2 - SPACING.sm * 2) / 3;

// Component

interface Props {
  onVibeSelect:  (auraId: string) => void;
  onNavigate:    (venueId: string, venueName: string, coverPhotoUrl?: string) => void;
}

export function HomeScreen({ onVibeSelect, onNavigate }: Props) {
  const insets      = useSafeAreaInsets();
  const { userDoc } = useAuth();

  const [banners,      setBanners]      = useState<BannerItem[]>(PLACEHOLDER_BANNERS);
  const [activeSlide,  setActiveSlide]  = useState(0);
  const [selectedAura, setSelectedAura] = useState<string | null>(
    userDoc?.preferences?.auraVibes?.[0] ?? null,
  );

  const scrollRef = useRef<ScrollView>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load banners from Firestore

  useEffect(() => {
    const unsub = firestore()
      .collection('banners')
      .where('active', '==', true)
      .orderBy('priority', 'desc')
      .limit(6)
      .onSnapshot(
        (snap) => {
          if (snap.empty) { setBanners(PLACEHOLDER_BANNERS); return; }
          setBanners(snap.docs.map((d) => ({
            id:       d.id,
            title:    d.data().title     ?? '',
            subtitle: d.data().subtitle  ?? '',
            imageUrl: d.data().imageUrl  ?? '',
            ctaLabel: d.data().ctaLabel  ?? 'Explore',
            venueId:  d.data().venueId   ?? null,
          })));
        },
        () => setBanners(PLACEHOLDER_BANNERS),
      );
    return unsub;
  }, []);

  // Auto-advance carousel

  useEffect(() => {
    if (banners.length <= 1) return;
    timerRef.current = setInterval(() => {
      setActiveSlide((prev) => {
        const next = (prev + 1) % banners.length;
        scrollRef.current?.scrollTo({ x: next * SW, animated: true });
        return next;
      });
    }, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [banners.length]);

  function handleSlideScroll(x: number) {
    const idx = Math.round(x / SW);
    if (idx !== activeSlide) {
      setActiveSlide(idx);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
  }

  function handleBannerTap(banner: BannerItem) {
    if (banner.venueId) onNavigate(banner.venueId, banner.title);
  }

  function handleAuraTap(auraId: string) {
    setSelectedAura(auraId);
    onVibeSelect(auraId);
  }

  // Render

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MapPin size={18} color={COLORS.purple400} />
          <View>
            <View style={styles.headerTitleRow}>
              <Text style={styles.appName}>Aura</Text>
              <ChevronDown size={14} color={COLORS.textSub} />
            </View>
            <Text style={styles.locationSub}>Mumbai · What's happening tonight</Text>
          </View>
        </View>
      </View>

      {/* Hero banner carousel */}
      <View style={styles.carouselWrap}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e) => handleSlideScroll(e.nativeEvent.contentOffset.x)}
          decelerationRate="fast"
          snapToInterval={SW}
        >
          {banners.map((banner) => (
            <Pressable
              key={banner.id}
              style={styles.bannerSlide}
              onPress={() => handleBannerTap(banner)}
            >
              {banner.imageUrl ? (
                <Image
                  source={{ uri: banner.imageUrl }}
                  style={styles.bannerImg}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.bannerImg, styles.bannerImgFallback]} />
              )}
              {/* Dark overlay */}
              <View style={styles.bannerOverlay} />
              {/* Text content */}
              <View style={styles.bannerContent}>
                <Text style={styles.bannerTitle}>{banner.title}</Text>
                <Text style={styles.bannerSubtitle}>{banner.subtitle}</Text>
              </View>
              {/* CTA button */}
              <View style={styles.bannerCTA}>
                <View style={styles.bannerCTABtn}>
                  <Text style={styles.bannerCTAText}>{banner.ctaLabel}</Text>
                  <ChevronRight size={14} color="#111" />
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Dots indicator */}
      <View style={styles.dotsRow}>
        {banners.map((_, i) => (
          <Pressable
            key={i}
            onPress={() => {
              scrollRef.current?.scrollTo({ x: i * SW, animated: true });
              setActiveSlide(i);
            }}
          >
            <View style={[styles.dot, i === activeSlide && styles.dotActive]} />
          </Pressable>
        ))}
      </View>

      {/* "What's Your Aura?" */}
      <View style={styles.auraSection}>
        <View style={styles.auraDivider}>
          <View style={styles.divLine} />
          <Text style={styles.auraHeading}>What's Your Aura?</Text>
          <View style={styles.divLine} />
        </View>

        <View style={styles.auraGrid}>
          {AURA_OPTIONS.map((opt) => {
            const active = selectedAura === opt.id;
            return (
              <Pressable
                key={opt.id}
                style={[
                  styles.auraItem,
                  { width: AURA_ITEM_W },
                  active ? styles.auraActive : styles.auraInactive,
                ]}
                onPress={() => handleAuraTap(opt.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                {active && (
                  <View style={styles.auraCheck}>
                    <Text style={styles.auraCheckText}>✓</Text>
                  </View>
                )}
                <Text style={styles.auraEmoji}>{opt.emoji}</Text>
                <Text style={styles.auraLabel}>{opt.label}</Text>
                <Text style={styles.auraDesc}>{opt.desc}</Text>
              </Pressable>
            );
          })}
        </View>
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
  headerLeft:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  appName:        { color: COLORS.text, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.bold },
  locationSub:    { color: COLORS.textMuted, fontSize: 11 },

  // Carousel
  carouselWrap: { paddingHorizontal: SPACING.base },
  bannerSlide:  {
    width: SW - SPACING.base * 2,
    height: BANNER_H,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.bgCard,
  },
  bannerImg:        { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  bannerImgFallback:{ backgroundColor: '#1f2937' },
  bannerOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  bannerContent: {
    position: 'absolute', left: 0, right: 0,
    top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  bannerTitle:    { color: COLORS.white, fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  bannerSubtitle: { color: '#d8b4fe', fontSize: FONT_SIZE.sm, marginTop: 6, textAlign: 'center' },
  bannerCTA: {
    position: 'absolute', bottom: SPACING.base, left: 0, right: 0,
    alignItems: 'center',
  },
  bannerCTABtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: SPACING.base, paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  bannerCTAText: { color: '#111', fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold },

  // Dots
  dotsRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 6, paddingTop: SPACING.md, paddingBottom: SPACING.xl,
  },
  dot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#374151' },
  dotActive: { width: 20, backgroundColor: COLORS.purple400 },

  // Aura section
  auraSection: { paddingHorizontal: SPACING.base },
  auraDivider: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.lg },
  divLine:     { flex: 1, height: 1, backgroundColor: COLORS.border },
  auraHeading: { color: '#d1d5db', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center' },

  auraGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, justifyContent: 'space-between' },
  auraItem: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.xs,
    borderRadius: RADIUS.xl, borderWidth: 1, gap: 4, position: 'relative',
  },
  auraActive:   { borderColor: COLORS.purple500, backgroundColor: 'rgba(124,58,237,0.25)', shadowColor: COLORS.purple500, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  auraInactive: { borderColor: '#1f2937', backgroundColor: 'rgba(17,24,39,0.8)' },
  auraCheck:    { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: RADIUS.full, backgroundColor: COLORS.purple500, alignItems: 'center', justifyContent: 'center' },
  auraCheckText:{ color: COLORS.white, fontSize: 8, fontWeight: FONT_WEIGHT.bold },
  auraEmoji:    { fontSize: 28 },
  auraLabel:    { color: COLORS.white, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold, textAlign: 'center' },
  auraDesc:     { color: '#6b7280', fontSize: 9, textAlign: 'center', lineHeight: 13 },
});
