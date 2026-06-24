/**
 * classifyFormations.ts
 *
 * Dung Groq API de phan loai formation cho 48 doi tuyen World Cup 2026.
 * Tu dong lay teamId, teamCode, group tu collection `players` (distinct).
 * Luu ket qua vao collection `teams`.
 *
 * Free tier Groq llama-3.3-70b-versatile: 30 req/phut, 14400 req/ngay
 *
 * Lay API key tai: https://console.groq.com/keys
 *
 * Cai dat:
 *   npm install groq-sdk
 *
 * Chay:
 *   set GROQ_API_KEY=gsk_...
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/classifyFormations.ts
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/classifyFormations.ts --dry-run
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/classifyFormations.ts --force
 */

import { MongoClient } from 'mongodb';
import Groq from 'groq-sdk';
import 'dotenv/config';

// Config
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.DB_NAME || 'tournament';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

const MODEL = 'llama-3.3-70b-versatile';
const RETRY_MAX = 3;
const RETRY_DELAY = 5_000;

// 30 req/phut -> delay 2.5s/req la an toan
const REQ_DELAY_MS = 2_500;

// CLI
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// Types
interface TeamInfo {
    teamId: number;
    teamName: string;
    teamCode: string;
    group: string;
}

interface TeamDoc extends TeamInfo {
    formation: string;
    formationSource: string;
    updatedAt: Date;
}

// Formation hop le
const VALID_FORMATIONS = new Set([
    '4-3-3', '4-2-3-1', '4-4-2', '4-5-1', '4-1-4-1',
    '3-4-3', '3-5-2', '3-4-2-1', '3-6-1',
    '5-3-2', '5-4-1', '5-2-3',
    '4-3-2-1', '4-4-1-1',
]);

const FALLBACK_FORMATION = '4-3-3';

// Groq API - classify 1 batch nhieu doi
async function classifyBatch(
    client: Groq,
    teams: TeamInfo[],
    attempt = 1
): Promise<Record<number, string>> {
    const teamList = teams
        .map(t => `- id:${t.teamId} | "${t.teamName}" | Group ${t.group}`)
        .join('\n');

    const prompt = `You are a professional football tactics analyst with deep knowledge of World Cup 2026 national teams.

Classify the preferred/default formation for each national team based on their most commonly used system in recent qualifiers and tournaments leading up to World Cup 2026.

Teams:
${teamList}

Valid formation codes:
4-3-3, 4-2-3-1, 4-4-2, 4-5-1, 4-1-4-1,
3-4-3, 3-5-2, 3-4-2-1, 3-6-1,
5-3-2, 5-4-1, 5-2-3,
4-3-2-1, 4-4-1-1

Rules:
1. Return ONLY a valid JSON object — no explanation, no markdown, no backticks
2. Every team in the list must have an entry in the response
3. Use the most common/recognizable formation for that national team
4. Key MUST be the teamId as a quoted string
5. Format: { "teamId": "FORMATION", ... }

Example:
{ "2": "4-3-3", "9": "4-3-3", "26": "4-3-3" }`;

    try {
        const response = await client.chat.completions.create({
            model: MODEL,
            temperature: 0.1,
            top_p: 0.8,
            messages: [
                { role: 'user', content: prompt },
            ],
        });

        const raw = response.choices[0]?.message?.content ?? '';
        // Strip markdown fences
        let cleaned = raw.replace(/```json|```/g, '').trim();
        // Fix: Groq doi khi tra numeric key khong co quotes: { 123: "4-3-3" }
        // -> wrap thanh { "123": "4-3-3" } de JSON.parse khong bi loi
        cleaned = cleaned.replace(/([{,]\s*)(\d+)(\s*:)/g, '$1"$2"$3');
        const parsed = JSON.parse(cleaned) as Record<string, string>;

        // Validate + fallback
        const result: Record<number, string> = {};
        for (const t of teams) {
            // Groq co the tra key la string hoac number
            const formation = parsed[t.teamId] ?? parsed[String(t.teamId)];
            if (formation && VALID_FORMATIONS.has(formation)) {
                result[t.teamId] = formation;
            } else {
                result[t.teamId] = FALLBACK_FORMATION;
                if (formation) {
                    process.stdout.write(`\n  ! "${t.teamName}" invalid formation "${formation}" -> fallback ${FALLBACK_FORMATION}`);
                } else {
                    process.stdout.write(`\n  ! "${t.teamName}" missing -> fallback ${FALLBACK_FORMATION}`);
                }
            }
        }

        return result;

    } catch (err) {
        const msg = (err as Error).message ?? '';

        if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate limit')) {
            if (attempt < RETRY_MAX) {
                const wait = 60_000;
                console.log(`\n  Rate limit, doi ${wait / 1000}s roi retry (${attempt}/${RETRY_MAX})...`);
                await sleep(wait);
                return classifyBatch(client, teams, attempt + 1);
            }
        }

        if (attempt < RETRY_MAX) {
            console.log(`\n  Loi, retry ${attempt}/${RETRY_MAX} sau ${RETRY_DELAY / 1000}s... (${msg})`);
            await sleep(RETRY_DELAY * attempt);
            return classifyBatch(client, teams, attempt + 1);
        }
        throw err;
    }
}

// Main
async function main() {
    console.log('==================================================');
    console.log('  WC 2026 -- classifyFormations (Groq)');
    console.log(`  Model : ${MODEL}`);
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
        const playersCol = mongoClient.db(DB_NAME).collection('players');
        const teamsCol = mongoClient.db(DB_NAME).collection<TeamDoc>('teams');

        // Lay danh sach doi tuyen tu players (distinct theo teamId)
        console.log('Dang lay danh sach doi tuyen tu collection players...');
        const rawTeams = await playersCol.aggregate<TeamInfo>([
            {
                $group: {
                    _id: '$teamId',
                    teamName: { $first: '$teamName' },
                    teamCode: { $first: '$teamCode' },
                    group: { $first: '$group' },
                },
            },
            {
                $project: {
                    _id: 0,
                    teamId: '$_id',
                    teamName: 1,
                    teamCode: 1,
                    group: 1,
                },
            },
            { $sort: { teamName: 1 } },
        ]).toArray();

        console.log(`Tim thay ${rawTeams.length} doi tuyen trong DB\n`);

        // Filter nhung doi chua co trong teams collection (neu khong --force)
        let teamsToProcess: TeamInfo[];
        if (FORCE) {
            teamsToProcess = rawTeams;
            console.log('--force: se classify lai tat ca doi tuyen\n');
        } else {
            const existing = await teamsCol
                .find({ formationSource: 'ai' }, { projection: { teamId: 1, _id: 0 } })
                .toArray();
            const existingIds = new Set(existing.map(t => t.teamId));
            teamsToProcess = rawTeams.filter(t => !existingIds.has(t.teamId));
            console.log(`Doi chua co formation: ${teamsToProcess.length} / ${rawTeams.length}`);
            if (teamsToProcess.length === 0) {
                console.log('Tat ca doi da co formation roi. Dung --force de chay lai.');
                return;
            }
            console.log('');
        }

        // Chia batch 10 doi/lan de prompt khong qua dai
        const BATCH_SIZE = 10;
        const batches: TeamInfo[][] = [];
        for (let i = 0; i < teamsToProcess.length; i += BATCH_SIZE) {
            batches.push(teamsToProcess.slice(i, i + BATCH_SIZE));
        }

        const estMins = Math.ceil(batches.length * REQ_DELAY_MS / 60_000);
        console.log(`So batch: ${batches.length} x ${BATCH_SIZE} doi ~ ${estMins} phut\n`);

        let totalUpdated = 0;
        let totalFallback = 0;
        let totalErrors = 0;

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            const progress = `[${String(i + 1).padStart(2)}/${batches.length}]`;
            const names = batch.map(t => t.teamName).join(', ');
            process.stdout.write(`${progress} ${names}... `);

            try {
                const result = await classifyBatch(groqClient, batch);

                const fallbackCount = Object.values(result).filter(f => f === FALLBACK_FORMATION).length;

                process.stdout.write(
                    `-> OK${fallbackCount > 0 ? ` (${fallbackCount} fallback)` : ''}\n`
                );

                if (DRY_RUN) {
                    for (const t of batch) {
                        console.log(`  [DRY] ${t.teamCode} "${t.teamName}" Group ${t.group} -> ${result[t.teamId]}`);
                    }
                    totalUpdated += batch.length;
                    totalFallback += fallbackCount;
                    continue;
                }

                const now = new Date();
                for (const t of batch) {
                    const formation = result[t.teamId];
                    await teamsCol.updateOne(
                        { teamId: t.teamId },
                        {
                            $set: {
                                teamId: t.teamId,
                                teamName: t.teamName,
                                teamCode: t.teamCode,
                                group: t.group,
                                formation,
                                formationSource: 'ai',
                                updatedAt: now,
                            },
                        },
                        { upsert: true }
                    );
                    totalUpdated++;
                    if (formation === FALLBACK_FORMATION) totalFallback++;
                }

            } catch (err) {
                console.log(`-> LOI: ${(err as Error).message}`);
                totalErrors += batch.length;
            }

            // Doi giua cac batch de tranh vuot rate limit free tier
            if (i < batches.length - 1) await sleep(REQ_DELAY_MS);
        }

        const totalInDb = DRY_RUN
            ? '(dry-run)'
            : await teamsCol.countDocuments({ formationSource: 'ai' });

        // Preview ket qua
        if (!DRY_RUN && totalUpdated > 0) {
            console.log('\n--- Preview 5 doi dau ---');
            const preview = await teamsCol
                .find({ formationSource: 'ai' })
                .sort({ teamName: 1 })
                .limit(5)
                .toArray();
            for (const t of preview) {
                console.log(`  ${t.teamCode} "${t.teamName}" Group ${t.group} -> ${t.formation}`);
            }
            console.log('...');
        }

        console.log('\n==================================================');
        console.log('  Ket qua');
        console.log(`  Updated  : ${totalUpdated}`);
        console.log(`  Fallback : ${totalFallback} (dung ${FALLBACK_FORMATION} mac dinh)`);
        console.log(`  Loi      : ${totalErrors}`);
        console.log(`  Tong AI  : ${totalInDb} doi tuyen`);
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