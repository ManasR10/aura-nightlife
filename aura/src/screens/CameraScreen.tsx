/**
 * CameraScreen — action sheet entry point for live contributions.
 *
 * Shows three options instead of blindly opening the camera on every tab tap:
 *   1. Post Live Video → opens camera → UploadFlow
 *   2. Check In        → navigates to ClaimReward (venue picker first)
 *   3. Cancel / back
 *
 * The camera only opens when the user deliberately picks "Post Live Video",
 * and only once per session (not re-fired on every tab re-visit since tabs
 * are now kept mounted with display:none).
 */
import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme';
import { UploadFlow } from '../components/UploadFlow';
import { launchCameraWithPerms, showCameraError } from '../utils/camera';

interface Props {
  /** Called when the user taps "Check In at a Venue" — switches to the
   *  Explore tab so they can pick a venue and continue to ClaimReward. */
  onCheckIn?: () => void;
}

export function CameraScreen({ onCheckIn }: Props) {
  const insets = useSafeAreaInsets();
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  async function openCamera() {
    setLaunching(true);
    const result = await launchCameraWithPerms({
      mediaType:      'video',
      videoQuality:   'high',
      durationLimit:  30,
      includeBase64:  false,
    });
    setLaunching(false);
    if (result.kind === 'success') {
      setVideoUri(result.uri);
    } else {
      showCameraError(result);
    }
  }

  function handleRetake() {
    setVideoUri(null);
    openCamera();
  }

  // After recording — show the upload flow
  if (videoUri) {
    return (
      <UploadFlow
        videoUri={videoUri}
        preselectedVenueId={null}
        preselectedVenueName={null}
        onRetakePress={handleRetake}
      />
    );
  }

  // Action sheet — default camera tab view
  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Post Live</Text>
        <Text style={styles.headerSub}>Share what's happening at a venue right now</Text>
      </View>

      <View style={styles.actions}>
        <ActionCard
          emoji="🎥"
          title="Post Live Video"
          desc="Record up to 30s · geo-verify · earn ₹10"
          primary
          loading={launching}
          onPress={openCamera}
        />

        <ActionCard
          emoji="📍"
          title="Check In at a Venue"
          desc="Confirm you're there · claim your reward"
          onPress={onCheckIn ?? (() => {})}
        />
      </View>

      <Text style={styles.footerNote}>
        Only geo-verified posts boost a venue's live score.
      </Text>
    </View>
  );
}

function ActionCard({
  emoji, title, desc, primary, loading, onPress,
}: {
  emoji: string;
  title: string;
  desc: string;
  primary?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        primary && styles.cardPrimary,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
    >
      <Text style={styles.cardEmoji}>{loading ? '⏳' : emoji}</Text>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, primary && styles.cardTitlePrimary]}>{title}</Text>
        <Text style={styles.cardDesc}>{desc}</Text>
      </View>
      <Text style={[styles.cardArrow, primary && styles.cardArrowPrimary]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: COLORS.bg,
    paddingHorizontal: SPACING.base, justifyContent: 'center',
  },
  header: { marginBottom: SPACING.xxxl, alignItems: 'center', gap: SPACING.sm },
  headerTitle: {
    color: COLORS.text, fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold,
  },
  headerSub: {
    color: COLORS.textSub, fontSize: FONT_SIZE.body, textAlign: 'center', lineHeight: 22,
  },
  actions: { gap: SPACING.md },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, padding: SPACING.xl,
  },
  cardPrimary:  { backgroundColor: COLORS.purpleBg20, borderColor: COLORS.purple500 },
  cardPressed:  { opacity: 0.85 },
  cardEmoji:    { fontSize: 32 },
  cardText:     { flex: 1, gap: 4 },
  cardTitle:    { color: COLORS.text, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
  cardTitlePrimary: { color: COLORS.purple200 },
  cardDesc:     { color: COLORS.textSub, fontSize: FONT_SIZE.sm, lineHeight: 18 },
  cardArrow:    { color: COLORS.textMuted, fontSize: 28, lineHeight: 32 },
  cardArrowPrimary: { color: COLORS.purple400 },
  footerNote: {
    color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center',
    marginTop: SPACING.xxl,
  },
});
