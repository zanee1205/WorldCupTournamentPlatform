import type { WorldCupMatch } from '../types/worldCupMatch';
import type { WorldCupVenue } from '../types/worldCupVenue';

export function buildVenueStats(matches: WorldCupMatch[]): WorldCupVenue[] {
    return Array.from(
        matches.reduce<Map<string, WorldCupVenue>>((acc, match) => {
            const venue = match.venue || 'Chưa xác định';
            const current = acc.get(venue) ?? { name: venue, matchCount: 0 };
            current.matchCount += 1;
            acc.set(venue, current);
            return acc;
        }, new Map()),
        ([, venue]) => venue,
    ).sort((left, right) => right.matchCount - left.matchCount);
}
