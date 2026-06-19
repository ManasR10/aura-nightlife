/**
 * adminCreateEvent — venue admin creates a manual event for their venue.
 * adminCancelEvent — venue admin cancels a manual event (sets status:'ended').
 *
 * Both functions verify admin ownership before writing to /events.
 * Direct client writes to /events are blocked in Firestore rules.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

const db = getFirestore();

// Shared helper

async function assertAdminManagesVenue(uid: string, venueId: string): Promise<string> {
  const adminSnap = await db.collection('venueAdmins').doc(uid).get();
  if (!adminSnap.exists) throw new HttpsError('permission-denied', 'Not a venue admin.');

  const managed: string[] = adminSnap.data()!.managedVenueIds ?? [];
  if (!managed.includes(venueId)) {
    throw new HttpsError('permission-denied', 'You do not manage this venue.');
  }

  // Return the venue's display name for denormalising into the event doc
  const venueSnap = await db.collection('venues').doc(venueId).get();
  return venueSnap.exists ? (venueSnap.data()!.name as string) ?? venueId : venueId;
}

// adminCreateEvent

interface CreateEventData {
  venueId:      string;
  title:        string;
  startAt:      string;         // ISO 8601 string from client
  priceText?:   string | null;
  performers?:  string[];
  description?: string | null;
}

export const adminCreateEvent = onCall(
  { region: 'asia-south1' },
  async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

    const { venueId, title, startAt, priceText, performers, description } =
      req.data as CreateEventData;

    if (!venueId || !title?.trim() || !startAt) {
      throw new HttpsError('invalid-argument', 'venueId, title, and startAt are required.');
    }

    const startDate = new Date(startAt);
    if (isNaN(startDate.getTime())) {
      throw new HttpsError('invalid-argument', 'startAt must be a valid ISO 8601 date string.');
    }
    if (startDate.getTime() < Date.now() - 60 * 60 * 1000) {
      // Allow up to 1 hour in the past (in case of clock skew or late submission)
      throw new HttpsError('invalid-argument', 'startAt cannot be more than 1 hour in the past.');
    }

    const rawVenueName = await assertAdminManagesVenue(req.auth.uid, venueId);

    const eventRef = db.collection('events').doc();
    await eventRef.set({
      eventId:         eventRef.id,
      venueId,
      source:          'manual',
      title:           title.trim(),
      description:     description?.trim() ?? null,
      startAt:         Timestamp.fromDate(startDate),
      endAt:           null,
      imageUrl:        null,
      url:             null,
      priceText:       priceText?.trim() || null,
      coverCharge:     null,
      performers:      performers?.map((p) => p.trim()).filter(Boolean) ?? [],
      tags:            [],
      rawVenueName,
      status:          'upcoming',
      confidenceScore: 1.0,
      createdAt:       FieldValue.serverTimestamp(),
      createdBy:       req.auth.uid,
    });

    return { success: true, eventId: eventRef.id };
  },
);

// adminCancelEvent

interface CancelEventData {
  venueId:  string;
  eventId:  string;
}

export const adminCancelEvent = onCall(
  { region: 'asia-south1' },
  async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

    const { venueId, eventId } = req.data as CancelEventData;
    if (!venueId || !eventId) {
      throw new HttpsError('invalid-argument', 'venueId and eventId are required.');
    }

    await assertAdminManagesVenue(req.auth.uid, venueId);

    const eventSnap = await db.collection('events').doc(eventId).get();
    if (!eventSnap.exists) throw new HttpsError('not-found', 'Event not found.');

    const event = eventSnap.data()!;
    if (event.source !== 'manual') {
      throw new HttpsError(
        'failed-precondition',
        'Only manually created events can be cancelled here. Contact AURA support for scraped events.',
      );
    }
    if (event.venueId !== venueId) {
      throw new HttpsError('permission-denied', 'Event does not belong to this venue.');
    }

    await db.collection('events').doc(eventId).update({
      status:      'ended',
      cancelledAt: FieldValue.serverTimestamp(),
      cancelledBy: req.auth.uid,
    });

    return { success: true };
  },
);
