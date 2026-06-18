#!/usr/bin/env node
import mongoose from 'mongoose';

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tournament';

async function main() {
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  const collName = 'tournamentmatches';
  const coll = db.collection(collName);

  const totalDocs = await coll.countDocuments();
  const distinctIds = await coll.distinct('id');
  const uniqueCount = distinctIds.length;

  console.log(`Total documents: ${totalDocs}`);
  console.log(`Unique id count: ${uniqueCount}`);

  const dups = await coll.aggregate([
    { $group: { _id: '$id', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 50 },
  ]).toArray();

  console.log(`Duplicate id groups (count>1): ${dups.length}`);
  for (const g of dups) {
    console.log(`  id=${g._id} count=${g.count}`);
  }

  if (dups.length > 0) {
    const sampleId = dups[0]._id;
    const docs = await coll.find({ id: sampleId }).toArray();
    console.log(`\nSample docs for id=${sampleId}:`);
    for (const d of docs) {
      console.log(`  _id=${d._id} title=${d.title ?? ''} home=${d.homeLabel} away=${d.awayLabel} prediction=${d.prediction ? 'yes' : 'no'} result=${d.result ? 'yes' : 'no'}`);
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
