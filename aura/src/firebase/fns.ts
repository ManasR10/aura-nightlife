/**
 * Region-aware Firebase Functions instances.
 *
 * asia-south1  — adminUpdateVenue, adminSubmitSignal, adminCreateEvent,
 *                adminCancelEvent, seedPseudoAdmin, submitLiveSignal
 * us-central1  — searchNearbyVenues, searchVenuesByText, getPlaceDetails,
 *                validateContribution  (Firebase default region)
 *
 * Uses the modular getFunctions() which is correctly typed for region strings.
 */
import { getFunctions } from '@react-native-firebase/functions';

export const fnSouth   = getFunctions(undefined, 'asia-south1');
export const fnDefault = getFunctions();
