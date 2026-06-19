/**
 * MainScreen — tab container.
 * Tabs: Live | Feed | Post | Explore | Profile
 *
 * Vibe selection in Home → switches to Explore tab with vibe pre-filtered.
 * Clearing vibe in Explore → resets filter.
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabBar }   from '../components/BottomTabBar';
import { HomeScreen }     from './HomeScreen';
import { LiveFeedScreen } from './LiveFeedScreen';
import { CameraScreen }   from './CameraScreen';
import { ExploreScreen }  from './ExploreScreen';
import { ProfileScreen }  from './ProfileScreen';
import type { RootStackParamList, TabName } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Main'>;

export function MainScreen({ navigation }: Props) {
  const [activeTab,    setActiveTab]    = useState<TabName>('live');
  const [exploreVibe,  setExploreVibe]  = useState<string | null>(null);

  const handleVenueNavigate = useCallback(
    (venueId: string, venueName: string, coverPhotoUrl?: string) => {
      navigation.navigate('VenueDetail', { venueId, venueName, coverPhotoUrl });
    },
    [navigation],
  );

  // Called when user taps a vibe tile in Home
  const handleVibeSelect = useCallback((auraId: string) => {
    setExploreVibe(auraId);
    setActiveTab('explore');
  }, []);

  // Called when user clears vibe pill in Explore
  const handleClearVibe = useCallback(() => {
    setExploreVibe(null);
  }, []);

  const tabStyle = (name: TabName) =>
    activeTab === name ? styles.tabVisible : styles.tabHidden;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={[styles.tab, tabStyle('live')]}>
          <HomeScreen
            onVibeSelect={handleVibeSelect}
            onNavigate={handleVenueNavigate}
          />
        </View>
        <View style={[styles.tab, tabStyle('feed')]}>
          <LiveFeedScreen onNavigate={handleVenueNavigate} />
        </View>
        <View style={[styles.tab, tabStyle('post')]}>
          <CameraScreen onCheckIn={() => setActiveTab('explore')} />
        </View>
        <View style={[styles.tab, tabStyle('explore')]}>
          <ExploreScreen
            onNavigate={handleVenueNavigate}
            selectedVibe={exploreVibe}
            onClearVibe={handleClearVibe}
          />
        </View>
        <View style={[styles.tab, tabStyle('profile')]}>
          <ProfileScreen onNavigate={handleVenueNavigate} />
        </View>
      </View>

      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1 },
  content:    { flex: 1 },
  tab:        { flex: 1 },
  tabVisible: { display: 'flex' },
  tabHidden:  { display: 'none' },
});
