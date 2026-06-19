/**
 * VenueDetailScreen — venue hub.
 *
 * Owns: data loading (venue / live / events / signals), tab selection,
 * modal state, share/favorite handlers. Defers each tab's render to a
 * focused component in components/venueDetail/. ClipViewerModal hosted
 * here so any tab that opens a clip uses the same player.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import { fnDefault } from '../firebase/fns';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '../theme';
import {
  IconBack, IconHeart, IconShare,
  IconMusic, IconUsers, IconCamera, IconGift, IconStar,
} from '../components/Icon';
import type { RootStackParamList } from '../types';
import type { VenueResult } from '../services/venues';
import type { VenueLive } from '../types';
import {
  getEventsForVenue,
  getVenueVideoSignals,
  type EventDoc,
  type LiveSignalDoc,
} from '../services/events';
import { trackEvent } from '../services/analytics';
import { placesPhotoUrl } from '../config';
import BookingModal    from '../components/BookingModal';
import VIPOptionsModal from '../components/VIPOptionsModal';
import PayViaAuraModal from '../components/PayViaAuraModal';
import { ClipViewerModal } from '../components/ClipViewerModal';
import { venueDetailStyles as styles } from '../components/venueDetail/styles';
import type { VenueAdminFields, VenueMeta, VenueDetailTabId as TabId } from '../components/venueDetail/types';
import { OverviewTab } from '../components/venueDetail/OverviewTab';
import { EventsTab }   from '../components/venueDetail/EventsTab';
import { MediaTab }    from '../components/venueDetail/MediaTab';
import { InfoTab }     from '../components/venueDetail/InfoTab';

type Props = NativeStackScreenProps<RootStackParamList, 'VenueDetail'>;

const VIBE_CONFIG: Record<string, { emoji: string; color: string; label: string }> = {
  hot:     { emoji: '🔥', color: '#f97316', label: 'Hot'  },
  okay:    { emoji: '✅', color: '#34d399', label: 'Okay' },
  slow:    { emoji: '😴', color: '#6b7280', label: 'Slow' },
  unknown: { emoji: '—',  color: '#374151', label: ''     },
};

const FALLBACK_COVER = 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&w=800';

export function VenueDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { venueId, venueName, coverPhotoUrl: passedCoverUrl } = route.params;

  const [venue,    setVenue]    = useState<VenueResult | null>(null);
  const [live,     setLive]     = useState<VenueLive | null>(null);
  const [events,   setEvents]   = useState<EventDoc[]>([]);
  const [signals,  setSignals]  = useState<LiveSignalDoc[]>([]);
  const [loading,  setLoading]  = useState(true);

  const [activeTab,  setActiveTab]  = useState<TabId>('overview');
  const [isFavorite, setIsFavorite] = useState(false);

  const [bookingVisible, setBookingVisible] = useState(false);
  const [selectedEvent,  setSelectedEvent]  = useState<{ name: string; date: string } | null>(null);
  const [vipVisible,     setVipVisible]     = useState(false);
  const [payAuraVisible, setPayAuraVisible] = useState(false);
  const [viewingClip,    setViewingClip]    = useState<LiveSignalDoc | null>(null);

  // Merge admin-enriched fields from Firestore with defaults. The venue doc
  // contains both Places API data (VenueResult) and any extra fields written
  // by adminUpdateVenue — cast through VenueAdminFields to access them.
  const admin = (venue as unknown as VenueAdminFields | null) ?? {} as VenueAdminFields;
  const meta: VenueMeta = {
    dressCode:   String(admin.dressCode   ?? ''),
    ageLimit:    String(admin.ageLimit    ?? ''),
    coverCharge: String(admin.coverCharge ?? ''),
    promotions:  admin.promotions?.filter(Boolean) ?? [],
    instagram:   admin.instagramHandle
      ? (admin.instagramHandle.startsWith('@') ? admin.instagramHandle : `@${admin.instagramHandle}`)
      : '',
    openingNote: admin.openingNote || null,
    bannerUrl:   admin.bannerUrl   || null,
  };

  useEffect(() => {
    trackEvent('venue_detail_view', venueId);
    let cancelled = false;

    async function load() {
      try {
        const [venueSnap, liveSnap, eventsRes, signalsRes] = await Promise.all([
          firestore().collection('venues').doc(venueId).get(),
          firestore().collection('venueLive').doc(venueId).get(),
          getEventsForVenue(venueId),
          getVenueVideoSignals(venueId),
        ]);
        if (cancelled) return;

        let venueData = venueSnap.exists() ? (venueSnap.data() as VenueResult) : null;

        if (!venueData || !venueData.photos?.length) {
          try {
            const result = await fnDefault.httpsCallable('getPlaceDetails')({ placeId: venueId });
            if (!cancelled && result.data) venueData = result.data as VenueResult;
          } catch (fnErr) {
            console.warn('getPlaceDetails fallback failed:', fnErr);
          }
        }

        if (!cancelled) {
          if (venueData) setVenue(venueData);
          if (liveSnap.exists()) setLive(liveSnap.data() as VenueLive);
          setEvents(eventsRes);
          setSignals(signalsRes);
        }
      } catch (err) {
        console.warn('VenueDetailScreen load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [venueId]);

  const coverUri = meta.bannerUrl
    || passedCoverUrl
    || (venue?.photos?.[0] ? placesPhotoUrl(venue.photos[0]) : '')
    || FALLBACK_COVER;
  const vibeLabel  = live?.vibeLabel ?? 'unknown';
  const vibe       = VIBE_CONFIG[vibeLabel];
  const tonightEvent = events.find(e => e.status === 'ongoing') ?? events[0] ?? null;
  const todayHours   = (() => {
    if (!venue?.currentOpeningHours?.length) return null;
    const day = new Date().getDay();
    const idx  = day === 0 ? 6 : day - 1;
    return venue.currentOpeningHours[idx] ?? venue.currentOpeningHours[0] ?? null;
  })();

  const handlePostClip = () => {
    trackEvent('video_upload', venueId);
    navigation.navigate('RecordVideo', { venueId, venueName });
  };

  const handleShare = () => {
    Share.share({ message: `Check out ${venueName} on Aura!${venue?.address ? ` — ${venue.address}` : ''}` })
      .catch(() => {});
  };

  const handleBookEvent = (event: EventDoc) => {
    const dateStr = event.startAt?.toDate()
      ? event.startAt.toDate().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : 'Tonight';
    setSelectedEvent({ name: event.title, date: dateStr });
    setBookingVisible(true);
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.purple400} size="large" />
      </View>
    );
  }

  // Split signals into today vs older for the Media tab.
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todaySignals = signals.filter(s => {
    const t = s.createdAt?.toDate();
    return t && t >= todayStart;
  });
  const olderSignals = signals.filter(s => {
    const t = s.createdAt?.toDate();
    return t && t < todayStart;
  });

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Cover */}
        <View style={styles.cover}>
          <Image source={{ uri: coverUri }} style={styles.coverImage} resizeMode="cover" />
          <View style={styles.coverOverlay} />

          <View style={[styles.coverTopRow, { top: insets.top + 8 }]}>
            <Pressable style={styles.actionCircle} onPress={() => navigation.goBack()}>
              <IconBack size={22} color={COLORS.white} />
            </Pressable>
            <View style={styles.coverTopRight}>
              <Pressable
                style={styles.actionCircle}
                onPress={() => {
                  const next = !isFavorite;
                  setIsFavorite(next);
                  trackEvent(next ? 'venue_save' : 'venue_unsave', venueId);
                }}
              >
                <IconHeart size={20} filled={isFavorite} color={isFavorite ? COLORS.live : COLORS.white} />
              </Pressable>
              <Pressable style={styles.actionCircle} onPress={handleShare}>
                <IconShare size={18} color={COLORS.white} />
              </Pressable>
            </View>
          </View>

          <View style={styles.coverFooter}>
            <View style={styles.coverBadgeRow}>
              {venue?.isOpen && (
                <View style={styles.openBadge}>
                  <Text style={styles.openText}>● OPEN</Text>
                </View>
              )}
              {live?.isLiveNow && (
                <View style={styles.liveBadge}>
                  <Text style={styles.liveText}>● LIVE</Text>
                </View>
              )}
              {vibeLabel !== 'unknown' && (
                <View style={[styles.vibeBadge, { backgroundColor: vibe.color + '33' }]}>
                  <Text style={[styles.vibeBadgeText, { color: vibe.color }]}>
                    {vibe.emoji} {vibe.label}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.coverName}>{venueName}</Text>
            {venue?.address ? (
              <Text style={styles.coverAddress} numberOfLines={1}>{venue.address}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.body}>

          {/* Identity row */}
          <View style={styles.identityRow}>
            <View style={styles.logoBox}>
              <Image source={{ uri: coverUri }} style={styles.logo} resizeMode="cover" />
            </View>
            <View style={styles.identityText}>
              <View style={styles.nameBadgeRow}>
                <Text style={styles.venueName} numberOfLines={1}>{venueName}</Text>
                {venue?.isOpen && (
                  <View style={styles.openPill}>
                    <Text style={styles.openPillText}>Open Now</Text>
                  </View>
                )}
              </View>
              <View style={styles.ratingRow}>
                {venue?.types?.[0] && (
                  <Text style={styles.venueType}>{venue.types[0].replace(/_/g, ' ')}</Text>
                )}
                {venue?.rating != null && (
                  <>
                    <Text style={styles.dot}>·</Text>
                    <IconStar size={13} color={COLORS.warning} />
                    <Text style={styles.rating}>{venue.rating.toFixed(1)}</Text>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* CTAs */}
          <View style={styles.ctaSection}>
            <View style={styles.ctaRow}>
              <Pressable style={styles.ctaPrimary} onPress={handlePostClip}>
                <IconCamera size={18} color={COLORS.white} />
                <Text style={styles.ctaPrimaryText}>Post a Clip</Text>
              </Pressable>
              <Pressable
                style={styles.ctaSecondary}
                onPress={() => navigation.navigate('ClaimReward', { venueId, venueName })}
              >
                <IconGift size={18} color={COLORS.text} />
                <Text style={styles.ctaSecondaryText}>Check In & Earn</Text>
              </Pressable>
            </View>
          </View>

          {/* Quick info tiles */}
          {(live?.crowdLabel || live?.vibeLabel !== 'unknown') && (
            <View style={styles.tileRow}>
              {live?.crowdLabel ? (
                <View style={styles.tile}>
                  <IconUsers size={18} color={COLORS.purple400} />
                  <Text style={styles.tileText}>{live.crowdLabel}</Text>
                </View>
              ) : null}
              {live?.vibeLabel && live.vibeLabel !== 'unknown' ? (
                <View style={styles.tile}>
                  <IconMusic size={18} color={COLORS.purple400} />
                  <Text style={styles.tileText}>
                    {live.vibeLabel === 'hot' ? '🔥 Buzzing' : live.vibeLabel === 'okay' ? '✅ Decent' : '😴 Quiet'}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Policy badges */}
          {(meta.dressCode || meta.ageLimit) && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgeScroll}>
              {meta.dressCode ? (
                <View style={[styles.badge, styles.badgeMuted]}>
                  <Text style={styles.badgeText}>{meta.dressCode}</Text>
                </View>
              ) : null}
              {meta.ageLimit ? (
                <View style={[styles.badge, styles.badgeMuted]}>
                  <Text style={styles.badgeText}>{meta.ageLimit}+</Text>
                </View>
              ) : null}
            </ScrollView>
          )}

          {/* Tab bar */}
          <View style={styles.tabBar}>
            {(['overview', 'events', 'media', 'info'] as TabId[]).map(tab => (
              <Pressable
                key={tab}
                style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Active tab */}
          {activeTab === 'overview' && (
            <OverviewTab
              meta={meta}
              live={live}
              events={events}
              signals={signals}
              tonightEvent={tonightEvent}
              onPostClip={handlePostClip}
              onBookEvent={handleBookEvent}
              onSeeEvents={() => setActiveTab('events')}
              onSeeMedia={() => setActiveTab('media')}
            />
          )}

          {activeTab === 'events' && (
            <EventsTab
              events={events}
              venueName={venueName}
              onBookEvent={handleBookEvent}
              onOpenVip={() => setVipVisible(true)}
            />
          )}

          {activeTab === 'media' && (
            <MediaTab
              todaySignals={todaySignals}
              olderSignals={olderSignals}
              onSelectClip={setViewingClip}
              onAddVideo={() => navigation.navigate('RecordVideo', { venueId, venueName })}
            />
          )}

          {activeTab === 'info' && (
            <InfoTab venue={venue} todayHours={todayHours} meta={meta} />
          )}

        </View>
      </ScrollView>

      <ClipViewerModal
        signal={viewingClip}
        venueName={venueName}
        onClose={() => setViewingClip(null)}
      />

      {selectedEvent && (
        <BookingModal
          visible={bookingVisible}
          onClose={() => setBookingVisible(false)}
          eventName={selectedEvent.name}
          eventDate={selectedEvent.date}
        />
      )}
      <VIPOptionsModal
        visible={vipVisible}
        onClose={() => setVipVisible(false)}
        venueName={venueName}
      />
      <PayViaAuraModal
        visible={payAuraVisible}
        onClose={() => setPayAuraVisible(false)}
        venueName={venueName}
      />
    </View>
  );
}
