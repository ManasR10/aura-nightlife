import { initializeApp } from 'firebase-admin/app';

// Initialise admin SDK once at cold-start
initializeApp();

// ── Core functions ────────────────────────────────────────────────────────────
export { validateContribution }   from './validateContribution';
export { startCheckIn }           from './startCheckIn';
export { claimSessionReward }     from './claimSessionReward';
export { expireOldUpdates }     from './expireOldUpdates';
export { cleanupCheckins }      from './cleanupCheckins';

// Phase 4 — enable when Realtime Database + Razorpay are configured:
// export { aggregateCrowdCount }    from './aggregateCrowdCount';
// export { processUpiPayout }       from './processUpiPayout';
// export { sendRewardNotification } from './sendRewardNotification';

// ── Places (callable) ─────────────────────────────────────────────────────────
export { searchNearbyVenues }  from './searchNearbyVenues';
export { getPlaceDetails }     from './getPlaceDetails';
export { searchVenuesByText }  from './places/searchVenuesByText';

// ── Scheduled jobs ────────────────────────────────────────────────────────────
export { scrapeTonightEvents }      from './jobs/scrapeTonightEvents';
export { refreshVenueDetails }      from './jobs/refreshVenueDetails';
export { aggregateVenueAnalytics }  from './jobs/aggregateVenueAnalytics';
export { updateEventStatus }        from './jobs/updateEventStatus';

// ── Data seeding (callable, admin only) ───────────────────────────────────────
export { seedMumbaiEvents }          from './jobs/seedMumbaiEvents';
export { seedPseudoAdmin }           from './jobs/seedPseudoAdmin';
export { seedMumbaiVenueCatalogue }  from './jobs/seedMumbaiVenueCatalogue';

// ── Live signals ──────────────────────────────────────────────────────────────
export { submitLiveSignal }         from './submitLiveSignal';
export { sendVenueNotification }    from './sendVenueNotification';
export { deleteSignal }             from './deleteSignal';

// ── Venue admin ───────────────────────────────────────────────────────────────
export { adminUpdateVenue, adminSubmitSignal }                              from './adminUpdateVenue';
export { adminCreateEvent, adminCancelEvent }                              from './adminCreateEvent';
export { adminCreateVenueReward, adminDeactivateVenueReward, adminMarkRewardRedeemed } from './adminCreateVenueReward';
export { adminGetRewardStats } from './adminGetRewardStats';
