/**
 * OverviewTab — first tab on VenueDetailScreen. Shows the venue's opening
 * note, live activity stats, today's promotions, the next event preview,
 * and a 3-col grid of the latest media (link to the media tab for more).
 */
import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { COLORS } from '../../theme';
import { IconFilm, IconUsers, IconMusic } from '../Icon';
import type { EventDoc, LiveSignalDoc } from '../../services/events';
import type { VenueLive } from '../../types';
import { venueDetailStyles as s } from './styles';
import type { VenueMeta } from './types';

interface OverviewTabProps {
  meta:            VenueMeta;
  live:            VenueLive | null;
  events:          EventDoc[];
  signals:         LiveSignalDoc[];
  tonightEvent:    EventDoc | null;
  onPostClip:      () => void;
  onBookEvent:     (event: EventDoc) => void;
  onSeeEvents:     () => void;
  onSeeMedia:      () => void;
}

export function OverviewTab({
  meta, live, events, signals, tonightEvent,
  onPostClip, onBookEvent, onSeeEvents, onSeeMedia,
}: OverviewTabProps) {
  return (
    <View style={s.tabContent}>
      {meta.openingNote ? (
        <View style={s.openingNoteCard}>
          <View style={s.openingNoteRow}>
            <Text style={s.openingNoteIcon}>📢</Text>
            <Text style={s.openingNoteLabel}>From the venue</Text>
          </View>
          <Text style={s.openingNoteText}>{meta.openingNote}</Text>
        </View>
      ) : null}

      {live && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Live Updates</Text>
          <View style={s.liveStatRow}>
            <View style={s.liveStat}>
              <IconUsers size={15} color={COLORS.purple400} />
              <Text style={s.liveStatLabel}>Crowd Level</Text>
            </View>
            <Text style={s.liveStatValue}>{live.crowdLabel ?? '—'}</Text>
          </View>
          {live.vibeLabel && live.vibeLabel !== 'unknown' && (
            <View style={s.liveStatRow}>
              <View style={s.liveStat}>
                <IconMusic size={15} color={COLORS.purple400} />
                <Text style={s.liveStatLabel}>Vibe</Text>
              </View>
              <Text style={s.liveStatValue}>
                {live.vibeLabel === 'hot' ? '🔥 Buzzing' : live.vibeLabel === 'okay' ? '✅ Decent' : '😴 Quiet'}
              </Text>
            </View>
          )}
        </View>
      )}

      {meta.promotions.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Today's Promotions</Text>
          {meta.promotions.map((promo, idx) => (
            <View key={idx} style={s.promoRow}>
              <Text style={s.promoText} numberOfLines={2}>{promo}</Text>
              <Pressable style={s.claimBtn} onPress={onPostClip}>
                <Text style={s.claimBtnText}>Claim</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {(events.length > 0 || tonightEvent) && (
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Upcoming Events</Text>
            <Pressable onPress={onSeeEvents}>
              <Text style={s.seeAll}>See All</Text>
            </Pressable>
          </View>
          {tonightEvent && (
            <View style={s.eventPreviewRow}>
              {tonightEvent.imageUrl ? (
                <Image source={{ uri: tonightEvent.imageUrl }} style={s.eventPreviewImg} />
              ) : (
                <View style={[s.eventPreviewImg, s.eventPreviewImgFallback]} />
              )}
              <View style={s.eventPreviewText}>
                <Text style={s.eventPreviewTitle} numberOfLines={2}>{tonightEvent.title}</Text>
                <Text style={s.eventPreviewDate}>
                  {tonightEvent.status === 'ongoing' ? '🔴 Happening Now' : '✦ Tonight'}
                </Text>
                {tonightEvent.priceText && (
                  <Pressable style={s.ticketBtn} onPress={() => onBookEvent(tonightEvent)}>
                    <Text style={s.ticketBtnText}>Tickets from {tonightEvent.priceText}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        </View>
      )}

      <View style={s.card}>
        <View style={s.cardHeader}>
          <View style={s.cardTitleRow}>
            <Text style={s.cardTitle}>Live Media</Text>
            <View style={s.livePill}>
              <View style={s.liveDot} />
              <Text style={s.livePillText}>LIVE</Text>
            </View>
          </View>
          <Pressable onPress={onSeeMedia}>
            <Text style={s.seeAll}>See All</Text>
          </Pressable>
        </View>
        {signals.length > 0 ? (
          <View style={s.mediaGrid3}>
            {signals.slice(0, 6).map(sig => (
              <View key={sig.signalId} style={s.mediaThumb3}>
                {sig.thumbnailUrl ? (
                  <Image source={{ uri: sig.thumbnailUrl }} style={s.mediaThumbImg} resizeMode="cover" />
                ) : (
                  <View style={[s.mediaThumbImg, s.mediaThumbFallback]}>
                    <Text style={s.mediaFallbackEmoji}>🎥</Text>
                  </View>
                )}
                <View style={s.mediaThumbOverlay}>
                  <View style={s.mediaPlayIcon}>
                    <IconFilm size={14} color={COLORS.white} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={s.emptyMedia}>
            <Text style={s.emptyMediaText}>No live videos yet — be the first!</Text>
          </View>
        )}
      </View>
    </View>
  );
}
