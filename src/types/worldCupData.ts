import type { WorldCupMatch } from './worldCupMatch.js';
import type { WorldCupStanding } from './worldCupStanding.js';
import type { WorldCupVenue } from './worldCupVenue.js';

export type WorldCupData = {
    matches: WorldCupMatch[];
    standings: WorldCupStanding[];
    venues: WorldCupVenue[];
    lastUpdated: string | null;
    sourceUrl: string;
}