/**
 * ClipViewerModal — full-screen modal for viewing a single live clip (video
 * or thumbnail) with venue context, vibe, geo badge, and expiry. Opened from
 * VenueDetailScreen's signal grid.
 */
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Video from 'react-native-video';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme';
import type { LiveSignalDoc } from '../services/events';

const { width: CW, height: CH } = Dimensions.get('window');

const VIBE_MAP: Record<string, { label: string; color: string }> = {
  hot:  { label: '🔥 Hot',  color: '#f97316' },
  okay: { label: '✅ Okay', color: '#34d399' },
  slow: { label: '😴 Slow', color: '#9ca3af' },
};

interface ClipViewerModalProps {
  signal:    LiveSignalDoc | null;
  venueName: string;
  onClose:   () => void;
}

export function ClipViewerModal({ signal, venueName, onClose }: ClipViewerModalProps) {
  const [paused,  setPaused]  = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setPaused(true);
    setErrored(false);
  }, [signal?.signalId]);

  if (!signal) return null;

  const postedMins  = Math.round((Date.now() - signal.createdAt.toMillis()) / 60_000);
  const expiresMins = Math.max(0, Math.round((signal.expiresAt.toMillis() - Date.now()) / 60_000));
  const vibe        = signal.vibeTag ? VIBE_MAP[signal.vibeTag] : null;
  const hasVideo    = !!signal.mediaUrl && !errored;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={() => { setPaused(true); onClose(); }}>
      <View style={s.backdrop}>
        {hasVideo ? (
          <Pressable style={s.fullImg} onPress={() => setPaused((p) => !p)}>
            <Video
              source={{ uri: signal.mediaUrl! }}
              style={s.fullImg}
              resizeMode="cover"
              paused={paused}
              poster={signal.thumbnailUrl ?? undefined}
              posterResizeMode="cover"
              repeat
              onError={() => setErrored(true)}
            />
            {paused && (
              <View style={s.playCircle} pointerEvents="none">
                <Text style={s.playTriangle}>▶</Text>
              </View>
            )}
          </Pressable>
        ) : (
          <>
            {signal.thumbnailUrl ? (
              <Image source={{ uri: signal.thumbnailUrl }} style={s.fullImg} resizeMode="cover" />
            ) : (
              <View style={[s.fullImg, { backgroundColor: '#111' }]} />
            )}
            {errored && (
              <View style={s.errorNote}>
                <Text style={s.errorNoteText}>Could not play video</Text>
              </View>
            )}
          </>
        )}

        <View style={s.scrim} />

        <Pressable style={s.closeBtn} onPress={() => { setPaused(true); onClose(); }} hitSlop={12}>
          <Text style={s.closeText}>✕</Text>
        </Pressable>

        <View style={s.info}>
          {vibe && (
            <View style={[s.vibePill, { borderColor: vibe.color + '88' }]}>
              <Text style={[s.vibePillText, { color: vibe.color }]}>{vibe.label}</Text>
            </View>
          )}
          <Text style={s.venueName} numberOfLines={1}>{venueName}</Text>
          <View style={s.metaRow}>
            {signal.geoVerified && (
              <View style={s.geoBadge}>
                <Text style={s.geoText}>✓ Geo-verified</Text>
              </View>
            )}
            <Text style={s.metaTime}>
              {postedMins < 1 ? 'Just now' : `${postedMins}m ago`}
            </Text>
            {expiresMins > 0 && (
              <Text style={s.metaExpiry}>· Expires in {expiresMins}m</Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: '#000', width: CW, height: CH },
  fullImg:     { position: 'absolute', top: 0, left: 0, width: CW, height: CH },
  scrim: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: CH * 0.45,
    backgroundColor: 'rgba(0,0,0,0.70)',
  },
  closeBtn: {
    position: 'absolute', top: 52, right: SPACING.base,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: COLORS.white, fontSize: FONT_SIZE.bodyLg },
  playCircle: {
    position: 'absolute', alignSelf: 'center',
    top: CH / 2 - 40, left: CW / 2 - 40,
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  playTriangle: { color: COLORS.white, fontSize: 30, marginLeft: 5 },
  errorNote: {
    position: 'absolute', alignSelf: 'center', top: CH / 2 - 12,
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.xs, borderRadius: RADIUS.full,
  },
  errorNoteText: { color: COLORS.textSub, fontSize: FONT_SIZE.sm },
  info: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: SPACING.base, paddingBottom: SPACING.xxxl, gap: SPACING.sm,
  },
  vibePill: {
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md, paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.40)',
  },
  vibePillText:  { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold },
  venueName: {
    color: COLORS.white, fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.extrabold,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  metaRow:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flexWrap: 'wrap' },
  geoBadge: {
    backgroundColor: '#052e1688', borderWidth: 1, borderColor: '#16a34a',
    paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full,
  },
  geoText:    { color: '#4ade80', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.medium },
  metaTime:   { color: 'rgba(255,255,255,0.7)', fontSize: FONT_SIZE.sm },
  metaExpiry: { color: 'rgba(255,255,255,0.5)', fontSize: FONT_SIZE.sm },
});
