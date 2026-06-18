import { setCorsHeaders, handleOptions } from './_cors';

export default async function handler(_req: any, res: any) {
    setCorsHeaders(_req, res);
    if (handleOptions(_req, res)) return;
    res.status(200).json({ ok: true });
}
