#!/usr/bin/env node
import mongoose from 'mongoose';

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tournament';

function makeDeterministicId(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) + 1;
}

function determineStageFromParts(parts) {
  const s = parts.join(' ').toLowerCase();
  if (s.includes('third')) return 'third_place';
  if (s.includes('final') && !s.includes('third')) return 'final';
  if (s.includes('semi') || s.includes('semifinal')) return 'semifinal';
  if (s.includes('quarter') || s.includes('1/4')) return 'quarterfinal';
  if (s.includes('round of 32') || s.includes('roundof32') || s.includes('r32') || /\b32\b/.test(s)) return 'round_of_32';
  if (s.includes('round of 16') || s.includes('roundof16') || s.includes('r16') || s.includes('1/8') || /\b16\b/.test(s)) return 'round_of_16';
  if (s.includes('matchday') || s.match(/matchday|day\s*\d+/i)) return 'group';
  if (s.includes('group') || s.includes('groupstage') || s.includes('group stage')) return 'group';
  return 'group';
}

function normalizeStageLabel(stage) {
  const map = {
    group: 'Vòng bảng',
    round_of_32: 'Vòng 32 đội',
    round_of_16: 'Vòng 1/8',
    quarterfinal: 'Vòng tứ kết',
    semifinal: 'Vòng bán kết',
    third_place: 'Tranh hạng Ba',
    final: 'Chung kết',
  };
  return map[stage] ?? stage;
}

async function main() {
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  const coll = db.collection('tournamentmatches');

  const groups = await coll
    .aggregate([
      {
        $group: {
          _id: {
            dateKey: '$dateKey',
            home: '$homeLabel',
            away: '$awayLabel',
            groupLabel: '$groupLabel',
          },
          docs: { $push: '$$ROOT' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  console.log(`Found ${groups.length} composite groups with >1 doc.`);
  let removed = 0;
  let mergedCount = 0;

  for (const g of groups) {
    const { dateKey, home, away, groupLabel } = g._id;
    const docs = g.docs;

    // Build parts to determine normalized stage
    const parts = [];
    for (const d of docs) {
      if (d.stage) parts.push(String(d.stage));
      if (d.round) parts.push(String(d.round));
      if (d.group) parts.push(String(d.group));
    }
    const stage = determineStageFromParts(parts);
    const stageLabel = normalizeStageLabel(stage);

    // Merge documents: prefer prediction, then result, then fill metadata
    const merged = {};
    for (const d of docs) {
      // copy basic fields if missing
      for (const f of ['stage', 'stageLabel', 'dateKey', 'timeLabel', 'venue', 'groupLabel', 'homeLabel', 'awayLabel', 'title', 'note']) {
        if (!merged[f] && d[f]) merged[f] = d[f];
      }

      if (!merged.prediction && d.prediction) merged.prediction = d.prediction;
      if (!merged.result && d.result) merged.result = d.result;
    }

    merged.stage = stage;
    merged.stageLabel = stageLabel;
    merged.dateKey = dateKey;
    merged.groupLabel = groupLabel ?? null;
    merged.homeLabel = home ?? merged.homeLabel ?? '';
    merged.awayLabel = away ?? merged.awayLabel ?? '';
    merged.title = merged.title ?? `${merged.homeLabel} vs ${merged.awayLabel}`;
    merged.note = merged.note ?? null;

    // canonical id should not depend on transient stage values
    const canonicalId = makeDeterministicId([groupLabel ?? '', dateKey, merged.homeLabel, merged.awayLabel].join('|').toLowerCase());
    merged.id = canonicalId;

    // Remove all docs in this composite group
    const idsToRemove = docs.map((d) => d._id);
    await coll.deleteMany({ _id: { $in: idsToRemove } });

    // Insert merged doc
    await coll.insertOne(merged);
    removed += idsToRemove.length - 1;
    mergedCount += 1;
  }

  console.log(`Merged ${mergedCount} composite groups, removed ${removed} extra documents.`);

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
