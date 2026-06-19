/**
 * Shared types for VenueDetailScreen and its tab components.
 *
 * VenueAdminFields = optional read-shape of admin-supplied fields living on
 * /venues/{id} alongside the Places data (cast from VenueResult).
 *
 * VenueMeta = the parent's computed/defaulted view of those fields. Tab
 * components consume this shape; the parent owns the merge logic.
 */

export interface VenueAdminFields {
  dressCode?:       string;
  ageLimit?:        string | number;
  coverCharge?:     string | number;
  instagramHandle?: string;
  openingNote?:     string;
  promotions?:      string[];
  bannerUrl?:       string;
}

export interface VenueMeta {
  dressCode:   string;
  ageLimit:    string;
  coverCharge: string;
  promotions:  string[];
  instagram:   string;
  openingNote: string | null;
  bannerUrl:   string | null;
}

export type VenueDetailTabId = 'overview' | 'events' | 'media' | 'info';
