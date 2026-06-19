/**
 * OnboardingScreen — 3 intro slides + aura mood preference picker.
 * Writes preferences to Firestore and sets onboardingCompleted:true.
 */
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/useAuth';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme';
import type { UserPreferences } from '../types';

const { width: SCREEN_W } = Dimensions.get('window');

// Slides data

const SLIDES = [
  {
    id: 'know',
    emoji: '📍',
    title: 'Know Before You Go',
    body: "See what's actually happening at venues right now — real crowd levels, music, vibe. No guessing.",
  },
  {
    id: 'earn',
    emoji: '💸',
    title: 'Share & Earn Instantly',
    body: 'Post a live update from inside a venue and get ₹10 credited to your UPI in minutes.',
  },
  {
    id: 'aura',
    emoji: '✨',
    title: 'Find Your Aura',
    body: 'Filter venues by your vibe tonight — high energy, chill, date night, or anything in between.',
  },
];

// Aura mood options (canonical list in src/data/venues.ts)

import { AURA_OPTIONS } from '../data/venues';
import { MIN_AGE } from '../utils/age';

// Component

export function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useAuth();

  const [slideIndex,    setSlideIndex]    = useState(0);
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [agreeChecked,  setAgreeChecked]  = useState(false);
  const [loading,       setLoading]       = useState(false);

  const flatRef = useRef<FlatList>(null);
  const totalSlides = SLIDES.length + 1; // +1 for preferences slide

  const onViewRef = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]) setSlideIndex(viewableItems[0].index ?? 0);
  });

  function goNext() {
    const next = slideIndex + 1;
    flatRef.current?.scrollToIndex({ index: next, animated: true });
  }

  function toggleVibe(id: string) {
    setSelectedVibes((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  }

  async function handleFinish() {
    if (!agreeChecked) return;
    setLoading(true);
    const preferences: UserPreferences = {
      auraVibes:        selectedVibes,
      nightTypes:       [],
      crowdPreference:  '',
      travelDistance:   '',
    };
    try {
      await completeOnboarding(preferences);
      // Navigator re-renders automatically
    } catch (err) {
      console.error('Onboarding error:', err);
    } finally {
      setLoading(false);
    }
  }

  // Render each slide

  function renderSlide({ item: _item, index }: { item: typeof SLIDES[0] | null; index: number }) {
    // Last slide = preferences picker
    if (index === SLIDES.length) {
      return (
        <View style={[styles.slide, { width: SCREEN_W }]}>
          <Text style={styles.prefTitle}>What's your Aura?</Text>
          <Text style={styles.prefSub}>Pick your vibe (or a few). We'll tailor your feed.</Text>

          <View style={styles.vibeGrid}>
            {AURA_OPTIONS.map((opt) => {
              const active = selectedVibes.includes(opt.id);
              return (
                <Pressable
                  key={opt.id}
                  style={[styles.vibeItem, active && styles.vibeItemActive]}
                  onPress={() => toggleVibe(opt.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={styles.vibeEmoji}>{opt.emoji}</Text>
                  <Text style={styles.vibeLabel}>{opt.label}</Text>
                  <Text style={styles.vibeDesc}>{opt.desc}</Text>
                  {active && (
                    <View style={styles.checkDot}>
                      <Text style={styles.checkMark}>✓</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Fix 6: age + terms consent */}
          <Pressable
            style={styles.consentRow}
            onPress={() => setAgreeChecked((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreeChecked }}
          >
            <View style={[styles.checkbox, agreeChecked && styles.checkboxActive]}>
              {agreeChecked && <Text style={styles.checkboxTick}>✓</Text>}
            </View>
            <Text style={styles.consentText}>
              I confirm I am <Text style={styles.consentBold}>{MIN_AGE} or older</Text> and agree to the{' '}
              <Text
                style={styles.consentLink}
                onPress={() => Linking.openURL('https://auraapp.in/terms').catch(() => {})}
              >Terms of Service</Text>
              {' '}and{' '}
              <Text
                style={styles.consentLink}
                onPress={() => Linking.openURL('https://auraapp.in/privacy').catch(() => {})}
              >Privacy Policy</Text>.
            </Text>
          </Pressable>

          <Pressable
            style={[styles.primaryBtn, (!agreeChecked || loading) && styles.btnDisabled]}
            onPress={handleFinish}
            disabled={!agreeChecked || loading}
            accessibilityRole="button"
          >
            {loading
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={styles.primaryBtnText}>Enter Aura →</Text>
            }
          </Pressable>
        </View>
      );
    }

    // Intro slides
    const slide = SLIDES[index];
    const isLast = index === SLIDES.length - 1;

    return (
      <View style={[styles.slide, { width: SCREEN_W }]}>
        <Text style={styles.slideEmoji}>{slide.emoji}</Text>
        <Text style={styles.slideTitle}>{slide.title}</Text>
        <Text style={styles.slideBody}>{slide.body}</Text>

        <Pressable
          style={styles.primaryBtn}
          onPress={goNext}
          accessibilityRole="button"
        >
          <Text style={styles.primaryBtnText}>
            {isLast ? 'Pick your Aura →' : 'Next →'}
          </Text>
        </Pressable>
      </View>
    );
  }

  // Pad slides array with a null for the preferences slide
  const data = [...SLIDES, null] as (typeof SLIDES[0] | null)[];

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Dots */}
      <View style={[styles.dotsRow, { paddingTop: insets.top + SPACING.lg }]}>
        {Array.from({ length: totalSlides }).map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === slideIndex ? styles.dotActive : styles.dotInactive]}
          />
        ))}
      </View>

      <FlatList
        ref={flatRef}
        data={data}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false} // controlled by buttons only
        onViewableItemsChanged={onViewRef.current}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
      />
    </View>
  );
}

// Styles

const VIBE_GAP = SPACING.md;
const VIBE_COLS = 3;
const VIBE_W = (SCREEN_W - SPACING.xl * 2 - VIBE_GAP * (VIBE_COLS - 1)) / VIBE_COLS;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: SPACING.xl,
  },
  dot: {
    height: 6,
    borderRadius: RADIUS.full,
  },
  dotActive:   { width: 20, backgroundColor: COLORS.purple400 },
  dotInactive: { width: 6,  backgroundColor: COLORS.borderLight },

  // Intro slides
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.base,
  },
  slideEmoji: {
    fontSize: 72,
    marginBottom: SPACING.sm,
  },
  slideTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.display,
    fontWeight: FONT_WEIGHT.bold,
    textAlign: 'center',
  },
  slideBody: {
    color: COLORS.textSub,
    fontSize: FONT_SIZE.bodyLg,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: SPACING.xl,
  },

  // Preferences slide
  prefTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.display,
    fontWeight: FONT_WEIGHT.bold,
    textAlign: 'center',
  },
  prefSub: {
    color: COLORS.textSub,
    fontSize: FONT_SIZE.body,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  vibeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: VIBE_GAP,
    marginBottom: SPACING.xl,
  },
  vibeItem: {
    width: VIBE_W,
    alignItems: 'center',
    padding: SPACING.base,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(17,24,39,0.80)',
    gap: 3,
    position: 'relative',
  },
  vibeItemActive: {
    borderColor: COLORS.purple500,
    backgroundColor: COLORS.purpleBg40,
  },
  vibeEmoji: { fontSize: 26 },
  vibeLabel: {
    color: COLORS.text,
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.semibold,
    textAlign: 'center',
  },
  vibeDesc: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    textAlign: 'center',
  },
  checkDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.purple500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: COLORS.white,
    fontSize: 8,
    fontWeight: FONT_WEIGHT.bold,
  },

  // Buttons
  primaryBtn: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.purple600,
    height: 50,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled:    { opacity: 0.6 },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.bodyLg,
    fontWeight: FONT_WEIGHT.semibold,
  },
  skipBtn: {
    paddingVertical: SPACING.md,
  },
  skipText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.body,
    textAlign: 'center',
  },
  // Fix 6: consent row
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 1.5, borderColor: COLORS.borderLight,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1, flexShrink: 0,
  },
  checkboxActive: { borderColor: COLORS.purple500, backgroundColor: COLORS.purple600 },
  checkboxTick:   { color: COLORS.white, fontSize: 12, fontWeight: FONT_WEIGHT.bold },
  consentText:    { flex: 1, color: COLORS.textSub, fontSize: FONT_SIZE.sm, lineHeight: 18 },
  consentBold:    { color: COLORS.text, fontWeight: FONT_WEIGHT.medium },
  consentLink:    { color: COLORS.purple400 },
});
