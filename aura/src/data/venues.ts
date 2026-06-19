// ── Venue data ported from Lovable ────────────────────────────────────────────

export interface EventHighlight {
  id: string;
  venueId: string;
  title: string;
  subtitle: string;
  venue: string;
  image: string;
  cta: string;
}

export interface VenueSummary {
  id: string;
  name: string;
  musicPlaying: string;
  crowdLevel: string;
  waitTime: string;
  distance: string;
  distanceKm: number;
  vibe: string;
  budget: 'low' | 'mid' | 'high';
}

export interface VenueInfo {
  id: string;
  name: string;
  type: string;
  coverImage: string;
  address: string;
  phone: string;
  instagram: string;
  isOpen: boolean;
  openHours: string;
  rating: number;
  currentVibe: string;
  currentMusic: string;
  crowdLevel: string;
  waitTime: string;
  dressCode: string;
  ageLimit: string;
  coverCharge: string;
  promotions: string[];
}

export interface VenueVideo {
  id: string;
  venueId: string;
  thumbnailUrl: string;
  postedBy: 'venue' | 'user';
  userName?: string;
  timestamp: Date;
  caption?: string;
}

export type AuraOption = {
  id: string;
  emoji: string;
  label: string;
  desc: string;
};

// ── Hero carousel events ───────────────────────────────────────────────────

export const EVENT_HIGHLIGHTS: EventHighlight[] = [
  {
    id: '1', venueId: '1',
    title: 'EDM Night Takeover',
    subtitle: '✦ Feel the bass drop ✦',
    venue: 'Corner Room',
    image: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&w=800&q=80',
    cta: "Let's go",
  },
  {
    id: '2', venueId: '2',
    title: 'Acoustic Chill Sessions',
    subtitle: '✦ Sip & unwind ✦',
    venue: 'Kissa Cafe',
    image: 'https://images.unsplash.com/photo-1571204829887-3b8d69e4094d?auto=format&fit=crop&w=800&q=80',
    cta: 'Explore now',
  },
  {
    id: '3', venueId: '3',
    title: 'Rooftop Sunset Sessions',
    subtitle: '✦ Sky-high cocktails ✦',
    venue: '190 AMSL',
    image: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=800&q=80',
    cta: 'Book VIP',
  },
  {
    id: '4', venueId: '4',
    title: 'Live Jazz & Cocktails',
    subtitle: '✦ Smooth sounds tonight ✦',
    venue: 'Factory Bar',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
    cta: 'Discover',
  },
  {
    id: '5', venueId: '5',
    title: 'Bollywood Night Bash',
    subtitle: '✦ Dance like nobody\'s watching ✦',
    venue: "What's Your Plan",
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
    cta: 'Join now',
  },
];

// ── Aura mood options ──────────────────────────────────────────────────────

export const AURA_OPTIONS: AuraOption[] = [
  { id: 'high-energy', emoji: '🔥', label: 'High Energy', desc: 'Dance & loud music' },
  { id: 'chill',       emoji: '🍸', label: 'Chill',        desc: 'Relaxed vibes' },
  { id: 'date-night',  emoji: '✨', label: 'Date Night',   desc: 'Intimate & aesthetic' },
  { id: 'big-group',   emoji: '🎉', label: 'Big Group',    desc: 'Squad celebrations' },
  { id: 'spontaneous', emoji: '👀', label: 'Surprise Me',  desc: 'Open to anything' },
  { id: 'budget',      emoji: '💸', label: 'Budget Fun',   desc: 'Good deals & vibes' },
];

// ── Venue summaries for feed ───────────────────────────────────────────────

export const VENUE_SUMMARIES: Record<string, VenueSummary> = {
  '1':  { id: '1',  name: 'Corner Room',       musicPlaying: 'EDM / House',          crowdLevel: 'Busy',     waitTime: '5-10 mins', distance: '0.8 mi', distanceKm: 1.3, vibe: 'party',  budget: 'mid'  },
  '2':  { id: '2',  name: 'Kissa Cafe',         musicPlaying: 'Acoustic / Indie',     crowdLevel: 'Cozy',     waitTime: 'None',      distance: '0.5 mi', distanceKm: 0.8, vibe: 'chill',  budget: 'low'  },
  '3':  { id: '3',  name: '190 AMSL',           musicPlaying: 'Lounge / Chill',       crowdLevel: 'Moderate', waitTime: 'None',      distance: '2.1 mi', distanceKm: 3.4, vibe: 'chill',  budget: 'high' },
  '4':  { id: '4',  name: 'Factory Bar',        musicPlaying: 'Jazz / Live',          crowdLevel: 'Moderate', waitTime: '5 mins',    distance: '1.0 mi', distanceKm: 1.6, vibe: 'social', budget: 'mid'  },
  '5':  { id: '5',  name: "What's Your Plan",   musicPlaying: 'Bollywood / Commercial', crowdLevel: 'Packed', waitTime: '15+ mins',  distance: '1.5 mi', distanceKm: 2.4, vibe: 'party',  budget: 'low'  },
  '6':  { id: '6',  name: 'Julliete',           musicPlaying: 'Romantic / Acoustic',  crowdLevel: 'Intimate', waitTime: 'None',      distance: '0.9 mi', distanceKm: 1.4, vibe: 'chill',  budget: 'high' },
  '7':  { id: '7',  name: 'Glocal',             musicPlaying: 'World / Fusion',       crowdLevel: 'Busy',     waitTime: '5-10 mins', distance: '1.8 mi', distanceKm: 2.9, vibe: 'social', budget: 'mid'  },
  '8':  { id: '8',  name: 'Mitron',             musicPlaying: 'Bollywood / Retro',    crowdLevel: 'Packed',   waitTime: '10 mins',   distance: '0.6 mi', distanceKm: 1.0, vibe: 'loud',   budget: 'low'  },
  '9':  { id: '9',  name: 'Lil Gambys',         musicPlaying: 'Hip Hop / Trap',       crowdLevel: 'Busy',     waitTime: '5 mins',    distance: '1.3 mi', distanceKm: 2.1, vibe: 'party',  budget: 'mid'  },
  '10': { id: '10', name: 'TAP',                musicPlaying: 'Commercial / Pop',     crowdLevel: 'Moderate', waitTime: 'None',      distance: '0.4 mi', distanceKm: 0.6, vibe: 'social', budget: 'low'  },
  '11': { id: '11', name: 'Bora Bora',          musicPlaying: 'Tropical / Deep House', crowdLevel: 'Vibrant', waitTime: '10 mins',   distance: '2.5 mi', distanceKm: 4.0, vibe: 'party',  budget: 'high' },
};

// ── Venue detail pages ─────────────────────────────────────────────────────

export const VENUE_DETAILS: Record<string, VenueInfo> = {
  '1': {
    id: '1', name: 'Corner Room', type: 'Nightclub / Lounge',
    coverImage: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&w=800',
    address: '123 Party Blvd, Lower Parel', phone: '+91 98765 43210',
    instagram: '@cornerroom_mumbai',
    isOpen: true, openHours: '10 PM – 4 AM', rating: 4.8,
    currentVibe: 'Energetic', currentMusic: 'EDM / House', crowdLevel: 'Busy',
    waitTime: '5-10 mins', dressCode: 'Smart Casual', ageLimit: '21+',
    coverCharge: '₹1,000 after 11 PM',
    promotions: ['Free entry before 11 PM', '2-for-1 cocktails until midnight'],
  },
  '2': {
    id: '2', name: 'Kissa Cafe', type: 'Cafe Bar',
    coverImage: 'https://images.unsplash.com/photo-1571204829887-3b8d69e4094d?auto=format&fit=crop&w=800',
    address: '456 Linking Rd, Bandra', phone: '+91 98765 12345',
    instagram: '@kissacafe',
    isOpen: true, openHours: '8 PM – 1 AM', rating: 4.5,
    currentVibe: 'Chill', currentMusic: 'Acoustic / Indie', crowdLevel: 'Cozy',
    waitTime: 'None', dressCode: 'Casual', ageLimit: '18+',
    coverCharge: 'No cover charge',
    promotions: ['Ladies Night – free drinks until 11 PM'],
  },
  '3': {
    id: '3', name: '190 AMSL', type: 'Rooftop Lounge',
    coverImage: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=800',
    address: '190 Hill Rd, Bandra', phone: '+91 98765 67890',
    instagram: '@190amsl',
    isOpen: true, openHours: '6 PM – 1 AM', rating: 4.7,
    currentVibe: 'Elegant', currentMusic: 'Lounge / Chill', crowdLevel: 'Moderate',
    waitTime: 'None', dressCode: 'Smart Casual', ageLimit: '21+',
    coverCharge: '₹500 redeemable',
    promotions: ['Sunset cocktails 6–8 PM'],
  },
};

// ── Live feed posts ────────────────────────────────────────────────────────

const now = new Date();
const min = (m: number) => new Date(now.getTime() - m * 60_000);

export const VENUE_VIDEOS: VenueVideo[] = [
  { id: 'v1-1', venueId: '1', thumbnailUrl: 'https://images.unsplash.com/photo-1583244532610-9deb77feb5ae?auto=format&fit=crop&w=400', postedBy: 'venue', timestamp: min(3),  caption: 'DJ Blake warming up! 🎶' },
  { id: 'v1-2', venueId: '1', thumbnailUrl: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&w=400', postedBy: 'user', userName: 'Alex', timestamp: min(12), caption: 'Vibes are insane 🔥' },
  { id: 'v1-3', venueId: '1', thumbnailUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=400', postedBy: 'user', userName: 'Priya', timestamp: min(28), caption: 'Dance floor packed!' },
  { id: 'v2-1', venueId: '2', thumbnailUrl: 'https://images.unsplash.com/photo-1571204829887-3b8d69e4094d?auto=format&fit=crop&w=400', postedBy: 'venue', timestamp: min(8),  caption: 'Hip Hop Thursday is live!' },
  { id: 'v2-2', venueId: '2', thumbnailUrl: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=400', postedBy: 'user', userName: 'Jay', timestamp: min(20), caption: 'MC Jay killing it 🎤' },
  { id: 'v3-1', venueId: '3', thumbnailUrl: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=400', postedBy: 'venue', timestamp: min(5),  caption: 'Sunset views tonight 🌅' },
  { id: 'v3-2', venueId: '3', thumbnailUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=400', postedBy: 'user', userName: 'Miguel', timestamp: min(15), caption: 'Rooftop is packed!' },
  { id: 'v4-1', venueId: '4', thumbnailUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400', postedBy: 'venue', timestamp: min(10), caption: 'Live jazz starting now 🎷' },
  { id: 'v4-2', venueId: '4', thumbnailUrl: 'https://images.unsplash.com/photo-1574391553681-13631d5db8d8?auto=format&fit=crop&w=400', postedBy: 'user', userName: 'Elena', timestamp: min(25), caption: 'Intimate vibes tonight' },
  { id: 'v5-1', venueId: '5', thumbnailUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400', postedBy: 'venue', timestamp: min(5),  caption: 'Bollywood night is LIVE 🎶' },
  { id: 'v5-2', venueId: '5', thumbnailUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=400', postedBy: 'user', userName: 'Rohan', timestamp: min(18), caption: 'Karaoke is on fire! 🎤' },
  { id: 'v6-1', venueId: '6', thumbnailUrl: 'https://images.unsplash.com/photo-1517263904808-5dc91e3e7044?auto=format&fit=crop&w=400', postedBy: 'venue', timestamp: min(12), caption: 'Candlelit ambiance tonight 🕯️' },
  { id: 'v7-1', venueId: '7', thumbnailUrl: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?auto=format&fit=crop&w=400', postedBy: 'venue', timestamp: min(8),  caption: 'World fusion night 🌍' },
  { id: 'v8-1', venueId: '8', thumbnailUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=400', postedBy: 'venue', timestamp: min(2),  caption: 'Retro Bollywood tonight! 🪩' },
  { id: 'v9-1', venueId: '9', thumbnailUrl: 'https://images.unsplash.com/photo-1574391553681-13631d5db8d8?auto=format&fit=crop&w=400', postedBy: 'venue', timestamp: min(15), caption: 'Hip hop night 🎧' },
  { id: 'v10-1', venueId: '10', thumbnailUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=400', postedBy: 'venue', timestamp: min(10), caption: 'Happy hour vibes 🍻' },
  { id: 'v11-1', venueId: '11', thumbnailUrl: 'https://images.unsplash.com/photo-1583244532610-9deb77feb5ae?auto=format&fit=crop&w=400', postedBy: 'venue', timestamp: min(7),  caption: 'Pool party vibes 🌊' },
];


// Feed sorted newest-first
export const FEED = [...VENUE_VIDEOS].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
