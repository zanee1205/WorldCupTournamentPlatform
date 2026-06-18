const DEFAULT_ALLOWED = 'https://world-cup-tournament-platform.vercel.app,http://localhost:5173';

export function setCorsHeaders(req: any, res: any) {
    const allowedEnv = String(process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED);
    const allowed = allowedEnv.split(',').map((s) => s.trim()).filter(Boolean);
    const origin = req.headers?.origin as string | undefined;

    if (!origin) {
        // server-to-server or same-origin
        res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (allowed.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

export function handleOptions(req: any, res: any) {
    if (req.method === 'OPTIONS') {
        setCorsHeaders(req, res);
        res.statusCode = 204;
        res.end();
        return true;
    }
    return false;
}

export default setCorsHeaders;
