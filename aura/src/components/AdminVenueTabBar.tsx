import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Rss, Camera, User } from 'lucide-react-native';
import { COLORS, SPACING, FONT_SIZE } from '../theme';

export type AdminTabName = 'home' | 'feed' | 'camera' | 'profile';

interface Props {
  activeTab: AdminTabName;
  onTabChange: (tab: AdminTabName) => void;
}

const TABS: Array<{
  name: AdminTabName;
  label: string;
  Icon: typeof Home;
  center?: boolean;
}> = [
  { name: 'home',    label: 'Home',    Icon: Home   },
  { name: 'feed',    label: 'Feed',    Icon: Rss    },
  { name: 'camera',  label: 'Camera',  Icon: Camera, center: true },
  { name: 'profile', label: 'Profile', Icon: User   },
];

export function AdminVenueTabBar({ activeTab, onTabChange }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.bar, { paddingBottom: insets.bottom + 4 }]}>
      {TABS.map(({ name, label, Icon, center }) => {
        const active = activeTab === name;
        return (
          <Pressable
            key={name}
            style={[s.tab, center && s.tabCenter]}
            onPress={() => onTabChange(name)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            {center ? (
              <>
                <View style={s.cameraCircle}>
                  <Icon size={24} color={COLORS.white} />
                </View>
                <Text style={s.labelCenter}>{label}</Text>
              </>
            ) : (
              <>
                <Icon size={20} color={active ? COLORS.purple400 : '#9ca3af'} />
                <Text style={[s.label, active && s.labelActive]}>{label}</Text>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    paddingTop: SPACING.sm,
  },
  tab:       { flex: 1, alignItems: 'center', gap: 3 },
  tabCenter: { marginTop: -16 },
  cameraCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.purple500,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.purple500, shadowOpacity: 0.4,
    shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  label:       { color: '#9ca3af', fontSize: FONT_SIZE.xs },
  labelActive: { color: COLORS.purple400 },
  labelCenter: { color: '#d1d5db', fontSize: FONT_SIZE.xs, marginTop: 2 },
});
