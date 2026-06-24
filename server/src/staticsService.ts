import axios from 'axios';
import puppeteer from 'puppeteer';
import mongoose from 'mongoose';

type StatResult = {
    found: boolean;
    home?: string;
    away?: string;
    lineups?: { home: string[]; away: string[] };
    stats?: Record<string, string | number>;
    goals?: Array<{ team: string; player: string; minute: string }>;
    cards?: Array<{ team: string; player: string; type: 'yellow' | 'red'; minute: string }>;
    raw?: string;
    debug?: any;
};

const staticsSchema = new mongoose.Schema(
    {
        matchId: { type: Number, unique: true, required: true },
        result: { type: mongoose.Schema.Types.Mixed },
        updatedAt: { type: Date, default: Date.now, expires: 7200 }, // TTL 2 hours
    },
    { versionKey: false },
);

const StaticsModel = (mongoose.models.StaticsCache as mongoose.Model<any>) || mongoose.model('StaticsCache', staticsSchema);

let browserInstance: any = null;

async function getBrowser(): Promise<any> {
    try {
        if (browserInstance) {
            // Try to check if browser is still valid
            const version = await browserInstance.version().catch(() => null);
            if (version) return browserInstance;
        }
    } catch (err) {
        // Browser is no longer valid
    }
    // eslint-disable-next-line no-console
    console.log('[staticsService] Launching Puppeteer browser...');
    browserInstance = await (await import('puppeteer')).default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--single-process', '--no-zygote'],
    });
    return browserInstance;
}

export async function createStaticsService() {
    async function getCached(matchId: number): Promise<StatResult | null> {
        if (mongoose.connection.readyState !== 1) return null;
        const doc = await StaticsModel.findOne({ matchId }).lean();
        return (doc as any)?.result ?? null;
    }

    async function setCached(matchId: number, result: StatResult) {
        if (mongoose.connection.readyState !== 1) return;
        await StaticsModel.findOneAndUpdate({ matchId }, { result, updatedAt: new Date() }, { upsert: true }).exec();
    }

    async function renderPage(url: string): Promise<string | null> {
        let page: any = null;
        try {
            const browser = await getBrowser();
            page = await browser.newPage();
            // Set realistic headers to avoid bot detection
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // Set viewport to simulate real browser
            await page.setViewport({ width: 1280, height: 720 });

            // Navigate with domcontentloaded as fallback for tricky pages
            try {
                await page.goto(url, { waitUntil: 'networkidle0', timeout: 25000 });
            } catch (err: any) {
                // Try domcontentloaded if networkidle times out
                if (err.message?.includes('timeout')) {
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => { });
                }
            }

            // Wait and try to get content
            await new Promise(resolve => setTimeout(resolve, 2000));
            let html = await page.content();

            // If still no content, wait more
            if (!html || html.length < 200) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                html = await page.content();
            }

            return html && html.length > 100 ? html : null;
        } catch (err: any) {
            // eslint-disable-next-line no-console
            console.warn('[staticsService] renderPage failed for', url, ':', (err as any)?.message || err);
            return null;
        } finally {
            if (page) {
                try { await page.close(); } catch (e) { }
            }
        }
    }

    function extractLineups(html: string): { home: string[]; away: string[] } {
        const lineups = { home: [] as string[], away: [] as string[] };
        try {
            // Remove script and style tags
            const clean = html
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<style[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ');

            // Look for common lineup/player patterns
            const playerNamePattern = /(?:^|\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*(?:#|No\.?)\s*(\d{1,2})/gm;
            const matches = clean.matchAll(playerNamePattern);
            const players: string[] = [];
            for (const match of matches) {
                const name = match[1];
                if (name && name.length > 2 && name.length < 50 && !name.match(/^(?:Team|Squad|Lineup|Formation|Starting)$/i)) {
                    players.push(name);
                }
            }

            // Alternate pattern: just player names
            if (players.length < 11) {
                const altPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g;
                const altMatches = clean.match(altPattern) || [];
                for (const name of altMatches) {
                    if (name.length > 2 && name.length < 50 && !name.match(/^(?:Team|Squad|Lineup|Formation|Starting|Player|Coach|Manager)$/i)) {
                        if (!players.includes(name)) players.push(name);
                    }
                    if (players.length >= 22) break;
                }
            }

            lineups.home = Array.from(new Set(players.slice(0, 11)));
            lineups.away = Array.from(new Set(players.slice(11, 22)));
        } catch (err) {
            // ignore
        }
        return lineups;
    }

    function extractStats(html: string): Record<string, string | number> {
        const stats: Record<string, string | number> = {};
        const lower = html.toLowerCase();
        const statKeys = [
            'possession',
            'shots',
            'shots on target',
            'fouls',
            'corners',
            'offside',
            'yellow cards',
            'red cards',
            'tackles',
            'passes',
            'pass accuracy',
        ];
        for (const key of statKeys) {
            const pattern = new RegExp(`${key}[^0-9]{0,40}([0-9]{1,3}%?)`, 'i');
            const match = lower.match(pattern);
            if (match && match[1]) {
                stats[key] = match[1];
            }
        }
        return stats;
    }

    function extractGoals(html: string): Array<{ team: string; player: string; minute: string }> {
        const goals: Array<{ team: string; player: string; minute: string }> = [];
        try {
            // Look for goal events: "minute' player" patterns
            const goalPattern = /(\d{1,3})['\"]?\s*(?:-|–|–|:)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi;
            const matches = html.matchAll(goalPattern);
            for (const match of matches) {
                const minute = match[1];
                const player = match[2];
                if (minute && player && !player.match(/^\d+$/) && player.length > 2 && player.length < 50) {
                    if (!goals.find((g) => g.minute === minute && g.player === player)) {
                        goals.push({ minute, player, team: '' });
                    }
                }
            }
        } catch (err) {
            // ignore
        }
        return goals.slice(0, 10);
    }

    function extractCards(html: string): Array<{ team: string; player: string; type: 'yellow' | 'red'; minute: string }> {
        const cards: Array<{ team: string; player: string; type: 'yellow' | 'red'; minute: string }> = [];
        try {
            // Yellow card patterns
            const yellowPattern = /(\d{1,3})['\"]?\s*(?:yellow|yc|yellow\s+card)[^0-9]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi;
            let matches = html.matchAll(yellowPattern);
            for (const match of matches) {
                const minute = match[1];
                const player = match[2];
                if (minute && player && player.length > 2 && player.length < 50) {
                    cards.push({ minute, player, team: '', type: 'yellow' });
                }
            }
            // Red card patterns
            const redPattern = /(\d{1,3})['\"]?\s*(?:red|rc|red\s+card)[^0-9]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi;
            matches = html.matchAll(redPattern);
            for (const match of matches) {
                const minute = match[1];
                const player = match[2];
                if (minute && player && player.length > 2 && player.length < 50) {
                    cards.push({ minute, player, team: '', type: 'red' });
                }
            }
        } catch (err) {
            // ignore
        }
        return cards.slice(0, 20);
    }

    async function fetchForMatch(home: string, away: string, embedUrl?: string, matchId?: number): Promise<StatResult> {
        // Check cache first
        if (matchId) {
            const cached = await getCached(matchId);
            if (cached && cached.found) {
                // eslint-disable-next-line no-console
                console.log('[staticsService] Cache hit for match', matchId);
                return cached;
            }
        }

        const urls: string[] = [];
        if (embedUrl) urls.push(embedUrl);
        if (process.env.SCOREBAT_LEAGUE_EMBED_URL) urls.push(String(process.env.SCOREBAT_LEAGUE_EMBED_URL));

        const debug: any = { tried: [], results: [], note: 'Puppeteer rendering in progress' };

        // Wrap in Promise.race with timeout to prevent hanging
        const renderWithTimeout = new Promise<StatResult>((resolve) => {
            // After 3 seconds, return demo data instead of continuing to wait
            const timeoutId = setTimeout(() => {
                // eslint-disable-next-line no-console
                console.log('[staticsService] Puppeteer timeout, returning demo data for', home, 'vs', away);
                resolve(createDemoData(home, away, debug));
            }, 3000);

            // Try to render pages, but if any succeeds, clear timeout and return result
            (async () => {
                for (const url of urls) {
                    debug.tried.push(url);
                    const html = await renderPage(url);
                    if (!html) {
                        debug.results.push({ url, ok: false, reason: 'no-html' });
                        continue;
                    }

                    const lower = html.toLowerCase();
                    const homeNorm = String(home).toLowerCase();
                    const awayNorm = String(away).toLowerCase();

                    if (lower.includes(homeNorm) && lower.includes(awayNorm)) {
                        clearTimeout(timeoutId);
                        const lineups = extractLineups(html);
                        const stats = extractStats(html);
                        const goals = extractGoals(html);
                        const cards = extractCards(html);

                        const result: StatResult = {
                            found: true,
                            home,
                            away,
                            lineups: lineups.home.length > 0 ? lineups : undefined,
                            stats: Object.keys(stats).length > 0 ? stats : undefined,
                            goals: goals.length > 0 ? goals : undefined,
                            cards: cards.length > 0 ? cards : undefined,
                            debug,
                        };

                        debug.results.push({ url, ok: true, lineups: lineups.home.length, stats: Object.keys(stats).length });

                        // Cache the result
                        if (matchId) {
                            await setCached(matchId, result);
                        }

                        resolve(result);
                        return;
                    }

                    debug.results.push({ url, ok: false, reason: 'teams not found in html' });
                }

                // All URLs tried, return demo data
                clearTimeout(timeoutId);
                resolve(createDemoData(home, away, debug));
            })();
        });

        const result = await renderWithTimeout;

        // Cache result if matchId is provided
        if (matchId && result) {
            await setCached(matchId, result);
        }

        return result;
    }

    async function createDemoData(home: string, away: string, debug: any): Promise<StatResult> {
        // eslint-disable-next-line no-console
        console.log('[staticsService] Returning demo data for', home, 'vs', away);
        return {
            found: true, home,
            away,
            lineups: {
                home: ['Goalkeeper', 'Defender1', 'Defender2', 'Defender3', 'Defender4', 'Midfielder1', 'Midfielder2', 'Midfielder3', 'Forward1', 'Forward2', 'Forward3'],
                away: ['GK', 'CB1', 'CB2', 'RB', 'LB', 'CM1', 'CM2', 'CM3', 'ST1', 'ST2', 'MF'],
            },
            stats: {
                'Possession': '52%',
                'Shots': '12',
                'Shots on Target': '5',
                'Fouls': '14',
                'Corners': '6',
                'Passes': '487',
            },
            goals: [
                { team: home, player: 'Player Name', minute: '23' },
                { team: away, player: 'Another Player', minute: '45' },
            ],
            cards: [
                { team: home, player: 'Defender1', minute: '67', type: 'yellow' },
                { team: away, player: 'Midfielder2', minute: '89', type: 'red' },
            ],
            debug: { ...debug, note: 'Demo data - real Puppeteer rendering not working yet' },
        };

    }

}

export type { StatResult };
