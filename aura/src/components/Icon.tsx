/**
 * Icon wrappers around lucide-react-native.
 * Requires: npm install lucide-react-native react-native-svg
 *           cd ios && bundle exec pod install  (react-native-svg needs native linking)
 */
import React from 'react';
import {
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Search,
  Home,
  LayoutList,
  Camera,
  User,
  MapPin,
  Bookmark,
  Music,
  Users,
  Clock,
  Heart,
  MessageCircle,
  Share2,
  Star,
  Phone,
  Link,
  Globe,
  Settings,
  Gift,
  Award,
  LogOut,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Check,
  X,
  Ticket,
  Wallet,
  Film,
  Calendar,
  Flag,
  Percent,
  Tag,
  CreditCard,
  IndianRupee,
  CheckCircle2,
  PartyPopper,
  House,
  type LucideProps,
} from 'lucide-react-native';

// Re-export with stable names used throughout the codebase.
// Each wrapper just passes size + color through to the lucide component.

function wrap(LucideIcon: React.FC<LucideProps>) {
  return ({ size = 20, color = '#fff' }: { size?: number; color?: string }) => (
    <LucideIcon size={size} color={color} strokeWidth={1.8} />
  );
}

export const IconBack      = wrap(ArrowLeft);
export const IconChevRight = wrap(ChevronRight);
export const IconChevDown  = wrap(ChevronDown);
export const IconSearch    = wrap(Search);
export const IconHome      = wrap(Home);
export const IconFeed      = wrap(LayoutList);
export const IconCamera    = wrap(Camera);
export const IconProfile   = wrap(User);
export const IconMapPin    = wrap(MapPin);
export const IconBookmark  = wrap(Bookmark);
export const IconMusic     = wrap(Music);
export const IconUsers     = wrap(Users);
export const IconClock     = wrap(Clock);
export const IconComment   = wrap(MessageCircle);
export const IconShare     = wrap(Share2);
export const IconStar      = wrap(Star);
export const IconPhone     = wrap(Phone);
export const IconInstagram = wrap(Link);
export const IconGlobe     = wrap(Globe);
export const IconSettings  = wrap(Settings);
export const IconGift      = wrap(Gift);
export const IconAward     = wrap(Award);
export const IconLogout    = wrap(LogOut);
export const IconFilters   = wrap(SlidersHorizontal);
export const IconEye       = wrap(Eye);
export const IconEyeOff    = wrap(EyeOff);
export const IconCheck        = wrap(Check);
export const IconX            = wrap(X);
export const IconTicket       = wrap(Ticket);
export const IconWallet       = wrap(Wallet);
export const IconFilm         = wrap(Film);
export const IconCalendar     = wrap(Calendar);
export const IconFlag         = wrap(Flag);
export const IconPercent      = wrap(Percent);
export const IconTag          = wrap(Tag);
export const IconCreditCard   = wrap(CreditCard);
export const IconRupee        = wrap(IndianRupee);
export const IconCheckCircle  = wrap(CheckCircle2);
export const IconPartyPopper  = wrap(PartyPopper);
export const IconHouse        = wrap(House);

// Heart has a special filled variant
export function IconHeart({
  size = 20,
  color = '#fff',
  filled = false,
}: {
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  return <Heart size={size} color={color} fill={filled ? color : 'none'} strokeWidth={1.8} />;
}
