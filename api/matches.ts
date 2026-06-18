import { getRepository } from './_repo';
import { setCorsHeaders, handleOptions } from './_cors';

export default async function handler(req: any, res: any) {
    setCorsHeaders(req, res);
    if (handleOptions(req, res)) return;

    if (req.method !== 'GET') {
        res.status(405).json({ message: 'Method not allowed' });
        return;
    }

    try {
        const repo = await getRepository();
        const matches = await repo.listMatches();
        res.status(200).json(matches);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[api/matches] error', err);
        res.status(500).json({ message: 'Internal server error' });
    }
}
