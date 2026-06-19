import type { Timestamp } from 'firebase-admin/firestore';

// User

export interface UserDoc {
  uid: string;
  phoneNumber: string;
  displayName: string;
  profilePhoto: string;
  upiId: string;
  rewardsBalance: number;
  totalEarned: number;
  role: 'user' | 'venue_admin';
  profileCompleted: boolean;
  onboardingCompleted: boolean;
  fcmToken: string;
  preferences: UserPreferences;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
}

export interface UserPreferences {
  auraVibes: string[];
  nightTypes: string[];
  crowdPreference: string;
  travelDistance: string;
}

// Venue (/venues/{placeId})
// Google Place ID is the document ID — single source of truth for venues.

export interface VenueDoc {
  placeId: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  rating: number | null;
  userRatingCount: number | null;
  priceLevel: string | null;        // '₹' | '₹₹' | '₹₹₹' | '₹₹₹₹' | null
  types: string[];
  isOpen: boolean | null;
  currentOpeningHours: string[] | null; // weekday descriptions
  phone: string | null;
  website: string | null;
  attributes: {
    liveMusic: boolean;
    servesCocktails: boolean;
    goodForGroups: boolean;
    outdoorSeating: boolean;
  };
  photos: string[];                 // photo resource names (Places API)
  source: 'google_places';
  lastFetchedAt: Timestamp;
  lastEnrichedAt: Timestamp | null;
  // Discovery metadata (written by seedMumbaiVenueCatalogue)
  city?: string;                    // 'Mumbai'
  zone?: string;                    // 'Bandra West' | 'Lower Parel' | …
  nightlifeCategory?: 'club' | 'bar' | 'lounge' | 'rooftop' | 'cafe';
  vibeTags?: string[];              // auto-derived: 'high-energy' | 'chill' | 'date-night' | 'big-group' | 'budget'
  adminVibeTags?: string[];         // admin override — takes priority over vibeTags
  discoveryEnabled?: boolean;       // false = hidden (default true)
  discoveryPriority?: number;       // 0–100, higher = shown first in ranked lists
}

// Event (/events/{eventId})

export type EventSource = 'bookmyshow' | 'insider' | 'district' | 'timeout' | 'eventbrite' | 'ticketmaster' | 'manual';
export type EventStatus = 'upcoming' | 'ongoing' | 'ended';

export interface EventDoc {
  eventId: string;
  venueId: string | null;           // null = unmatched, pending manual review
  source: EventSource;
  sources: Array<{ source: EventSource; url: string }>;
  title: string;
  description: string | null;
  startAt: Timestamp;
  endAt: Timestamp | null;
  imageUrl: string | null;
  url: string | null;
  priceText: string | null;
  coverCharge: number | null;
  performers: string[];
  tags: string[];
  rawVenueName: string;
  rawAddress: string | null;
  status: EventStatus;
  confidenceScore: number;          // 0–1, how confident we are in venue match
  scrapedAt: Timestamp;
}

// Venue Admin (/venueAdmins/{uid})

export interface VenueAdminDoc {
  uid: string;
  managedVenueIds: string[];
  email: string;
  displayName: string;
  createdAt: Timestamp;
}

export interface VenuePromotion {
  id: string;
  label: string;
  description: string | null;
  validUntil: Timestamp | null;
  active: boolean;
}

// Venue Live State (/venueLive/{placeId})

export type VibeLabel = 'hot' | 'okay' | 'slow' | 'unknown';

export interface VenueLiveDoc {
  venueId: string;
  // Activity
  liveScore: number;            // weighted sum of all active signals (activity proxy)
  isLiveNow: boolean;
  isTrending: boolean;
  activeSignalCount: number;
  crowdLabel: string | null;    // 'packed' | 'moderate' | 'quiet' | null
  lastUserUpdateAt: Timestamp | null;
  lastVenueUpdateAt: Timestamp | null;
  updatedAt: Timestamp;
  // Vibe consensus (Phase 1)
  vibeLabel: VibeLabel;         // winning bucket: hot | okay | slow | unknown
  vibeBreakdown: {              // weighted score per bucket
    hot:  number;
    okay: number;
    slow: number;
  };
  vibeConfidence: number;       // winningScore / totalVibeScore (0–1)
  consensusSampleSize: number;  // number of signals that contributed
  lastConsensusAt: Timestamp;
}

// Live Signal (/liveSignals/{signalId})

export type SignalType = 'video' | 'checkin' | 'vibe' | 'crowd';
export type SignalSourceType = 'user' | 'admin';

export interface LiveSignalDoc {
  signalId: string;
  venueId: string;
  userId: string;
  sourceType: SignalSourceType;
  signalType: SignalType;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  geoVerified: boolean;
  vibeTag: string | null;
  weight: number;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

// Scrape Raw (/scrapeRaw/{docId})

export interface ScrapeRawDoc {
  source: EventSource;
  payload: unknown;
  scrapedAt: Timestamp;
  processed: boolean;
  error: string | null;
}

// Check-in (/checkins/{checkinId})

export interface CheckInDoc {
  userId: string;
  venueId: string;
  timestamp: Timestamp;
  verified: boolean;
  rewardAmount: number;
  mediaUrls: string[];
  vibeRating: number;
  crowdRating: number;
  caption: string;
}

// Venue Reward (/venueRewards/{rewardId})
// Created by venue admins or super admin. One active reward per venue at a time.
// Users earn this reward by completing a check-in session.

export type VenueRewardType = 'cash' | 'free_drink' | 'discount' | 'free_entry' | 'guestlist' | 'points';

export interface VenueRewardEligibility {
  requiresCheckIn:     boolean;
  requiredClips:       number;   // 1 or 2
  clipCooldownMinutes: number;   // 0 = no cooldown between clips
  geoRequired:         boolean;
  maxDistanceMeters:   number;
}

export interface VenueRewardLimits {
  perUserPerNight:   number;
  maxClaimsPerNight: number;
  dailyBudgetINR:    number | null;  // null = no cap
}

export interface VenueRewardWindow {
  startHHMM: string;   // '20:00'
  endHHMM:   string;   // '01:30' (may be next-day)
  timezone:  string;   // 'Asia/Kolkata'
}

export interface VenueRewardDoc {
  rewardId:     string;
  venueId:      string | null;        // null = platform-wide (super admin)
  title:        string;               // "Free Welcome Drink"
  description:  string;               // "Show code to bar staff"
  emoji:        string;               // 🍸
  rewardType:   VenueRewardType;
  cashAmount:   number | null;        // INR, only for 'cash' type
  value:        string;               // "₹50" | "1 Cocktail" | "20% off"
  eligibility:  VenueRewardEligibility;
  limits:       VenueRewardLimits;
  activeWindow: VenueRewardWindow | null;  // null = always active
  active:       boolean;
  version:      number;               // incremented on each replacement
  claimCount:   number;               // server-incremented, never client-written
  expiresAt:    Timestamp | null;
  createdBy:    string;
  createdAt:    Timestamp;
  updatedAt:    Timestamp;
}

// Reward Claim (/rewardClaims/{claimId})
// Immutable record created by claimSessionReward CF.
// Stores a full snapshot of the reward config at claim time so history
// never breaks when venues update their reward.

export type RewardClaimStatus = 'pending' | 'approved' | 'paid' | 'fulfilled' | 'rejected';

export interface RewardClaimDoc {
  claimId:             string;
  uid:                 string;
  venueId:             string;
  venueName:           string;
  nightKey:            string;
  sessionId:           string;
  venueRewardId:       string | null;
  rewardConfigVersion: number;
  rewardSnapshot:      VenueRewardDoc;   // full copy at claim time
  rewardType:          VenueRewardType;
  cashAmount:          number | null;
  currency:            string;           // 'INR'
  title:               string;
  emoji:               string;
  value:               string;
  redemptionCode:      string;
  status:              RewardClaimStatus;
  createdAt:           Timestamp;
  paidAt:              Timestamp | null;
  redeemedAt:          Timestamp | null;
  expiresAt:           Timestamp;
}

// Payout provider response (Razorpay / Cashfree)

export interface PayoutResponse {
  id: string;
  status: 'PROCESSED' | 'PENDING' | 'REJECTED' | 'CANCELLED';
  utr?: string;
}

// Analytics (/analyticsEvents/{eventId})

export type AnalyticEventType =
  | 'venue_impression'      // venue card shown in feed
  | 'venue_card_tap'        // venue card tapped (opens detail)
  | 'venue_detail_view'     // detail page mounted
  | 'map_open'              // map pin tapped
  | 'directions_tap'        // directions button tapped
  | 'call_tap'              // phone number tapped
  | 'website_tap'           // website link tapped
  | 'instagram_tap'         // instagram handle tapped
  | 'venue_save'            // saved / favourited
  | 'venue_unsave'          // un-saved
  | 'video_view'            // video started playing
  | 'video_complete'        // video watched to end
  | 'video_share'           // video shared
  | 'signal_submit'         // live signal submitted (vibe / checkin)
  | 'video_upload'          // video uploaded
  | 'event_view'            // event card seen
  | 'event_tap'             // event tapped (ticket / detail)
  | 'event_save'            // event saved
  | 'checkin'               // check-in recorded
  | 'reward_claim';         // reward claimed

export interface AnalyticEventDoc {
  eventId:    string;
  type:       AnalyticEventType;
  venueId:    string | null;
  userId:     string | null;
  sessionId:  string;
  occurredAt: Timestamp;
  date:       string;          // 'YYYY-MM-DD' IST — for daily partition queries
  metadata:   Record<string, unknown>;
}

// Venue Analytics Daily (/venueAnalyticsDaily/{venueId_date})

export interface VenueAnalyticsDailyDoc {
  venueId:          string;
  date:             string;            // 'YYYY-MM-DD' IST
  impressions:      number;
  detailViews:      number;
  cardTaps:         number;
  directionsTaps:   number;
  callTaps:         number;
  websiteTaps:      number;
  instagramTaps:    number;
  saves:            number;
  videoViews:       number;
  videoCompletes:   number;
  signalSubmits:    number;
  videoUploads:     number;
  checkins:         number;
  rewardClaims:     number;
  uniqueUsers:      number;
  computedAt:       Timestamp;
}

// Venue Analytics Weekly (/venueAnalyticsWeekly/{venueId_week})

export interface VenueAnalyticsWeeklyDoc extends Omit<VenueAnalyticsDailyDoc, 'date'> {
  weekStart:        string;            // 'YYYY-MM-DD' of Monday IST
  clicksToVenue:    number;            // directionsTaps + callTaps + websiteTaps + instagramTaps
  conversionRate:   number;            // checkins / detailViews (0–1)
  repeatVisitors:   number;
  newVisitors:      number;
  repeatRate:       number;            // repeatVisitors / uniqueUsers (0–1)
}

// Banner Ad (/banners/{bannerId})
// Shown in the HomeScreen hero carousel. Venue admins submit banners;
// ops team approves them by setting active: true.

export interface BannerDoc {
  bannerId:   string;
  title:      string;
  subtitle:   string;
  imageUrl:   string;       // Firebase Storage URL or direct HTTPS
  ctaLabel:   string;       // e.g. "Let's go", "Explore now"
  venueId:    string | null;// null = generic / brand ad
  active:     boolean;
  priority:   number;       // 0–100, higher = shown first
  startsAt:   Timestamp | null;
  expiresAt:  Timestamp | null;
  createdBy:  string;       // venue admin uid
}

// Shared raw scraped event (internal pipeline shape)

export interface RawScrapedEvent {
  source: EventSource;
  title: string;
  rawVenueName: string;
  rawAddress: string | null;
  city: string;
  locality: string | null;
  dateText: string;
  startTimeText: string | null;
  endTimeText: string | null;
  priceText: string | null;
  imageUrl: string | null;
  url: string;
  tags: string[];
  performers: string[];
  scrapedAt: Date;
}
