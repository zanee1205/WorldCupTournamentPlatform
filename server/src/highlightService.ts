import mongoose from 'mongoose';
import axios from 'axios';

type VideoItem = {
    embed?: string;
    url?: string;
    title?: string;
    thumbnail?: string;
    competition?: string;
    date?: string;
    side1?: string;
    side2?: string;
    description?: string;
    embedId?: string;
    embedUrl?: string;
};

const highlightSchema = new mongoose.Schema(
    {
        matchId: { type: Number, unique: true, required: true },
        videos: { type: mongoose.Schema.Types.Mixed },
        updatedAt: { type: Date, default: Date.now, expires: 3600 }, // default TTL 1 hour
    },
    { versionKey: false },
);

const HighlightModel = (mongoose.models.HighlightCache as mongoose.Model<any>) || mongoose.model('HighlightCache', highlightSchema);

export function createHighlightService() {
    async function getCached(matchId: number): Promise<VideoItem[] | null> {
        if (mongoose.connection.readyState !== 1) return null;
        const doc = await HighlightModel.findOne({ matchId }).lean();
        return (doc as any)?.videos ?? null;
    }

    async function setCached(matchId: number, videos: VideoItem[]) {
        if (mongoose.connection.readyState !== 1) return;
        await HighlightModel.findOneAndUpdate({ matchId }, { videos, updatedAt: new Date() }, { upsert: true }).exec();
    }

    async function fetchFromScorebat(): Promise<VideoItem[]> {
        try {
            const scorebatUrl = process.env.SCOREBAT_URL ?? 'https://www.scorebat.com/video-api/';
            const sbRes = await axios.get(scorebatUrl, { headers: { Accept: 'application/json' }, timeout: 9000, validateStatus: null });
            // debug
            // eslint-disable-next-line no-console
            console.log('[highlightService] fetchFromScorebat status=', sbRes?.status);
            if (sbRes.status !== 200 || !sbRes.data) return [];

            const sbItems = Array.isArray(sbRes.data) ? sbRes.data : Array.isArray(sbRes.data?.data) ? sbRes.data.data : [];
            // eslint-disable-next-line no-console
            console.log(`[highlightService] fetchFromScorebat found ${Array.isArray(sbItems) ? sbItems.length : 0} items`);
            const out: VideoItem[] = [];
            for (const it of sbItems) {
                const side1 = (it.side1 && (it.side1.title || it.side1.name)) || (it.side1 && it.side1.name) || '';
                const side2 = (it.side2 && (it.side2.title || it.side2.name)) || (it.side2 && it.side2.name) || '';

                if (Array.isArray(it.videos) && it.videos.length > 0) {
                    for (const v of it.videos) {
                        const embedRaw = v.embed || v.html || v.video_embed || it.embed || '';
                        const embedId = extractEmbedId(embedRaw);
                        out.push({
                            embed: embedRaw,
                            embedId,
                            embedUrl: embedId ? `https://www.scorebat.com/embed/v/${embedId}/` : undefined,
                            url: v.url || v.link || it.url || '',
                            title: v.title || it.title || '',
                            thumbnail: v.thumbnail || it.thumbnail || it.image || '',
                            date: v.date || it.date || '',
                            competition: it.competition || it.competition_name || '',
                            side1,
                            side2,
                            description: v.description || it.description || '',
                        });
                    }
                } else if (it.embed || it.url) {
                    const embedRaw = it.embed || it.html || '';
                    const embedId = extractEmbedId(embedRaw || it.url || '');
                    out.push({
                        embed: embedRaw || it.url || '',
                        embedId,
                        embedUrl: embedId ? `https://www.scorebat.com/embed/v/${embedId}/` : undefined,
                        url: it.url || it.link || '',
                        title: it.title || '',
                        thumbnail: it.thumbnail || it.image || '',
                        date: it.date || '',
                        competition: it.competition || it.competition_name || '',
                        side1,
                        side2,
                        description: it.description || '',
                    });
                }
            }

            return out;
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('[highlightService] scorebat fetch failed', (err as any)?.message || err);
            return [];
        }
    }

    async function fetchFromRapidAPI(): Promise<VideoItem[]> {
        try {
            const rapidHost = process.env.RAPIDAPI_HOST ?? 'free-football-soccer-videos.p.rapidapi.com';
            const rapidKey = process.env.RAPIDAPI_KEY;
            if (!rapidKey) return [];

            const url = `https://${rapidHost}/`;
            const baseHeaders = {
                'x-rapidapi-host': rapidHost,
                'x-rapidapi-key': rapidKey,
                Accept: 'application/json',
                'Cache-Control': 'no-cache',
                Pragma: 'no-cache',
            } as Record<string, string>;

            let fetchRes = await axios.get(url, { headers: baseHeaders, timeout: 8000, validateStatus: null });
            // eslint-disable-next-line no-console
            console.log('[highlightService] fetchFromRapidAPI status=', fetchRes?.status);
            if (fetchRes.status === 304 || !fetchRes.data) {
                const url2 = `${url}?_=${Date.now()}`;
                const retryHeaders = { ...baseHeaders, 'If-Modified-Since': '0' } as Record<string, string>;
                fetchRes = await axios.get(url2, { headers: retryHeaders, timeout: 12000, validateStatus: null });
            }

            const data = fetchRes.data;
            // eslint-disable-next-line no-console
            console.log(`[highlightService] fetchFromRapidAPI returned type=${typeof data}`);
            const items = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
            return (items as any[])
                .map((it) => ({
                    embed: it.embed || it.videoUrl || it.url || it.video_url || '',
                    embedId: extractEmbedId(it.embed || it.videoUrl || it.url || it.video_url || ''),
                    embedUrl: (function (raw: string | undefined) {
                        const id = extractEmbedId(raw || it.url || it.video_url || '');
                        return id ? `https://www.scorebat.com/embed/v/${id}/` : undefined;
                    })(it.embed || it.videoUrl || it.url || it.video_url || ''),
                    url: it.url || it.link || it.videoUrl || it.video_url || (it.links && it.links[0] && it.links[0].href) || '',
                    title: it.title || it.name || '',
                    thumbnail: it.thumbnail || it.image || '',
                    date: it.date || it.published_at || '',
                    competition: it.competition || it.competition_name || '',
                    side1: (it.side1 && (it.side1.title || it.side1.name)) || '',
                    side2: (it.side2 && (it.side2.title || it.side2.name)) || '',
                    description: it.description || '',
                }))
                .filter((v) => (v.embed && typeof v.embed === 'string') || (v.url && typeof v.url === 'string'));
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('[highlightService] rapidapi fetch failed', (err as any)?.message || err);
            return [];
        }
    }

    async function findForMatch(home: string, away: string) {
        const homeNorm = String(home).toLowerCase();
        const awayNorm = String(away).toLowerCase();
        function normalize(s?: string) {
            return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        }

        function tokens(s: string) {
            return new Set(s.split(/\s+/).filter(Boolean));
        }

        function tokenMatch(a: string, b: string) {
            if (!a || !b) return false;
            const ta = tokens(normalize(a));
            const tb = tokens(normalize(b));
            for (const t of ta) {
                if (tb.has(t)) return true;
            }
            return false;
        }

        // Scorebat first
        const sb = await fetchFromScorebat();
        // eslint-disable-next-line no-console
        console.log('[highlightService] scorebat items fetched:', sb.length);
        const matchedSb = sb.filter((v) => {
            const s1 = normalize(v.side1 as string);
            const s2 = normalize(v.side2 as string);
            // direct substring OR token match
            if (s1 && s2) {
                if ((s1.includes(homeNorm) && s2.includes(awayNorm)) || (s1.includes(awayNorm) && s2.includes(homeNorm))) return true;
                if ((tokenMatch(s1, homeNorm) && tokenMatch(s2, awayNorm)) || (tokenMatch(s1, awayNorm) && tokenMatch(s2, homeNorm))) return true;
            }

            const text = normalize(`${v.title || ''} ${v.description || ''} ${v.url || ''}`);
            if ((homeNorm && text.includes(homeNorm)) || (awayNorm && text.includes(awayNorm))) return true;
            // token-level match against title/description
            if ((homeNorm && tokenMatch(text, homeNorm)) || (awayNorm && tokenMatch(text, awayNorm))) return true;
            return false;
        });
        // eslint-disable-next-line no-console
        console.log('[highlightService] Scorebat matched count=', matchedSb.length);
        if (matchedSb.length > 0) {
            return {
                videos: matchedSb.slice(0, 8),
                debug: { scorebatFetched: sb.length, scorebatMatched: matchedSb.length, rapidFetched: 0, rapidMatched: 0 },
            };
        }

        // Fallback to RapidAPI
        const rapid = await fetchFromRapidAPI();
        // eslint-disable-next-line no-console
        console.log('[highlightService] rapidapi items fetched:', rapid.length);
        const matched = rapid.filter((v) => {
            const s1 = normalize(v.side1 as string);
            const s2 = normalize(v.side2 as string);

            if (s1 && s2) {
                if ((s1.includes(homeNorm) && s2.includes(awayNorm)) || (s1.includes(awayNorm) && s2.includes(homeNorm))) return true;
                if ((tokenMatch(s1, homeNorm) && tokenMatch(s2, awayNorm)) || (tokenMatch(s1, awayNorm) && tokenMatch(s2, homeNorm))) return true;
            }

            const text = normalize(`${v.title || ''} ${v.description || ''} ${v.url || ''}`);
            if ((homeNorm && text.includes(homeNorm)) || (awayNorm && text.includes(awayNorm))) return true;
            if ((homeNorm && tokenMatch(text, homeNorm)) || (awayNorm && tokenMatch(text, awayNorm))) return true;
            return false;
        });

        // eslint-disable-next-line no-console
        console.log('[highlightService] RapidAPI matched count=', matched.length);
        return { videos: matched.slice(0, 8), debug: { scorebatFetched: sb.length, scorebatMatched: matchedSb.length, rapidFetched: rapid.length, rapidMatched: matched.length } };
    }

    function extractEmbedId(raw?: string) {
        if (!raw || typeof raw !== 'string') return undefined;
        // look for scorebat embed pattern: /embed/v/<id>/
        try {
            const m = raw.match(/scorebat\.com\/embed\/v\/([A-Za-z0-9_-]+)/i);
            if (m && m[1]) return m[1];
            const m2 = raw.match(/embed\/v\/([A-Za-z0-9_-]+)/i);
            if (m2 && m2[1]) return m2[1];
            // also try to extract from URLs in JSON escaped strings
            const m3 = raw.match(/https?:\\?\/\\?\/www\.scorebat\.com\\?\/embed\\?\/v\\?\/([A-Za-z0-9_-]+)/i);
            if (m3 && m3[1]) return m3[1];
        } catch (err) {
            // ignore
        }
        return undefined;
    }

    return {
        getCached,
        setCached,
        findForMatch,
    };
}

export type { VideoItem };
