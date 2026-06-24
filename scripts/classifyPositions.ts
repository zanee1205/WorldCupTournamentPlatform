/**
 * classifyPositions.ts
 *
 * Dung Groq API (free tier) de phan loai position chi tiet cho toan bo cau thu.
 *
 * Free tier Groq llama-3.3-70b-versatile: 30 req/phut, 14400 req/ngay
 * -> 25 batch hoan toan nam trong free tier, khong can tra phi.
 *
 * Lay API key tai: https://console.groq.com/keys
 *
 * Cai dat:
 *   npm install groq-sdk
 *
 * Chay:
 *   set GROQ_API_KEY=gsk_...
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/classifyPositions.ts
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/classifyPositions.ts --dry-run
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/classifyPositions.ts --batch=50
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/classifyPositions.ts --force
 */

import { MongoClient } from 'mongodb';
import Groq from 'groq-sdk';
import 'dotenv/config';

// Config
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.DB_NAME || 'tournament';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

// Groq llama-3.3-70b-versatile: nhanh, mien phi, kien thuc tot ve bong da
const MODEL = 'llama-3.3-70b-versatile';
const BATCH_SIZE = 50;
const RETRY_MAX = 3;
const RETRY_DELAY = 5_000;

// Free tier: 30 req/phut -> delay 2.5s/req la an toan
const REQ_DELAY_MS = 2_500;

// CLI
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const batchArg = process.argv.find(a => a.startsWith('--batch='));
const EFFECTIVE_BATCH = batchArg ? parseInt(batchArg.split('=')[1], 10) : BATCH_SIZE;

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// Types
interface PlayerDoc {
    playerId: string;
    name: string;
    teamName: string;
    teamCode: string;
    number: number | null;
    position: string;
    positionSource?: string;
}

// Position hop le
const VALID_POSITIONS = new Set([
    'GK',
    'CB', 'LB', 'RB', 'LWB', 'RWB',
    'CDM', 'CM', 'CAM', 'LM', 'RM',
    'LW', 'RW', 'CF', 'ST', 'SS',
]);

function fallbackPosition(pos: string): string {
    const map: Record<string, string> = {
        'GK': 'GK', 'G': 'GK',
        'DF': 'CB', 'D': 'CB',
        'MF': 'CM', 'M': 'CM',
        'FW': 'ST', 'F': 'ST',
        'NA': 'CM',
    };
    return map[pos] ?? 'CM';
}

// Groq API
async function classifyBatch(
    client: Groq,
    players: PlayerDoc[],
    attempt = 1
): Promise<Record<string, string>> {
    const playerList = players
        .map(p => {
            const shirt = p.number != null ? `#${p.number}` : '???';
            return `- id:"${p.playerId}" | ${shirt} | "${p.name}" | ${p.teamCode} (${p.teamName}) | generalPos:${p.position}`;
        })
        .join('\n');

    const prompt = `You are a professional football data analyst with deep knowledge of World Cup 2026 squads.

Classify the detailed playing position for each player. Note that player names may be abbreviated (e.g. "A. Vega" for "Alexis Vega") — use the shirt number, team, and your knowledge of the squad to identify them accurately.

Players:
${playerList}

Position codes to use (choose ONE per player):
- Goalkeeper : GK
- Defenders  : CB, LB, RB, LWB, RWB
- Midfielders: CDM, CM, CAM, LM, RM
- Forwards   : LW, RW, CF, ST, SS

Rules:
1. Return ONLY a valid JSON object — no explanation, no markdown, no backticks
2. Every player in the list must have an entry in the response
3. Use the generalPos as a last resort fallback if you truly cannot identify the player
4. Format: { "playerId": "POSITION_CODE", ... }

Example:
{ "fra_k_mbappe": "ST", "fra_n_kante": "CDM", "fra_t_hernandez": "LB" }`;

    try {
        const response = await client.chat.completions.create({
            model: MODEL,
            temperature: 0.1,    // thap de ket qua on dinh, it hallucinate
            top_p: 0.8,
            messages: [
                { role: 'user', content: prompt },
            ],
        });

        const raw = response.choices[0]?.message?.content ?? '';

        // Strip markdown fences neu co
        const cleaned = raw.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleaned) as Record<string, string>;

        // Validate + fallback
        const result: Record<string, string> = {};
        for (const p of players) {
            const pos = parsed[p.playerId];
            if (pos && VALID_POSITIONS.has(pos)) {
                result[p.playerId] = pos;
            } else {
                const fb = fallbackPosition(p.position);
                result[p.playerId] = fb;
                if (pos) {
                    process.stdout.write(`\n  ! "${p.name}" invalid pos "${pos}" -> fallback ${fb}`);
                } else {
                    process.stdout.write(`\n  ! "${p.name}" missing -> fallback ${fb}`);
                }
            }
        }

        return result;

    } catch (err) {
        const msg = (err as Error).message ?? '';

        // Rate limit -> doi lau hon
        if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate limit')) {
            if (attempt < RETRY_MAX) {
                const wait = 60_000;
                console.log(`\n  Rate limit, doi ${wait / 1000}s roi retry (${attempt}/${RETRY_MAX})...`);
                await sleep(wait);
                return classifyBatch(client, players, attempt + 1);
            }
        }

        if (attempt < RETRY_MAX) {
            console.log(`\n  Loi, retry ${attempt}/${RETRY_MAX} sau ${RETRY_DELAY / 1000}s... (${msg})`);
            await sleep(RETRY_DELAY * attempt);
            return classifyBatch(client, players, attempt + 1);
        }
        throw err;
    }
}

// Main
async function main() {
    console.log('==================================================');
    console.log('  WC 2026 -- classifyPositions (Groq)');
    console.log(`  Model : ${MODEL}`);
    console.log(`  Batch : ${EFFECTIVE_BATCH} cau thu/lan`);
    console.log(`  Delay : ${REQ_DELAY_MS}ms/batch (free tier safe)`);
    console.log(`  DB    : ${DB_NAME} @ ${MONGO_URI}`);
    console.log(`  Flags : ${[DRY_RUN && 'DRY-RUN', FORCE && 'FORCE'].filter(Boolean).join(', ') || 'none'}`);
    console.log('==================================================\n');

    if (!GROQ_API_KEY) {
        throw new Error(
            'Thieu GROQ_API_KEY.\n' +
            'Lay key tai: https://console.groq.com/keys\n' +
            'Windows  : set GROQ_API_KEY=gsk_...\n' +
            'Mac/Linux: export GROQ_API_KEY=gsk_...'
        );
    }

    const mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    console.log('OK Ket noi MongoDB\n');

    const groqClient = new Groq({ apiKey: GROQ_API_KEY });

    try {
        const col = mongoClient.db(DB_NAME).collection<PlayerDoc>('players');

        const query = FORCE ? {} : { positionSource: { $ne: 'ai' } };

        const players = await col
            .find(query, {
                projection: {
                    playerId: 1,
                    name: 1,
                    teamName: 1,
                    teamCode: 1,
                    number: 1,
                    position: 1,
                    _id: 0,
                },
            })
            .toArray();

        console.log(`Tong cau thu can classify: ${players.length}`);

        if (players.length === 0) {
            console.log('Tat ca cau thu da duoc classify roi. Dung --force de chay lai.');
            return;
        }

        const batches: PlayerDoc[][] = [];
        for (let i = 0; i < players.length; i += EFFECTIVE_BATCH) {
            batches.push(players.slice(i, i + EFFECTIVE_BATCH));
        }

        const estMins = Math.ceil(batches.length * REQ_DELAY_MS / 60_000);
        console.log(`So batch: ${batches.length} x ${EFFECTIVE_BATCH} cau thu ~ ${estMins} phut\n`);

        let totalUpdated = 0;
        let totalFallback = 0;
        let totalErrors = 0;

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            const progress = `[${String(i + 1).padStart(2)}/${batches.length}]`;
            process.stdout.write(`${progress} ${batch.length} cau thu... `);

            try {
                const result = await classifyBatch(groqClient, batch);

                const fallbackCount = batch.filter(p =>
                    result[p.playerId] === fallbackPosition(p.position)
                ).length;

                process.stdout.write(
                    `-> OK${fallbackCount > 0 ? ` (${fallbackCount} fallback)` : ''}\n`
                );

                if (DRY_RUN) {
                    for (const p of batch.slice(0, 3)) {
                        console.log(`  [DRY] ${p.teamCode} #${p.number ?? '?'} "${p.name}" : ${p.position} -> ${result[p.playerId]}`);
                    }
                    totalUpdated += batch.length;
                    totalFallback += fallbackCount;
                    continue;
                }

                const now = new Date();
                for (const [playerId, position] of Object.entries(result)) {
                    await col.updateOne(
                        { playerId },
                        { $set: { position, positionSource: 'ai', updatedAt: now } }
                    );
                    totalUpdated++;
                }
                totalFallback += fallbackCount;

            } catch (err) {
                console.log(`-> LOI: ${(err as Error).message}`);
                totalErrors += batch.length;
            }

            // Doi giua cac batch de tranh vuot rate limit free tier
            if (i < batches.length - 1) await sleep(REQ_DELAY_MS);
        }

        const totalInDb = DRY_RUN
            ? '(dry-run)'
            : await col.countDocuments({ positionSource: 'ai' });

        console.log('\n==================================================');
        console.log('  Ket qua');
        console.log(`  Updated  : ${totalUpdated}`);
        console.log(`  Fallback : ${totalFallback} (khong nhan ra -> dung nhom chung)`);
        console.log(`  Loi      : ${totalErrors}`);
        console.log(`  Tong AI  : ${totalInDb} cau thu`);
        if (DRY_RUN) console.log('  (DRY-RUN -- khong co gi duoc ghi)');
        console.log('==================================================');

    } finally {
        await mongoClient.close();
        console.log('Dong MongoDB connection');
    }
}

main().catch(err => {
    console.error('\nFatal:', err.message ?? err);
    process.exit(1);
});