export type VenueCategory = 'club' | 'bar' | 'lounge';

export type UserRole          = 'user' | 'venue_admin';
export type UserAccountStatus = 'active' | 'suspended' | 'banned';

// ── Firestore user document (/users/{uid}) ────────────────────────────────────

export interface UserDoc {
  uid: string;
  phoneNumber: string;
  displayName: string;
  profilePhoto: string;
  upiId: string;
  rewardsBalance: number;
  totalEarned: number;
  role: UserRole;
  // Fix 5: account gating — set server-side when abusive behaviour detected
  accountStatus: UserAccountStatus;
  profileCompleted: boolean;
  onboardingCompleted: boolean;
  fcmToken: string;
  preferences: UserPreferences;
  // Fix 6: consent fields — collected at end of onboarding
  ageConfirmed: boolean;
  termsAcceptedAt: Date | null;
  createdAt: Date;
  lastLoginAt: Date;
}

export interface UserPreferences {
  auraVibes: string[];      // e.g. ['high-energy', 'chill']
  nightTypes: string[];
  crowdPreference: string;
  travelDistance: string;
}

// ── Other Firestore types ─────────────────────────────────────────────────────

export interface Venue {
  id: string;
  name: string;
  address: string;
  coordinates: { latitude: number; longitude: number };
  geofenceRadius: number;
  category: VenueCategory;
  city: string;
  neighborhood: string;
  coverPhotoUrl: string;
  active: boolean;
}

export interface CheckIn {
  id: string;
  userId: string;
  venueId: string;
  timestamp: Date;
  verified: boolean;
  rewardAmount: number;
  mediaUrls: string[];
  vibeRating: number;
  crowdRating: number;
  caption: string;
}

export interface Reward {
  id: string;
  userId: string;
  checkinId: string;
  amount: number;
  status: 'pending' | 'paid' | 'failed';
  upiId: string;
  paidAt: Date | null;
  createdAt: Date;
}

export interface LiveCrowd {
  venueId: string;
  count: number;
  lastUpdated: number;
  activeUsers: Record<string, number>;
}

export interface LiveUpdate {
  id: string;
  venueId: string;
  userId: string;
  message: string;
  vibeScore: number;
  timestamp: number;
  expiresAt: number;
}

// ── Navigation ────────────────────────────────────────────────────────────────

export type TabName = 'live' | 'feed' | 'post' | 'explore' | 'profile';

// ── Venue Admin types ─────────────────────────────────────────────────────────

export interface VenueAdminDoc {
  uid: string;
  managedVenueIds: string[];
  email: string;
  displayName: string;
  createdAt: Date;
}

export interface VenueLive {
  venueId: string;
  liveScore: number;
  isLiveNow: boolean;
  isTrending: boolean;
  crowdLabel: string | null;
  activeSignalCount: number;
  lastUserUpdateAt: Date | null;
  lastVenueUpdateAt: Date | null;
  updatedAt: Date;
  // Phase 1 vibe consensus
  vibeLabel: 'hot' | 'okay' | 'slow' | 'unknown';
  vibeBreakdown: { hot: number; okay: number; slow: number };
  vibeConfidence: number;
  consensusSampleSize: number;
  lastConsensusAt: Date;
}

// ── Check-in session (/checkInSessions/{uid}_{venueId}_{nightKey}) ────────────

export type CheckInLevel = 0 | 1 | 2 | 3;
export type RewardStatus = 'locked' | 'unlocked' | 'claimed';

export interface CheckInSession {
  uid: string;
  venueId: string;
  nightKey: string;           // 'YYYY-MM-DD' IST — resets at 03:30
  level: CheckInLevel;        // 1=checked-in, 2=clip1 posted, 3=clip2 posted
  checkedInAt: Date | null;
  clips: Array<{ signalId: string; uploadedAt: Date }>;
  lastClipAt: Date | null;    // used for 30-min cooldown between clips
  rewardStatus: RewardStatus;
  rewardId: string | null;
}

export interface VenuePromotion {
  id: string;
  label: string;
  description: string | null;
  validUntil: Date | null;
  active: boolean;
}

export type RootStackParamList = {
  // Auth stack
  Entry:       undefined;
  VenueLogin:  undefined;

  // Onboarding stack
  ProfileSetup: undefined;
  Onboarding:   undefined;

  // Main user stack
  Main:        undefined;
  VenueDetail: { venueId: string; venueName: string; coverPhotoUrl?: string };
  ClaimReward: { venueId: string; venueName: string };
  RecordVideo: { venueId: string; venueName: string; fromCheckin?: boolean };

  // Venue admin stack
  AdminDashboard:  undefined;
  AdminEditVenue:  { venueId: string };
  AdminUpload:     { venueId: string; venueName: string };
  AdminEvents:     { venueId: string; venueName: string };
  AdminNotify:     { venueId: string; venueName: string };
  AdminRewards:    { venueId: string; venueName: string };
};
