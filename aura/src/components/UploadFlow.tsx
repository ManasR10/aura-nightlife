/**
 * UploadFlow — shared upload UI used by both RecordVideoScreen (from venue
 * detail) and CameraScreen (from the camera tab). Owns the venue picker,
 * vibe selector, optional note, geolocation capture, upload progress, and
 * the call to the submitLiveSignal Cloud Function.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createThumbnail } from 'react-native-create-thumbnail';
import Geolocation from '@react-native-community/geolocation';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import { fnSouth } from '../firebase/fns';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme';
import { getNearbyVenues, getTrendingVenues, type VenueResult } from '../services/venues';
import { checkRecentSignal } from '../services/events';

// ── Types ──────────────────────────────────────────────────────────────────────

export type VibeTag = 'hot' | 'okay' | 'slow';

export const VIBE_OPTIONS: Array<{ tag: VibeTag; emoji: string; label: string; desc: string; color: string }> = [
  { tag: 'hot',  emoji: '🔥', label: 'Hot',  desc: 'Packed & buzzing',   color: '#f97316' },
  { tag: 'okay', emoji: '✅', label: 'Okay', desc: 'Good crowd, decent', color: '#34d399' },
  { tag: 'slow', emoji: '😴', label: 'Slow', desc: 'Quiet tonight',      color: '#9ca3af' },
];

interface UploadFlowProps {
  videoUri:               string | null;
  preselectedVenueId:     string | null;
  preselectedVenueName:   string | null;
  onRetakePress:          () => void;
  onUploadSuccess?:       () => void;
}

export function UploadFlow({
  videoUri,
  preselectedVenueId,
  preselectedVenueName,
  onRetakePress,
  onUploadSuccess,
}: UploadFlowProps) {
  const insets = useSafeAreaInsets();

  const [venues,        setVenues]        = useState<VenueResult[]>([]);
  const [venueSearch,   setVenueSearch]   = useState('');
  const [selectedVenue, setSelectedVenue] = useState<VenueResult | null>(null);
  const [selectedVibe,  setSelectedVibe]  = useState<VibeTag | null>(null);
  const [note,          setNote]          = useState('');
  const [uploading,     setUploading]     = useState(false);
  const [uploadPct,     setUploadPct]     = useState(0);
  const [done,          setDone]          = useState(false);

  const successScale = useRef(new Animated.Value(0)).current;

  // Pre-select venue when opened from venue page
  useEffect(() => {
    if (preselectedVenueId && preselectedVenueName) {
      setSelectedVenue({
        placeId:    preselectedVenueId,
        name:       preselectedVenueName,
        address:    '',
        location:   { lat: 0, lng: 0 },
        rating:     null,
        userRatingCount: null,
        priceLevel: null,
        types:      [],
        isOpen:     null,
        currentOpeningHours: null,
        phone:      null,
        website:    null,
        attributes: { liveMusic: false, servesCocktails: false, goodForGroups: false, outdoorSeating: false },
        photos:     [],
        source:     'google_places',
      });
    }
  }, [preselectedVenueId, preselectedVenueName]);

  // Load venues for picker when no venue pre-selected
  useEffect(() => {
    if (preselectedVenueId) return;
    Geolocation.getCurrentPosition(
      ({ coords }) => {
        getNearbyVenues({ latitude: coords.latitude, longitude: coords.longitude, radiusMetres: 2000, maxResults: 20 })
          .then(setVenues)
          .catch(() => getTrendingVenues(20).then(setVenues));
      },
      () => { getTrendingVenues(20).then(setVenues); },
      { enableHighAccuracy: true, timeout: 6_000, maximumAge: 30_000 },
    );
  }, [preselectedVenueId]);

  const handleUpload = useCallback(async () => {
    if (!videoUri || !selectedVenue || !selectedVibe) return;

    const uid = auth().currentUser?.uid;
    if (!uid) { Alert.alert('Not signed in'); return; }

    setUploading(true);
    setUploadPct(0);

    try {
      // ── 1. Get precise GPS at upload moment ──────────────────────────
      const { latitude: userLat, longitude: userLng } = await new Promise<{ latitude: number; longitude: number }>(
        (resolve, reject) =>
          Geolocation.getCurrentPosition(
            ({ coords }) => resolve(coords),
            reject,
            { enableHighAccuracy: true, timeout: 8_000, maximumAge: 0 },
          ),
      );
      const locationTimestamp = Date.now();

      // ── 2. Duplicate check ───────────────────────────────────────────
      const { exists, minutesAgo } = await checkRecentSignal(uid, selectedVenue.placeId);
      if (exists) {
        const proceed = await new Promise<boolean>((resolve) =>
          Alert.alert(
            'Already posted here',
            `You shared an update at ${selectedVenue.name} ${minutesAgo} min ago. Post again?`,
            [
              { text: 'Cancel',     onPress: () => resolve(false) },
              { text: 'Post again', onPress: () => resolve(true), style: 'default' },
            ],
          ),
        );
        if (!proceed) { setUploading(false); return; }
      }

      // ── 3. Upload video to Firebase Storage ──────────────────────────
      const ext = videoUri.split('.').pop() ?? 'mp4';
      const storagePath = `liveSignals/${uid}/${Date.now()}.${ext}`;
      const ref = storage().ref(storagePath);
      const task = ref.putFile(videoUri);

      task.on('state_changed', (snap) => {
        setUploadPct(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
      });

      await task;
      const mediaUrl = await ref.getDownloadURL();

      // ── 4. Generate + upload thumbnail (best-effort) ─────────────────
      let thumbnailRef: string | null = null;
      let thumbStorageRef: ReturnType<ReturnType<typeof storage>['ref']> | null = null;
      try {
        const thumb = await createThumbnail({ url: videoUri, timeStamp: 0 });
        const thumbPath = `liveSignals/${uid}/thumbs/${Date.now()}.jpg`;
        thumbStorageRef = storage().ref(thumbPath);
        await thumbStorageRef.putFile(thumb.path);
        thumbnailRef = await thumbStorageRef.getDownloadURL();
      } catch {
        // Thumbnail generation is best-effort; proceed without it
      }

      // ── 5. Submit signal — Cloud Function verifies geofence ──────────
      // If submitLiveSignal rejects (geofence fail, rate limit, stale GPS),
      // clean up the orphan video + thumbnail so we don't leak Storage.
      try {
        await fnSouth.httpsCallable('submitLiveSignal')({
          venueId:      selectedVenue.placeId,
          userLat,
          userLng,
          locationTimestamp,
          signalType:   'video',
          vibeTag:      selectedVibe,
          mediaRef:     mediaUrl,
          thumbnailRef,
        });
      } catch (callableErr) {
        await ref.delete().catch(() => {});
        if (thumbStorageRef) await thumbStorageRef.delete().catch(() => {});
        throw callableErr;
      }

      if (onUploadSuccess) {
        onUploadSuccess();
        return;
      }
      setDone(true);
      Animated.spring(successScale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed.';
      if (msg.includes('Must be within')) {
        Alert.alert(
          'Too far from venue',
          `${msg}\n\nYou need to be inside the venue to post a live video.`,
        );
      } else {
        Alert.alert('Upload failed', msg);
      }
    } finally {
      setUploading(false);
    }
  }, [videoUri, selectedVenue, selectedVibe, successScale, onUploadSuccess]);

  // ── Success ────────────────────────────────────────────────────────────────
  if (done) {
    const vibe = VIBE_OPTIONS.find((v) => v.tag === selectedVibe)!;
    return (
      <View style={[flow.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Animated.View style={[flow.successRing, { transform: [{ scale: successScale }] }]}>
          <Text style={flow.successEmoji}>{vibe.emoji}</Text>
        </Animated.View>
        <Text style={flow.successTitle}>Video Posted!</Text>
        <Text style={flow.successSub}>
          Your update at{' '}
          <Text style={{ color: COLORS.purple400 }}>{selectedVenue?.name}</Text>
          {'\n'}is live for the next 2 hours.
        </Text>
        <Pressable style={flow.retakeBtn} onPress={onRetakePress}>
          <Text style={flow.retakeBtnText}>Record Another</Text>
        </Pressable>
      </View>
    );
  }

  // ── No video yet (camera cancelled or loading) ─────────────────────────────
  if (!videoUri) {
    return (
      <View style={[flow.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Text style={flow.waitEmoji}>🎥</Text>
        <Text style={flow.waitTitle}>Opening Camera...</Text>
        <Text style={flow.waitSub}>Record a 15–30 s clip of the venue</Text>
        <Pressable style={flow.retakeBtn} onPress={onRetakePress}>
          <Text style={flow.retakeBtnText}>Open Camera</Text>
        </Pressable>
      </View>
    );
  }

  const filteredVenues = venueSearch.trim()
    ? venues.filter((v) => v.name.toLowerCase().includes(venueSearch.toLowerCase()))
    : venues;

  // ── Upload screen ──────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[flow.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={flow.header}>
        <View style={flow.thumbnailWrap}>
          <Image source={{ uri: videoUri }} style={flow.thumbnail} resizeMode="cover" />
          <View style={flow.thumbnailBadge}>
            <Text style={flow.thumbnailBadgeText}>🎥 Video ready</Text>
          </View>
        </View>
        <Pressable style={flow.retakeInline} onPress={onRetakePress}>
          <Text style={flow.retakeInlineText}>Retake</Text>
        </Pressable>
      </View>

      <ScrollView
        style={flow.scroll}
        contentContainerStyle={[flow.scrollContent, { paddingBottom: insets.bottom + 110 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={flow.section}>
          <Text style={flow.sectionTitle}>
            <Text style={flow.stepNum}>1 </Text>Where is this?
          </Text>
          {selectedVenue ? (
            <View style={flow.selectedVenue}>
              <View style={{ flex: 1 }}>
                <Text style={flow.selectedVenueName}>{selectedVenue.name}</Text>
                {selectedVenue.address ? (
                  <Text style={flow.selectedVenueAddr} numberOfLines={1}>{selectedVenue.address}</Text>
                ) : null}
              </View>
              {!preselectedVenueId && (
                <Pressable onPress={() => setSelectedVenue(null)}>
                  <Text style={flow.changeText}>Change</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <>
              <TextInput
                style={flow.searchInput}
                placeholder="Search venue..."
                placeholderTextColor={COLORS.textMuted}
                value={venueSearch}
                onChangeText={setVenueSearch}
              />
              <View style={flow.venueList}>
                {filteredVenues.slice(0, 6).map((v) => (
                  <Pressable
                    key={v.placeId}
                    style={flow.venueRow}
                    onPress={() => setSelectedVenue(v)}
                  >
                    <Text style={flow.venueRowName} numberOfLines={1}>{v.name}</Text>
                    <Text style={flow.venueRowAddr} numberOfLines={1}>{v.address}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </View>

        {selectedVenue && (
          <View style={flow.section}>
            <Text style={flow.sectionTitle}>
              <Text style={flow.stepNum}>2 </Text>What's the vibe?
            </Text>
            <View style={flow.vibeRow}>
              {VIBE_OPTIONS.map((opt) => {
                const active = selectedVibe === opt.tag;
                return (
                  <Pressable
                    key={opt.tag}
                    style={[flow.vibeCard, active && { borderColor: opt.color, backgroundColor: opt.color + '18' }]}
                    onPress={() => setSelectedVibe(opt.tag)}
                  >
                    <Text style={flow.vibeEmoji}>{opt.emoji}</Text>
                    <Text style={[flow.vibeLabel, active && { color: opt.color }]}>{opt.label}</Text>
                    <Text style={flow.vibeDesc}>{opt.desc}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {selectedVibe && (
          <View style={flow.section}>
            <Text style={flow.sectionTitle}>
              <Text style={flow.stepNum}>3 </Text>
              Add a note <Text style={flow.optional}>(optional)</Text>
            </Text>
            <TextInput
              style={flow.noteInput}
              placeholder="e.g. DJ just started, guest list open..."
              placeholderTextColor={COLORS.textMuted}
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={120}
            />
            <Text style={flow.charCount}>{note.length}/120</Text>
          </View>
        )}
      </ScrollView>

      {selectedVenue && selectedVibe && (
        <View style={[flow.footer, { paddingBottom: insets.bottom + SPACING.sm }]}>
          {uploading ? (
            <View style={flow.progressWrap}>
              <View style={[flow.progressBar, { width: `${uploadPct}%` }]} />
              <Text style={flow.progressText}>Uploading… {uploadPct}%</Text>
            </View>
          ) : (
            <Pressable style={flow.uploadBtn} onPress={handleUpload}>
              <Text style={flow.uploadBtnText}>Upload & Post</Text>
            </Pressable>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const flow = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center:    {
    flex: 1, backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center',
    gap: SPACING.base, paddingHorizontal: SPACING.xl,
  },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.base,
    paddingHorizontal: SPACING.xl,
    paddingVertical:   SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  thumbnailWrap: {
    width: 72, height: 52, borderRadius: RADIUS.sm, overflow: 'hidden',
    backgroundColor: COLORS.bgCard, position: 'relative',
  },
  thumbnail:    { width: '100%', height: '100%' },
  thumbnailBadge: {
    position:        'absolute',
    bottom:          0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 2,
    alignItems:      'center',
  },
  thumbnailBadgeText: { color: COLORS.white, fontSize: 9 },
  retakeInline:     { marginLeft: 'auto' },
  retakeInlineText: { color: COLORS.purple400, fontSize: FONT_SIZE.body },

  scroll:        { flex: 1 },
  scrollContent: { padding: SPACING.xl, gap: SPACING.lg },

  section:      { gap: SPACING.sm },
  sectionTitle: { color: COLORS.text, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
  stepNum:      { color: COLORS.purple400 },
  optional:     { color: COLORS.textMuted, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.regular },

  searchInput: {
    height: 44, backgroundColor: COLORS.bgCard,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base, color: COLORS.text, fontSize: FONT_SIZE.body,
  },
  venueList: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  venueRow: {
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  venueRowName: { color: COLORS.text,    fontSize: FONT_SIZE.body },
  venueRowAddr: { color: COLORS.textSub, fontSize: FONT_SIZE.sm, marginTop: 2 },

  selectedVenue: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.purple600,
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  selectedVenueName: { color: COLORS.text,    fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.medium },
  selectedVenueAddr: { color: COLORS.textSub, fontSize: FONT_SIZE.sm, marginTop: 2 },
  changeText:        { color: COLORS.purple400, fontSize: FONT_SIZE.sm },

  vibeRow: { flexDirection: 'row', gap: SPACING.sm },
  vibeCard: {
    flex: 1, backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md, alignItems: 'center', gap: 4,
  },
  vibeEmoji: { fontSize: 24 },
  vibeLabel: { color: COLORS.textSub, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold },
  vibeDesc:  { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center' },

  noteInput: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.base,
    color: COLORS.text, fontSize: FONT_SIZE.body,
    minHeight: 72, textAlignVertical: 'top',
  },
  charCount: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'right' },

  footer: {
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm,
    borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.bg,
  },
  progressWrap: {
    height: 50, borderRadius: RADIUS.md, overflow: 'hidden',
    backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center',
  },
  progressBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: COLORS.purple600, opacity: 0.4,
  },
  progressText: { color: COLORS.text, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium },
  uploadBtn: {
    backgroundColor: COLORS.purple600, borderRadius: RADIUS.md,
    height: 50, alignItems: 'center', justifyContent: 'center',
  },
  uploadBtnText: { color: COLORS.white, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },

  waitEmoji:  { fontSize: 56 },
  waitTitle:  { color: COLORS.text,    fontSize: FONT_SIZE.title,  fontWeight: FONT_WEIGHT.bold,   textAlign: 'center' },
  waitSub:    { color: COLORS.textSub, fontSize: FONT_SIZE.bodyLg, textAlign: 'center' },
  retakeBtn: {
    marginTop: SPACING.base, backgroundColor: COLORS.purple600,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.md,
  },
  retakeBtnText: { color: COLORS.white, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
  successRing: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: COLORS.purpleBg20,
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm,
  },
  successEmoji:  { fontSize: 52 },
  successTitle:  { color: COLORS.text,    fontSize: FONT_SIZE.title,  fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  successSub:    { color: COLORS.textSub, fontSize: FONT_SIZE.bodyLg, textAlign: 'center', lineHeight: 24 },
});
