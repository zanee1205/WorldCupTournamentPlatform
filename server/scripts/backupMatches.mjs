#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tournament';

async function main() {
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  const coll = db.collection('tournamentmatches');

  const docs = await coll.find({}).toArray();
  const outDir = path.resolve(process.cwd(), 'server', 'backups');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
  const outPath = path.join(outDir, `matches-backup-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(docs, null, 2), 'utf8');
  console.log(`Wrote backup to ${outPath} (${docs.length} documents)`);

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
