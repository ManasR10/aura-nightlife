/**
 * AdminUploadScreen — venue admin posts a live update.
 *
 * Modes:
 *   Vibe-only  — pick Hot / Okay / Slow + optional opening note → adminSubmitSignal(type:'vibe')
 *   With video — record or pick a clip → upload to Storage → adminSubmitSignal(type:'video')
 *
 * The opening note (≤140 chars) is also written to the venue profile via
 * adminUpdateVenue so it surfaces on the user-facing venue detail page.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { createThumbnail } from 'react-native-create-thumbnail';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme';
import { IconBack, IconCamera, IconFilm, IconX } from '../components/Icon';
import { fnSouth } from '../firebase/fns';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminUpload'>;

const VIBE_OPTIONS = [
  { tag: 'hot',  label: 'Hot',  emoji: '🔥', desc: 'Packed and buzzing' },
  { tag: 'okay', label: 'Okay', emoji: '✅', desc: 'Good crowd, decent vibe' },
  { tag: 'slow', label: 'Slow', emoji: '😴', desc: 'Quiet tonight' },
] as const;

type VibeTag = typeof VIBE_OPTIONS[number]['tag'];

export function AdminUploadScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { venueId, venueName } = route.params;

  const [selectedVibe,   setSelectedVibe]   = useState<VibeTag | null>(null);
  const [openingNote,    setOpeningNote]    = useState('');
  const [videoUri,       setVideoUri]       = useState<string | null>(null);
  const [videoName,      setVideoName]      = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [posting,        setPosting]        = useState(false);

  // Video helpers

  function promptVideo() {
    Alert.alert('Add Official Video', 'Record a 30-second clip or choose from library', [
      { text: 'Record Clip', onPress: () => recordClip() },
      { text: 'Choose from Library', onPress: () => pickFromLibrary() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function recordClip() {
    launchCamera(
      { mediaType: 'video', videoQuality: 'high', durationLimit: 30 },
      (res) => {
        if (res.assets?.[0]?.uri) {
          setVideoUri(res.assets[0].uri);
          setVideoName(res.assets[0].fileName ?? 'clip.mp4');
        }
      },
    );
  }

  function pickFromLibrary() {
    launchImageLibrary(
      { mediaType: 'video', videoQuality: 'high' },
      (res) => {
        if (res.assets?.[0]?.uri) {
          setVideoUri(res.assets[0].uri);
          setVideoName(res.assets[0].fileName ?? 'video.mp4');
        }
      },
    );
  }

  // Post

  async function handlePost() {
    if (!selectedVibe) {
      Alert.alert('Select a vibe', 'Pick how your venue is doing right now.');
      return;
    }

    setPosting(true);
    setUploadProgress(0);

    try {
      let mediaRef: string | null = null;

      // Upload video if attached
      if (videoUri) {
        const uid = auth().currentUser?.uid ?? 'admin';
        const ext = videoUri.split('.').pop() ?? 'mp4';
        const path = `liveSignals/${uid}/${Date.now()}.${ext}`;
        const ref  = storage().ref(path);
        const task = ref.putFile(videoUri);

        await new Promise<void>((resolve, reject) => {
          task.on(
            'state_changed',
            (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
            reject,
            () => resolve(),
          );
        });

        mediaRef = await ref.getDownloadURL();
      }

      // Generate + upload thumbnail (best-effort)
      let thumbnailRef: string | null = null;
      if (videoUri) {
        try {
          const uid  = auth().currentUser?.uid ?? 'admin';
          const thumb = await createThumbnail({ url: videoUri, timeStamp: 0 });
          const thumbPath = `liveSignals/${uid}/thumbs/${Date.now()}.jpg`;
          const thumbStorageRef = storage().ref(thumbPath);
          await thumbStorageRef.putFile(thumb.path);
          thumbnailRef = await thumbStorageRef.getDownloadURL();
        } catch {
          // best-effort
        }
      }

      // Submit signal
      await fnSouth.httpsCallable('adminSubmitSignal')({
        venueId,
        signalType: videoUri ? 'video' : 'vibe',
        mediaRef,
        thumbnailRef,
        vibeTag: selectedVibe,
      });

      // Update venue profile with opening note
      if (openingNote.trim()) {
        await fnSouth.httpsCallable('adminUpdateVenue')({
          venueId,
          updates: { openingNote: openingNote.trim() },
        });
      }

      Alert.alert(
        'Update posted! ✅',
        videoUri
          ? 'Your official video is live and will appear in the feed for 2 hours.'
          : 'Your venue\'s live status has been updated for users nearby.',
        [{ text: 'Done', onPress: () => navigation.goBack() }],
      );
    } catch (err: unknown) {
      Alert.alert('Post failed', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setPosting(false);
      setUploadProgress(0);
    }
  }

  // Render

  const isUploading = posting && videoUri != null && uploadProgress < 100;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <IconBack size={22} color={COLORS.textSub} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Post Update</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{venueName}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* Vibe selector */}
        <Text style={styles.sectionLabel}>HOW IS IT RIGHT NOW?</Text>
        <View style={styles.vibeGrid}>
          {VIBE_OPTIONS.map((opt) => {
            const selected = selectedVibe === opt.tag;
            return (
              <Pressable
                key={opt.tag}
                style={[styles.vibeCard, selected && styles.vibeCardSelected]}
                onPress={() => setSelectedVibe(opt.tag)}
              >
                <Text style={styles.vibeEmoji}>{opt.emoji}</Text>
                <Text style={[styles.vibeLabel, selected && styles.vibeLabelSelected]}>{opt.label}</Text>
                <Text style={styles.vibeDesc}>{opt.desc}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Official video */}
        <Text style={[styles.sectionLabel, { marginTop: SPACING.lg }]}>OFFICIAL VIDEO (OPTIONAL)</Text>

        {videoUri ? (
          <View style={styles.videoPreview}>
            {/* iOS shows first frame; Android shows placeholder */}
            <Image source={{ uri: videoUri }} style={styles.videoThumb} resizeMode="cover" />
            <View style={styles.videoOverlay}>
              <IconFilm size={28} color={COLORS.white} />
            </View>
            <View style={styles.videoInfo}>
              <Text style={styles.videoName} numberOfLines={1}>{videoName}</Text>
              <Text style={styles.videoHint}>Tap × to remove</Text>
            </View>
            <Pressable style={styles.videoRemove} onPress={() => { setVideoUri(null); setVideoName(''); }} hitSlop={8}>
              <IconX size={16} color={COLORS.white} />
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.videoAddBtn} onPress={promptVideo}>
            <IconCamera size={22} color={COLORS.purple400} />
            <Text style={styles.videoAddText}>Record or Choose Clip</Text>
            <Text style={styles.videoAddHint}>Up to 30 seconds · shown as Official in user feed</Text>
          </Pressable>
        )}

        {/* Upload progress bar */}
        {isUploading && (
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${uploadProgress}%` as `${number}%` }]} />
            <Text style={styles.progressText}>Uploading… {uploadProgress}%</Text>
          </View>
        )}

        {/* Opening note */}
        <Text style={[styles.sectionLabel, { marginTop: SPACING.lg }]}>OPENING NOTE (OPTIONAL)</Text>
        <TextInput
          style={styles.noteInput}
          value={openingNote}
          onChangeText={setOpeningNote}
          placeholder="e.g. Ladies night till 11, DJ starts at 10 PM, Entry ₹500"
          placeholderTextColor={COLORS.textMuted}
          multiline
          maxLength={140}
        />
        <Text style={styles.charCount}>{openingNote.length}/140</Text>

        {/* Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            This update appears instantly to nearby users and expires after 2 hours. It boosts your venue's live score on the AURA feed.
          </Text>
        </View>

      </ScrollView>

      {/* Post button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.base }]}>
        <Pressable
          style={[styles.postBtn, (!selectedVibe || posting) && styles.postBtnDisabled]}
          onPress={handlePost}
          disabled={!selectedVibe || posting}
        >
          {posting ? (
            <View style={styles.postingRow}>
              <ActivityIndicator color={COLORS.white} />
              <Text style={styles.postBtnText}>
                {isUploading ? `Uploading ${uploadProgress}%…` : 'Posting…'}
              </Text>
            </View>
          ) : (
            <Text style={styles.postBtnText}>
              {videoUri ? 'Post Video Update' : 'Post Live Update'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// Styles

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm,
  },
  backBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  title:      { color: COLORS.text,    fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
  subtitle:   { color: COLORS.textSub, fontSize: FONT_SIZE.sm },

  scroll:        { flex: 1 },
  scrollContent: { padding: SPACING.xl, gap: SPACING.sm },

  sectionLabel: {
    color: COLORS.textMuted, fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold, letterSpacing: 1, marginBottom: SPACING.xs,
  },

  vibeGrid: { flexDirection: 'row', gap: SPACING.sm },
  vibeCard: {
    flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.base,
    alignItems: 'center', gap: SPACING.xs,
  },
  vibeCardSelected: { borderColor: COLORS.purple600, backgroundColor: COLORS.purpleBg10 },
  vibeEmoji:        { fontSize: 28 },
  vibeLabel:        { color: COLORS.textSub, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold },
  vibeLabelSelected:{ color: COLORS.purple400 },
  vibeDesc:         { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center' },

  // Video
  videoAddBtn: {
    borderWidth: 1.5, borderColor: COLORS.purple700, borderStyle: 'dashed',
    borderRadius: RADIUS.md, padding: SPACING.lg,
    alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.purpleBg10,
  },
  videoAddText: { color: COLORS.purple400, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.medium },
  videoAddHint: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center' },

  videoPreview: {
    height: 160, borderRadius: RADIUS.md, overflow: 'hidden',
    backgroundColor: COLORS.bgCard, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, position: 'relative',
  },
  videoThumb:   { width: 120, height: '100%' },
  videoOverlay: {
    position: 'absolute', left: 0, top: 0, width: 120, height: '100%',
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  videoInfo:    { flex: 1, paddingHorizontal: SPACING.md, gap: SPACING.xs },
  videoName:    { color: COLORS.text, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium },
  videoHint:    { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  videoRemove: {
    position: 'absolute', top: SPACING.sm, right: SPACING.sm,
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },

  progressBar: {
    height: 28, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.sm,
    overflow: 'hidden', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    marginTop: SPACING.xs,
  },
  progressFill: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: COLORS.purple600,
  },
  progressText: {
    position: 'absolute', alignSelf: 'center',
    color: COLORS.white, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold,
  },

  noteInput: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.base, color: COLORS.text,
    fontSize: FONT_SIZE.body, minHeight: 80, textAlignVertical: 'top',
  },
  charCount: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'right' },

  infoBox: {
    marginTop: SPACING.base, padding: SPACING.base,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
  },
  infoText: { color: COLORS.textSub, fontSize: FONT_SIZE.sm, lineHeight: 20 },

  footer:          { paddingHorizontal: SPACING.xl, paddingTop: SPACING.base },
  postBtn: {
    backgroundColor: COLORS.purple600, borderRadius: RADIUS.md,
    height: 50, alignItems: 'center', justifyContent: 'center',
  },
  postBtnDisabled: { opacity: 0.4 },
  postBtnText:     { color: COLORS.white, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
  postingRow:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
});
