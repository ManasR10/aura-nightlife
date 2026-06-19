/**
 * EventsTab — full list of upcoming + ongoing events at this venue with
 * Book Now / VIP Options actions. Empty state when there's nothing tonight.
 */
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../theme';
import { IconCalendar, IconTicket } from '../Icon';
import type { EventDoc } from '../../services/events';
import { venueDetailStyles as s } from './styles';

interface EventsTabProps {
  events:       EventDoc[];
  venueName:    string;
  onBookEvent:  (event: EventDoc) => void;
  onOpenVip:    () => void;
}

export function EventsTab({ events, venueName, onBookEvent, onOpenVip }: EventsTabProps) {
  return (
    <View style={s.tabContent}>
      <Text style={s.tabSectionTitle}>Events at {venueName}</Text>
      {events.length > 0 ? events.map(event => (
        <View key={event.eventId} style={s.eventCard}>
          <View style={s.eventCardImg}>
            {event.imageUrl ? (
              <Image source={{ uri: event.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.bgCard }]} />
            )}
            <View style={s.eventCardOverlay} />
            <View style={s.eventCardFooter}>
              <Text style={s.eventCardTitle} numberOfLines={2}>{event.title}</Text>
              <View style={s.eventCardDateRow}>
                <IconCalendar size={13} color={COLORS.purple400} />
                <Text style={s.eventCardDate}>
                  {event.status === 'ongoing' ? '🔴 Happening Now' : '✦ Tonight'}
                </Text>
              </View>
            </View>
          </View>
          <View style={s.eventCardBody}>
            {event.performers.length > 0 && (
              <View>
                <Text style={s.eventCardLineupLabel}>Lineup</Text>
                <View style={s.eventCardLineup}>
                  {event.performers.map((p, i) => (
                    <View key={i} style={s.performerBadge}>
                      <Text style={s.performerBadgeText}>{p}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            <View style={s.eventPriceRow}>
              <View style={s.eventPriceBox}>
                <Text style={s.eventPriceBoxLabel}>Standard Entry</Text>
                <Text style={s.eventPriceBoxValue}>{event.priceText ?? 'Check venue'}</Text>
              </View>
              <View style={s.eventPriceBox}>
                <Text style={s.eventPriceBoxLabel}>VIP Table</Text>
                <Text style={s.eventPriceBoxValue}>On request</Text>
              </View>
            </View>
            <View style={s.eventBtnRow}>
              <Pressable style={s.bookBtn} onPress={() => onBookEvent(event)}>
                <IconTicket size={16} color={COLORS.white} />
                <Text style={s.bookBtnText}>Book Now</Text>
              </Pressable>
              <Pressable style={s.vipBtn} onPress={onOpenVip}>
                <Text style={s.vipBtnText}>VIP Options</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )) : (
        <View style={s.emptyState}>
          <Text style={s.emptyStateText}>No upcoming events — check back tonight</Text>
        </View>
      )}
    </View>
  );
}
