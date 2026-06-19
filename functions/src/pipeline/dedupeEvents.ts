/**
 * dedupeEvents — merges duplicate events from multiple sources.
 *
 * Same event if: same venueId + similar title + start within 90 minutes.
 * Keeps one canonical doc, merges sources[] array.
 */
import type { NormalizedEvent } from './normalizeEvent';

const TITLE_SIMILARITY_THRESHOLD = 0.70;
const TIME_PROXIMITY_MS = 90 * 60 * 1000; // 90 minutes

function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(a.split(' ').filter((t) => t.length > 2));
  const tb = new Set(b.split(' ').filter((t) => t.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  for (const t of ta) {
    if (tb.has(t)) overlap++;
  }
  return (2 * overlap) / (ta.size + tb.size);
}

export function dedupeEvents(events: NormalizedEvent[]): NormalizedEvent[] {
  const canonical: NormalizedEvent[] = [];

  for (const event of events) {
    let matched = false;

    for (const canon of canonical) {
      // Must have same venueId to be considered dupes
      // (unmatched events — venueId handled externally — use rawVenueName)
      const sameVenue = event.rawVenueName === canon.rawVenueName;
      if (!sameVenue) continue;

      const timeDiff = Math.abs(
        event.startAt.getTime() - canon.startAt.getTime(),
      );
      if (timeDiff > TIME_PROXIMITY_MS) continue;

      const titleSim = tokenSimilarity(
        event.normalizedTitle,
        canon.normalizedTitle,
      );
      if (titleSim < TITLE_SIMILARITY_THRESHOLD) continue;

      // It's a duplicate — merge sources
      for (const src of event.sources) {
        const alreadyHas = canon.sources.some(
          (s) => s.source === src.source && s.url === src.url,
        );
        if (!alreadyHas) canon.sources.push(src);
      }

      // Merge performers and tags
      const mergedPerformers = [...new Set([...canon.performers, ...event.performers])];
      const mergedTags = [...new Set([...canon.tags, ...event.tags])];
      canon.performers = mergedPerformers;
      canon.tags = mergedTags;

      // Prefer non-null fields from the incoming event
      if (!canon.imageUrl && event.imageUrl) canon.imageUrl = event.imageUrl;
      if (!canon.priceText && event.priceText) canon.priceText = event.priceText;
      if (!canon.coverCharge && event.coverCharge) canon.coverCharge = event.coverCharge;

      matched = true;
      break;
    }

    if (!matched) {
      canonical.push({ ...event });
    }
  }

  return canonical;
}
