import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableScreens } from 'react-native-screens';
import { useAuth } from '../auth/useAuth';
import { COLORS } from '../theme';
import type { RootStackParamList } from '../types';

import { SplashScreen }     from '../screens/SplashScreen';
import { AuthErrorScreen }  from '../screens/AuthErrorScreen';
import { EntryScreen }      from '../screens/EntryScreen';
import { VenueLoginScreen } from '../screens/VenueLoginScreen';

import { ProfileSetupScreen } from '../screens/ProfileSetupScreen';
import { OnboardingScreen }   from '../screens/OnboardingScreen';

import { MainScreen }        from '../screens/MainScreen';
import { VenueDetailScreen } from '../screens/VenueDetailScreen';
import { ClaimRewardScreen } from '../screens/ClaimRewardScreen';

import { AdminDashboardScreen } from '../screens/AdminDashboardScreen';
import { AdminEditVenueScreen } from '../screens/AdminEditVenueScreen';
import { AdminUploadScreen }    from '../screens/AdminUploadScreen';
import { AdminEventsScreen }    from '../screens/AdminEventsScreen';
import { AdminNotifyScreen }    from '../screens/AdminNotifyScreen';
import { AdminRewardsScreen }   from '../screens/AdminRewardsScreen';
import { RecordVideoScreen }    from '../screens/RecordVideoScreen';

enableScreens();

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions = {
  headerShown: false,
  animation: 'slide_from_right' as const,
  contentStyle: { backgroundColor: COLORS.bg },
};

export function RootNavigator() {
  const { authUser, userDoc, initializing, authError } = useAuth();

  if (initializing) return <SplashScreen />;

  // Signed in but the userDoc load failed — show retry UI instead of an
  // indefinite splash.
  if (authUser && !userDoc && authError) return <AuthErrorScreen />;

  // Signed in and load is still in progress (no error yet) — stay on splash.
  if (authUser && !userDoc) return <SplashScreen />;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={screenOptions}>

        {/* ── Unauthenticated ───────────────────────────────────────────────── */}
        {!authUser && (
          <>
            <Stack.Screen name="Entry"      component={EntryScreen} />
            <Stack.Screen name="VenueLogin" component={VenueLoginScreen} />
          </>
        )}

        {/* ── Authenticated — profile incomplete ───────────────────────────── */}
        {authUser && userDoc && !userDoc.profileCompleted && (
          <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        )}

        {/* ── Authenticated — onboarding incomplete ────────────────────────── */}
        {authUser && userDoc?.profileCompleted && !userDoc.onboardingCompleted && (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        )}

        {/* ── Venue admin flow ──────────────────────────────────────────────── */}
        {authUser && userDoc?.role === 'venue_admin' && (
          <>
            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
            <Stack.Screen name="AdminEditVenue" component={AdminEditVenueScreen} />
            <Stack.Screen name="AdminUpload"    component={AdminUploadScreen} />
            <Stack.Screen name="AdminEvents"    component={AdminEventsScreen} />
            <Stack.Screen name="AdminNotify"    component={AdminNotifyScreen} />
            <Stack.Screen name="AdminRewards"   component={AdminRewardsScreen} />
          </>
        )}

        {/* ── Fully active user flow ────────────────────────────────────────── */}
        {authUser && userDoc?.role !== 'venue_admin' && userDoc?.profileCompleted && userDoc.onboardingCompleted && (
          <>
            <Stack.Screen name="Main"        component={MainScreen} />
            <Stack.Screen name="VenueDetail" component={VenueDetailScreen} />
            <Stack.Screen name="ClaimReward" component={ClaimRewardScreen} />
            <Stack.Screen name="RecordVideo" component={RecordVideoScreen} />
          </>
        )}

      </Stack.Navigator>
    </NavigationContainer>
  );
}
