import express from 'express';
import type { TournamentRepository } from '../store.js';
import { createHighlightService } from '../services/highlightService.js';

export default function createHighlightRouter(repository: TournamentRepository) {
    const router = express.Router();
    const service = createHighlightService();

    // GET /api/highlights/:matchId - returns { videos: [...] }
    router.get('/:matchId', async (req, res) => {
        try {
            const matchId = Number(req.params.matchId);
            if (!Number.isInteger(matchId)) return res.status(400).json({ message: 'Invalid match id' });

            const matches = await repository.listMatches();
            const match = matches.find((m) => m.id === matchId);
            if (!match) return res.status(404).json({ message: 'Match not found' });
            if (!match.result) return res.json({ videos: [] });

            // Try DB cache first
            const cached = await service.getCached(matchId);
            if (cached && cached.length > 0) {
                return res.json({ videos: cached });
            }

            // Prefer explicit labels (homeLabel / awayLabel) when available
            const home = (match as any).homeLabel || String(match.title || '').split(' vs ')[0] || '';
            const away = (match as any).awayLabel || String(match.title || '').split(' vs ')[1] || '';

            // eslint-disable-next-line no-console
            console.log('[highlightRouter] fetching highlights for', { matchId, home, away });

            const result = await service.findForMatch(home, away);
            // eslint-disable-next-line no-console
            console.log('[highlightRouter] found videos count=', (result.videos || []).length);
            // Persist cache if possible
            await service.setCached(matchId, (result.videos || []) as any);

            const redirectUrl = `https://www.scorebat.com/?s=${encodeURIComponent(`${home} ${away}`.trim())}`;
            return res.json({ videos: result.videos || [], debug: result.debug || {}, redirectUrl });
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[highlightRouter] error', err);
            return res.status(500).json({ message: 'Failed to fetch highlights' });
        }
    });

    return router;
}
