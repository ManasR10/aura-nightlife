/**
 * AdminDashboardScreen — 4-tab operator shell.
 *
 * Loads the venue list once here and passes context to all tabs so each tab
 * doesn't need its own Firestore venue fetch. Supports multi-venue admins via
 * a venue switcher exposed through AdminHomeTab.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT, SPACING } from '../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import firestore from '@react-native-firebase/firestore';
import { AdminVenueTabBar, type AdminTabName } from '../components/AdminVenueTabBar';
type FeedSubTab = 'guest' | 'venue';
import { AdminHomeTab }    from './admin/AdminHomeTab';
import { AdminFeedTab }    from './admin/AdminFeedTab';
import { AdminCameraTab }  from './admin/AdminCameraTab';
import { AdminProfileTab } from './admin/AdminProfileTab';
import { useAuth }         from '../auth/useAuth';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminDashboard'>;

export interface VenueOption { id: string; name: string }

export function AdminDashboardScreen({ navigation }: Props) {
  const { venueAdminDoc, signOut } = useAuth();
  const [activeTab,     setActiveTab]     = useState<AdminTabName>('home');
  const [feedSubTab,    setFeedSubTab]    = useState<FeedSubTab>('guest');
  const [venues,        setVenues]        = useState<VenueOption[]>([]);
  const [selectedIdx,   setSelectedIdx]   = useState(0);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [loadError,     setLoadError]     = useState(false);

  const venueIds = venueAdminDoc?.managedVenueIds ?? [];

  function loadVenues() {
    if (!venueIds.length) { setLoadingVenues(false); return; }
    setLoadingVenues(true);
    setLoadError(false);
    Promise.all(venueIds.map((id) => firestore().collection('venues').doc(id).get()))
      .then((snaps) =>
        setVenues(snaps.map((s) => ({ id: s.id, name: (s.data()?.name as string) ?? s.id }))),
      )
      .catch(() => setLoadError(true))
      .finally(() => setLoadingVenues(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadVenues(); }, [venueIds.join(',')]);

  // Clamp selectedIdx if venue list changes
  useEffect(() => {
    if (venues.length > 0 && selectedIdx >= venues.length) setSelectedIdx(0);
  }, [venues.length, selectedIdx]);

  // Empty / loading / error states

  if (loadingVenues) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.purple400} size="large" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>⚠️</Text>
        <Text style={styles.emptyTitle}>Couldn't load venue data</Text>
        <Text style={styles.emptySub}>Check your connection and try again.</Text>
        <Pressable style={styles.retryBtn} onPress={loadVenues}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!venueIds.length || venues.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>🏢</Text>
        <Text style={styles.emptyTitle}>No venues assigned yet</Text>
        <Text style={styles.emptySub}>
          Contact AURA support to link your venue to this account.
        </Text>
        <Pressable style={styles.retryBtn} onPress={signOut}>
          <Text style={styles.retryBtnText}>Sign Out</Text>
        </Pressable>
      </View>
    );
  }

  const selectedVenue = venues[selectedIdx] ?? venues[0];
  const tabStyle = (t: AdminTabName) => (activeTab === t ? styles.visible : styles.hidden);

  return (
    <View style={styles.container}>
      <View style={styles.content}>

        <View style={[styles.tab, tabStyle('home')]}>
          <AdminHomeTab
            navigation={navigation}
            venue={selectedVenue}
            venues={venues}
            onSwitchVenue={setSelectedIdx}
            onGoToFeed={() => { setFeedSubTab('guest'); setActiveTab('feed'); }}
          />
        </View>

        <View style={[styles.tab, tabStyle('feed')]}>
          <AdminFeedTab venueId={selectedVenue.id} requestedSubTab={feedSubTab} />
        </View>

        <View style={[styles.tab, tabStyle('camera')]}>
          <AdminCameraTab venueId={selectedVenue.id} venueName={selectedVenue.name} />
        </View>

        <View style={[styles.tab, tabStyle('profile')]}>
          <AdminProfileTab venues={venues} />
        </View>

      </View>

      <AdminVenueTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#030712' },
  content:    { flex: 1 },
  tab:        { flex: 1 },
  visible:    { display: 'flex' },
  hidden:     { display: 'none' },
  center:     { flex: 1, backgroundColor: '#030712', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, padding: SPACING.xxl },
  emptyEmoji: { fontSize: 44, marginBottom: SPACING.xs },
  emptyTitle: { color: '#fff', fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  emptySub:   { color: '#6b7280', fontSize: FONT_SIZE.body, textAlign: 'center', lineHeight: 22 },
  retryBtn:   { marginTop: SPACING.md, backgroundColor: COLORS.purple600, borderRadius: 10, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm },
  retryBtnText:{ color: '#fff', fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold },
});
