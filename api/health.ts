import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders, handleOptions } from './_cors';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
    setCorsHeaders(_req, res);
    if (handleOptions(_req, res)) return;
    res.status(200).json({ ok: true });
}
