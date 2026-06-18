import { getRepository } from '../../_repo.js';
import { setCorsHeaders, handleOptions } from '../../_cors.js';

export default async function handler(req: any, res: any) {
    setCorsHeaders(req, res);
    if (handleOptions(req, res)) return;

    if (req.method !== 'PATCH') {
        res.status(405).json({ message: 'Method not allowed' });
        return;
    }

    const { id } = req.query;
    const matchId = Number(Array.isArray(id) ? id[0] : id);

    if (!Number.isInteger(matchId)) {
        res.status(400).json({ message: 'Invalid match id' });
        return;
    }

    const predictedHomeScore = Number(req.body?.predictedHomeScore);
    const predictedAwayScore = Number(req.body?.predictedAwayScore);

    try {
        // Debug log for serverless environment
        // eslint-disable-next-line no-console
        console.log('[api] PATCH /api/matches/%s/prediction payload=', matchId, req.body);

        const repo = await getRepository();
        const updated = await repo.updatePrediction(matchId, {
            predictedHomeScore,
            predictedAwayScore,
        });

        // eslint-disable-next-line no-console
        console.log('[api] updatePrediction success for', matchId, { prediction: updated.prediction });

        res.status(200).json(updated);
    } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[api] updatePrediction error', err?.message ?? err);
        const message = err instanceof Error ? err.message : 'Unable to update prediction';
        res.status(message.includes('khóa dự đoán') ? 423 : 400).json({ message });
    }
}
