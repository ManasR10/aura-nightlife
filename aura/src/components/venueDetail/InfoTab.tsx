/**
 * InfoTab — venue basics (address, hours, phone, website, Instagram) plus
 * policies (dress code, age limit, cover charge). Pure presentational.
 */
import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { COLORS } from '../../theme';
import { IconMapPin, IconClock, IconPhone, IconGlobe, IconInstagram } from '../Icon';
import type { VenueResult } from '../../services/venues';
import { venueDetailStyles as s } from './styles';
import type { VenueMeta } from './types';

interface InfoTabProps {
  venue:      VenueResult | null;
  todayHours: string | null;
  meta:       VenueMeta;
}

export function InfoTab({ venue, todayHours, meta }: InfoTabProps) {
  return (
    <View style={s.tabContent}>
      <View style={s.card}>
        <Text style={s.cardTitle}>Basic Information</Text>
        {venue?.address && (
          <Pressable
            style={s.infoRow}
            onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(venue.address)}`)}
          >
            <IconMapPin size={16} color={COLORS.purple400} />
            <Text style={[s.infoLabel, s.infoLabelTappable]} numberOfLines={2}>{venue.address}</Text>
          </Pressable>
        )}
        {todayHours && (
          <View style={s.infoRow}>
            <IconClock size={16} color={COLORS.purple400} />
            <Text style={s.infoLabel} numberOfLines={2}>{todayHours}</Text>
          </View>
        )}
        {venue?.phone && (
          <Pressable style={s.infoRow} onPress={() => Linking.openURL(`tel:${venue.phone}`)}>
            <IconPhone size={16} color={COLORS.purple400} />
            <Text style={[s.infoLabel, s.infoLabelTappable]}>{venue.phone}</Text>
          </Pressable>
        )}
        {venue?.website && (
          <Pressable style={s.infoRow} onPress={() => Linking.openURL(venue.website!)}>
            <IconGlobe size={16} color={COLORS.purple400} />
            <Text style={[s.infoLabel, s.infoLabelTappable]} numberOfLines={1}>
              {venue.website.replace(/^https?:\/\//, '')}
            </Text>
          </Pressable>
        )}
        <View style={s.infoRow}>
          <IconInstagram size={16} color={COLORS.purple400} />
          <Text style={s.infoLabel}>{meta.instagram}</Text>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Policies</Text>
        <View style={s.policyRow}>
          <Text style={s.policyLabel}>Dress Code</Text>
          <Text style={s.policyValue}>{meta.dressCode}</Text>
        </View>
        <View style={s.policyRow}>
          <Text style={s.policyLabel}>Age Limit</Text>
          <Text style={s.policyValue}>{meta.ageLimit}</Text>
        </View>
        <View style={s.policyRow}>
          <Text style={s.policyLabel}>Cover Charge</Text>
          <Text style={s.policyValue}>{meta.coverCharge}</Text>
        </View>
      </View>
    </View>
  );
}
