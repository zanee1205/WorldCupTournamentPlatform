import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders, handleOptions } from '../_cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    setCorsHeaders(req, res);
    if (handleOptions(req, res)) return;

    if (req.method !== 'GET') {
        res.status(405).json({ message: 'Method not allowed' });
        return;
    }

    try {
        const code = String(req.query.code || '').toLowerCase();
        const size = String(req.query.size || '40');
        const format = String(req.query.format || 'png');

        const url = format === 'svg' ? `https://flagcdn.com/${code}.svg` : `https://flagcdn.com/w${size}/${code}.png`;

        const fetchRes = await fetch(url);
        if (!fetchRes.ok) {
            res.status(502).json({ message: 'Unable to fetch flag image' });
            return;
        }

        const contentType = fetchRes.headers.get('content-type') ?? (format === 'svg' ? 'image/svg+xml' : 'image/png');
        res.setHeader('Content-Type', contentType);
        const buffer = Buffer.from(await fetchRes.arrayBuffer());
        res.status(200).send(buffer);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[api/flag] error', err);
        res.status(500).json({ message: 'Flag proxy error' });
    }
}
