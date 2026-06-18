import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getRepository } from './_repo';
import { setCorsHeaders, handleOptions } from './_cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    setCorsHeaders(req, res);
    if (handleOptions(req, res)) return;

    if (req.method !== 'GET') {
        res.status(405).json({ message: 'Method not allowed' });
        return;
    }

    try {
        const repo = await getRepository();
        const dashboard = await repo.getDashboard();
        res.status(200).json(dashboard);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[api/dashboard] error', err);
        res.status(500).json({ message: 'Internal server error' });
    }
}
