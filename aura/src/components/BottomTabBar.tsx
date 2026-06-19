import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Flame, Radio, Camera, Compass, User } from 'lucide-react-native';
import { COLORS, SPACING, RADIUS } from '../theme';
import type { TabName } from '../types';

interface Props {
  activeTab:   TabName;
  onTabChange: (tab: TabName) => void;
}

const SZ = 22;

export function BottomTabBar({ activeTab, onTabChange }: Props) {
  const insets = useSafeAreaInsets();
  const c = (tab: TabName) => (activeTab === tab ? COLORS.purple400 : '#9ca3af');

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom || SPACING.sm }]}>
      <View style={styles.inner}>

        <Pressable style={styles.tab} onPress={() => onTabChange('live')}
          accessibilityRole="button" accessibilityLabel="Home"
          accessibilityState={{ selected: activeTab === 'live' }}>
          <Flame size={SZ} color={c('live')} />
          <Text style={[styles.label, activeTab === 'live' && styles.labelActive]}>Home</Text>
        </Pressable>

        <Pressable style={styles.tab} onPress={() => onTabChange('feed')}
          accessibilityRole="button" accessibilityLabel="Feed"
          accessibilityState={{ selected: activeTab === 'feed' }}>
          <Radio size={SZ} color={c('feed')} />
          <Text style={[styles.label, activeTab === 'feed' && styles.labelActive]}>Feed</Text>
        </Pressable>

        {/* Post — raised centre CTA */}
        <Pressable style={styles.postWrapper} onPress={() => onTabChange('post')}
          accessibilityRole="button" accessibilityLabel="Post">
          <View style={styles.postCircle}>
            <Camera size={26} color={COLORS.white} />
          </View>
          <Text style={styles.postLabel}>Post</Text>
        </Pressable>

        <Pressable style={styles.tab} onPress={() => onTabChange('explore')}
          accessibilityRole="button" accessibilityLabel="Explore"
          accessibilityState={{ selected: activeTab === 'explore' }}>
          <Compass size={SZ} color={c('explore')} />
          <Text style={[styles.label, activeTab === 'explore' && styles.labelActive]}>Explore</Text>
        </Pressable>

        <Pressable style={styles.tab} onPress={() => onTabChange('profile')}
          accessibilityRole="button" accessibilityLabel="Profile"
          accessibilityState={{ selected: activeTab === 'profile' }}>
          <User size={SZ} color={c('profile')} />
          <Text style={[styles.label, activeTab === 'profile' && styles.labelActive]}>Profile</Text>
        </Pressable>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.black,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  inner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingBottom: SPACING.xs, gap: 3,
  },
  label:       { fontSize: 10, color: '#9ca3af' },
  labelActive: { color: COLORS.purple400 },

  postWrapper: { flex: 1, alignItems: 'center', marginTop: -16, gap: 3 },
  postCircle: {
    width: 50, height: 50, borderRadius: RADIUS.full,
    backgroundColor: COLORS.purple500,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.purple500,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 10,
  },
  postLabel: { fontSize: 10, color: '#9ca3af' },
});
