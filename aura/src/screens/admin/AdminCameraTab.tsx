/**
 * AdminCameraTab — purpose-built official posting experience for venue operators.
 *
 * Not the user-facing UploadFlow. Designed for operators:
 *   1. Pick vibe (required — this is your official status update)
 *   2. Record or pick a clip (optional but strongly encouraged)
 *   3. Add an opening note (optional, shows on venue page)
 *   4. Post — calls adminSubmitSignal + optionally adminUpdateVenue
 *
 * Venue context is pre-set — no search, no venue picker.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { createThumbnail } from 'react-native-create-thumbnail';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import { Video, Camera, CheckCircle } from 'lucide-react-native';
import { fnSouth } from '../../firebase/fns';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../theme';

interface Props { venueId: string; venueName: string }

type VibeTag = 'hot' | 'okay' | 'slow';

const VIBE_OPTIONS: Array<{
  tag: VibeTag; emoji: string; label: string; desc: string;
  border: string; bg: string; text: string;
}> = [
  { tag: 'hot',  emoji: '🔥', label: 'Hot',  desc: 'Packed & buzzing',   border: '#f9731644', bg: '#f9731611', text: '#fb923c' },
  { tag: 'okay', emoji: '✅', label: 'Okay', desc: 'Good crowd, decent', border: '#34d39944', bg: '#34d39911', text: '#34d399' },
  { tag: 'slow', emoji: '😴', label: 'Slow', desc: 'Quiet tonight',      border: '#6b728044', bg: '#6b728011', text: '#9ca3af' },
];

export function AdminCameraTab({ venueId, venueName }: Props) {
  const insets = useSafeAreaInsets();

  const [selectedVibe,   setSelectedVibe]   = useState<VibeTag | null>(null);
  const [videoUri,       setVideoUri]       = useState<string | null>(null);
  const [openingNote,    setOpeningNote]    = useState('');
  const [uploading,      setUploading]      = useState(false);
  const [uploadPct,      setUploadPct]      = useState(0);
  const [posted,         setPosted]         = useState(false);

  function pickVideo() {
    Alert.alert('Add a Clip', 'Optional — makes the update more engaging', [
      {
        text: 'Record Now', onPress: () =>
          launchCamera({ mediaType: 'video', videoQuality: 'high', durationLimit: 30 }, (r) => {
            if (r.assets?.[0]?.uri) setVideoUri(r.assets[0].uri);
          }),
      },
      {
        text: 'Choose from Library', onPress: () =>
          launchImageLibrary({ mediaType: 'video' }, (r) => {
            if (r.assets?.[0]?.uri) setVideoUri(r.assets[0].uri);
          }),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handlePost() {
    if (!selectedVibe) { Alert.alert('Pick a vibe first'); return; }
    const uid = auth().currentUser?.uid;
    if (!uid) return;

    setUploading(true);
    setUploadPct(0);

    try {
      let mediaRef: string | null = null;
      let thumbnailRef: string | null = null;

      if (videoUri) {
        // Upload video
        const ext  = videoUri.split('.').pop() ?? 'mp4';
        const path = `liveSignals/${uid}/${Date.now()}.${ext}`;
        const ref  = storage().ref(path);
        const task = ref.putFile(videoUri);
        task.on('state_changed', (snap) =>
          setUploadPct(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        );
        await task;
        mediaRef = await ref.getDownloadURL();

        // Generate thumbnail
        try {
          const thumb = await createThumbnail({ url: videoUri, timeStamp: 0 });
          const tRef  = storage().ref(`liveSignals/${uid}/thumbs/${Date.now()}.jpg`);
          await tRef.putFile(thumb.path);
          thumbnailRef = await tRef.getDownloadURL();
        } catch { /* best-effort */ }
      }

      await fnSouth.httpsCallable('adminSubmitSignal')({
        venueId,
        signalType:   videoUri ? 'video' : 'vibe',
        mediaRef,
        thumbnailRef,
        vibeTag:      selectedVibe,
      });

      if (openingNote.trim()) {
        await fnSouth.httpsCallable('adminUpdateVenue')({
          venueId,
          updates: { openingNote: openingNote.trim() },
        });
      }

      setPosted(true);
    } catch (err: unknown) {
      Alert.alert('Post failed', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  }

  // ── Success ───────────────────────────────────────────────────────────────

  if (posted) {
    return (
      <View style={[s.success, { paddingTop: insets.top }]}>
        <CheckCircle size={52} color={COLORS.purple400} />
        <Text style={s.successTitle}>Update posted!</Text>
        <Text style={s.successSub}>
          {videoUri ? 'Your official clip is live for 2 hours.' : 'Vibe status updated for nearby users.'}
        </Text>
        <Pressable style={s.postAgainBtn} onPress={() => {
          setPosted(false); setSelectedVibe(null);
          setVideoUri(null); setOpeningNote('');
        }}>
          <Text style={s.postAgainBtnText}>Post Another</Text>
        </Pressable>
      </View>
    );
  }

  // ── Main ──────────────────────────────────────────────────────────────────

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Post Official Update</Text>
          <Text style={s.headerVenue} numberOfLines={1}>{venueName}</Text>
        </View>
        <Camera size={20} color="#6b7280" />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Vibe — required */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>HOW IS IT RIGHT NOW? <Text style={s.required}>*</Text></Text>
          <View style={s.vibeRow}>
            {VIBE_OPTIONS.map((opt) => {
              const active = selectedVibe === opt.tag;
              return (
                <Pressable
                  key={opt.tag}
                  style={[s.vibeCard, { borderColor: active ? opt.border : '#1f2937', backgroundColor: active ? opt.bg : '#111827' }]}
                  onPress={() => setSelectedVibe(opt.tag)}
                >
                  <Text style={s.vibeEmoji}>{opt.emoji}</Text>
                  <Text style={[s.vibeLabel, { color: active ? opt.text : '#9ca3af' }]}>{opt.label}</Text>
                  <Text style={s.vibeDesc}>{opt.desc}</Text>
                  {active && <View style={[s.vibeCheckDot, { backgroundColor: opt.text }]} />}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Clip — optional */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>ADD A CLIP <Text style={s.optional}>(optional)</Text></Text>
          {videoUri ? (
            <View style={s.clipCard}>
              <Video size={22} color={COLORS.purple400} />
              <View style={{ flex: 1 }}>
                <Text style={s.clipReady}>Clip ready</Text>
                <Text style={s.clipHint}>Will post as official venue content</Text>
              </View>
              <Pressable onPress={() => setVideoUri(null)} style={s.clipRemove}>
                <Text style={s.clipRemoveText}>Remove</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={s.addClipBtn} onPress={pickVideo}>
              <Camera size={20} color={COLORS.purple400} />
              <View style={{ flex: 1 }}>
                <Text style={s.addClipText}>Record or Choose Clip</Text>
                <Text style={s.addClipHint}>Up to 30 seconds · shown as Official in the feed</Text>
              </View>
            </Pressable>
          )}
        </View>

        {/* Opening note — optional */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>OPENING NOTE <Text style={s.optional}>(optional)</Text></Text>
          <TextInput
            style={s.noteInput}
            value={openingNote}
            onChangeText={setOpeningNote}
            placeholder="e.g. Ladies night till 11 PM, DJ starts at 10, Entry ₹500"
            placeholderTextColor="#4b5563"
            multiline
            maxLength={140}
          />
          <Text style={s.charCount}>{openingNote.length}/140</Text>
        </View>
      </ScrollView>

      {/* Post button */}
      <View style={[s.footer, { paddingBottom: insets.bottom + SPACING.base }]}>
        {uploading && (
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${uploadPct}%` as `${number}%` }]} />
            <Text style={s.progressText}>Uploading… {uploadPct}%</Text>
          </View>
        )}
        <Pressable
          style={[s.postBtn, (!selectedVibe || uploading) && s.postBtnDisabled]}
          onPress={handlePost}
          disabled={!selectedVibe || uploading}
        >
          {uploading
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={s.postBtnText}>
                {videoUri ? 'Post Clip Update' : 'Post Vibe Update'}
              </Text>
          }
        </Pressable>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#030712' },
  success:     { flex: 1, backgroundColor: '#030712', alignItems: 'center', justifyContent: 'center', gap: SPACING.md, paddingHorizontal: SPACING.xxl },
  successTitle:{ color: '#fff', fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold },
  successSub:  { color: '#9ca3af', fontSize: FONT_SIZE.body, textAlign: 'center' },
  postAgainBtn:{ marginTop: SPACING.sm, backgroundColor: COLORS.purple600, borderRadius: 12, paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.md },
  postAgainBtnText: { color: '#fff', fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },

  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: '#1f2937',
  },
  headerTitle: { color: '#fff',     fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.bold },
  headerVenue: { color: '#9ca3af', fontSize: FONT_SIZE.sm, marginTop: 2 },

  scroll:       { flex: 1 },
  scrollContent:{ padding: SPACING.base, gap: SPACING.lg },

  section:      { gap: SPACING.sm },
  sectionLabel: { color: '#6b7280', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 0.8 },
  required:     { color: '#f87171' },
  optional:     { color: '#4b5563', fontWeight: FONT_WEIGHT.regular, letterSpacing: 0 },

  vibeRow: { flexDirection: 'row', gap: SPACING.sm },
  vibeCard: {
    flex: 1, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md,
    alignItems: 'center', gap: 4, position: 'relative',
  },
  vibeEmoji:    { fontSize: 26 },
  vibeLabel:    { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, textAlign: 'center' },
  vibeDesc:     { color: '#6b7280', fontSize: 9, textAlign: 'center', lineHeight: 13 },
  vibeCheckDot: { position: 'absolute', top: -4, right: -4, width: 12, height: 12, borderRadius: 6 },

  addClipBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderWidth: 1.5, borderColor: '#2e1065', borderStyle: 'dashed',
    borderRadius: RADIUS.md, padding: SPACING.md, backgroundColor: '#0d0618',
  },
  addClipText: { color: COLORS.purple400, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium },
  addClipHint: { color: '#6b7280', fontSize: FONT_SIZE.xs, marginTop: 2 },

  clipCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: '#111827', borderWidth: 1, borderColor: COLORS.purple700,
    borderRadius: RADIUS.md, padding: SPACING.md,
  },
  clipReady:      { color: '#fff',     fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium },
  clipHint:       { color: '#9ca3af', fontSize: FONT_SIZE.xs, marginTop: 2 },
  clipRemove:     { paddingHorizontal: SPACING.sm },
  clipRemoveText: { color: '#f87171', fontSize: FONT_SIZE.sm },

  noteInput: {
    backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937',
    borderRadius: RADIUS.md, padding: SPACING.base, color: '#fff',
    fontSize: FONT_SIZE.body, minHeight: 80, textAlignVertical: 'top',
  },
  charCount: { color: '#4b5563', fontSize: FONT_SIZE.xs, textAlign: 'right' },

  footer:        { paddingHorizontal: SPACING.base, borderTopWidth: 1, borderTopColor: '#1f2937', paddingTop: SPACING.sm, backgroundColor: '#030712' },
  progressBar:   { height: 28, backgroundColor: '#111827', borderRadius: RADIUS.sm, overflow: 'hidden', justifyContent: 'center', marginBottom: SPACING.sm },
  progressFill:  { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: COLORS.purple600 },
  progressText:  { position: 'absolute', alignSelf: 'center', color: '#fff', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },
  postBtn:       { height: 50, backgroundColor: COLORS.purple600, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  postBtnDisabled:{ opacity: 0.4 },
  postBtnText:   { color: '#fff', fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
});
