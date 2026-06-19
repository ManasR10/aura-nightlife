/**
 * MediaTab — today's videos in a 2-col grid, older videos in a 3-col grid.
 * Tapping a thumbnail opens the ClipViewerModal owned by the parent.
 */
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../theme';
import { IconCamera, IconFilm } from '../Icon';
import { timeAgo } from '../../utils/time';
import type { LiveSignalDoc } from '../../services/events';
import { COL2_SIZE, COL3_SIZE, venueDetailStyles as s } from './styles';

interface MediaTabProps {
  todaySignals:  LiveSignalDoc[];
  olderSignals:  LiveSignalDoc[];
  onSelectClip:  (signal: LiveSignalDoc) => void;
  onAddVideo:    () => void;
}

export function MediaTab({ todaySignals, olderSignals, onSelectClip, onAddVideo }: MediaTabProps) {
  return (
    <View style={s.tabContent}>
      <View style={s.cardTitleRow}>
        <Text style={s.tabSectionTitle}>Live Media</Text>
        <View style={s.livePill}>
          <View style={s.liveDot} />
          <Text style={s.livePillText}>LIVE</Text>
        </View>
      </View>

      <Text style={s.mediaSectionLabel}>Today</Text>
      {todaySignals.length > 0 ? (
        <View style={s.mediaGrid2}>
          {todaySignals.map(sig => (
            <Pressable
              key={sig.signalId}
              style={[s.mediaThumb2, { width: COL2_SIZE }]}
              onPress={() => onSelectClip(sig)}
              accessibilityRole="button"
              accessibilityLabel="Play clip"
            >
              {sig.thumbnailUrl ? (
                <Image source={{ uri: sig.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, s.mediaThumbFallback]}>
                  <Text style={s.mediaFallbackEmoji}>🎥</Text>
                </View>
              )}
              <View style={s.mediaThumb2Overlay}>
                <View style={s.mediaPlayIconLg}>
                  <IconFilm size={22} color={COLORS.white} />
                </View>
              </View>
              <View style={s.mediaThumb2Footer}>
                <View style={s.mediaUserBadge}>
                  <Text style={s.mediaUserBadgeText} numberOfLines={1}>
                    {sig.sourceType === 'admin' ? 'Official' : 'User'}
                  </Text>
                </View>
                <Text style={s.mediaTime}>
                  {sig.createdAt ? timeAgo(sig.createdAt) : ''}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={s.emptyMedia}>
          <Text style={s.emptyMediaText}>No videos today yet</Text>
        </View>
      )}

      {olderSignals.length > 0 && (
        <>
          <View style={s.mediaSubHeader}>
            <Text style={s.mediaSectionLabel}>Previous Days</Text>
          </View>
          <View style={s.mediaGrid3Full}>
            {olderSignals.map(sig => (
              <Pressable
                key={sig.signalId}
                style={[s.mediaThumb3Full, { width: COL3_SIZE }]}
                onPress={() => onSelectClip(sig)}
                accessibilityRole="button"
                accessibilityLabel="Play clip"
              >
                {sig.thumbnailUrl ? (
                  <Image source={{ uri: sig.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <View style={[StyleSheet.absoluteFill, s.mediaThumbFallback]}>
                    <Text style={s.mediaFallbackEmoji}>🎥</Text>
                  </View>
                )}
                <View style={s.mediaThumbOverlay}>
                  <View style={s.mediaPlayIcon}>
                    <IconFilm size={12} color={COLORS.white} />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Pressable style={s.addVideoBtn} onPress={onAddVideo}>
        <IconCamera size={16} color={COLORS.text} />
        <Text style={s.addVideoBtnText}>Add Your Video</Text>
      </Pressable>
    </View>
  );
}
