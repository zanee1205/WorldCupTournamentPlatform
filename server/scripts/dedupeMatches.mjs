#!/usr/bin/env node
import mongoose from 'mongoose';

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tournament';

async function main() {
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  const coll = db.collection('tournamentmatches');

  const dupGroups = await coll.aggregate([
    { $group: { _id: '$id', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]).toArray();

  console.log(`Found ${dupGroups.length} duplicate id groups.`);
  let totalRemoved = 0;
  let processed = 0;

  for (const g of dupGroups) {
    const id = g._id;
    const docs = await coll.find({ id }).toArray();
    if (docs.length <= 1) continue;

    // Choose keeper: prefer doc with prediction; else prefer doc with result.updatedAt; else first
    let keeper = docs.find((d) => d.prediction) || null;
    if (!keeper) {
      keeper = docs
        .slice()
        .sort((a, b) => {
          const ta = a.result?.updatedAt ? Date.parse(a.result.updatedAt) : 0;
          const tb = b.result?.updatedAt ? Date.parse(b.result.updatedAt) : 0;
          return tb - ta;
        })[0];
    }
    if (!keeper) keeper = docs[0];

    const merged = { ...keeper };

    for (const d of docs) {
      if (!merged.prediction && d.prediction) merged.prediction = d.prediction;
      if (!merged.result && d.result) merged.result = d.result;
      // fill missing metadata
      for (const f of ['stage', 'stageLabel', 'dateKey', 'timeLabel', 'venue', 'groupLabel', 'homeLabel', 'awayLabel', 'title', 'note']) {
        if ((merged[f] === null || merged[f] === undefined || merged[f] === '') && d[f]) merged[f] = d[f];
      }
    }

    // Update keeper with merged content
    const keepId = keeper._id;
    const patch = { ...merged };
    // Remove mongo internal fields if present
    delete patch._id;

    await coll.updateOne({ _id: keepId }, { $set: patch });

    // Remove other docs
    const otherIds = docs.filter((d) => String(d._id) !== String(keepId)).map((d) => d._id);
    if (otherIds.length) {
      const delRes = await coll.deleteMany({ _id: { $in: otherIds } });
      totalRemoved += delRes.deletedCount ?? 0;
    }

    processed++;
  }

  console.log(`Processed ${processed} groups, removed ${totalRemoved} documents.`);

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
