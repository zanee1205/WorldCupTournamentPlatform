#!/usr/bin/env node
import mongoose from 'mongoose';

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tournament';

async function main() {
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  const coll = db.collection('tournamentmatches');

  const total = await coll.countDocuments();
  console.log(`Total documents: ${total}`);

  const byStage = await coll.aggregate([{ $group: { _id: '$stage', count: { $sum: 1 } } }, { $sort: { count: -1 } }]).toArray();
  console.log('\nCounts by stage:');
  for (const r of byStage) console.log(`  ${r._id ?? '<null>'}: ${r.count}`);

  const byDate = await coll.aggregate([{ $group: { _id: '$dateKey', count: { $sum: 1 } } }, { $sort: { _id: 1 } }, { $limit: 20 }]).toArray();
  console.log('\nSample dates (first 20):');
  for (const r of byDate) console.log(`  ${r._id}: ${r.count}`);

  const topTitles = await coll.aggregate([{ $group: { _id: '$title', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 20 }]).toArray();
  console.log('\nTop titles:');
  for (const t of topTitles) console.log(`  (${t.count}) ${t._id}`);

  await mongoose.disconnect();
}

main().catch((e)=>{ console.error(e); process.exit(1); });
