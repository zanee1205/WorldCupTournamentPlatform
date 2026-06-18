#!/usr/bin/env node
import mongoose from 'mongoose';

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tournament';

async function main() {
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  const coll = db.collection('tournamentmatches');

  console.log('Looking for duplicate titles...');
  const titleGroups = await coll.aggregate([
    { $group: { _id: '$title', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 50 },
  ]).toArray();

  console.log(`Found ${titleGroups.length} title groups with >1 doc`);
  for (const g of titleGroups) {
    console.log(`\nTitle: ${g._id} (count=${g.count})`);
    const docs = await coll.find({ title: g._id }).toArray();
    for (const d of docs) {
      console.log(`  _id=${d._id} id=${d.id} date=${d.dateKey} home=${d.homeLabel} away=${d.awayLabel} stage=${d.stage} stageLabel=${d.stageLabel} group=${d.groupLabel} time=${d.timeLabel}`);
    }
  }

  console.log('\nLooking for composite duplicates (date+home+away)...');
  const composite = await coll.aggregate([
    { $group: { _id: { dateKey: '$dateKey', home: '$homeLabel', away: '$awayLabel' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 50 },
  ]).toArray();

  console.log(`Found ${composite.length} composite groups with >1 doc`);
  for (const g of composite) {
    const key = g._id;
    console.log(`\nComposite: date=${key.dateKey} home=${key.home} away=${key.away} (count=${g.count})`);
    const docs = await coll.find({ dateKey: key.dateKey, homeLabel: key.home, awayLabel: key.away }).toArray();
    for (const d of docs) {
      console.log(`  _id=${d._id} id=${d.id} stage=${d.stage} stageLabel=${d.stageLabel} group=${d.groupLabel} title=${d.title}`);
    }
  }

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
