#!/usr/bin/env node
import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';

// Load manual + auto maps
const manualPath = path.resolve(process.cwd(), 'server', 'src', 'mappings', 'teamNames.manual.json');
const autoPath = path.resolve(process.cwd(), 'server', 'src', 'mappings', 'teamNames.auto.json');
let manual = {};
let auto = {};
try { if (fs.existsSync(manualPath)) manual = JSON.parse(fs.readFileSync(manualPath, 'utf8')); } catch(e){}
try { if (fs.existsSync(autoPath)) auto = JSON.parse(fs.readFileSync(autoPath, 'utf8')); } catch(e){}

const map = { ...auto, ...manual };

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI not set. Aborting.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri, { dbName: undefined });
  // Resolve model definition from runtime compiled JS path
  const Match = mongoose.models.TournamentMatch || mongoose.model('TournamentMatch', new mongoose.Schema({}, { strict: false }));

  const matches = await Match.find({}).lean();
  console.log(`Found ${matches.length} matches in DB`);

  let updated = 0;
  for (const m of matches) {
    const home = (m.homeLabel || '').trim();
    const away = (m.awayLabel || '').trim();
    const homeEn = map[home] ?? home;
    const awayEn = map[away] ?? away;
    if (homeEn !== home || awayEn !== away) {
      await Match.updateOne({ id: m.id }, { $set: { homeLabel: homeEn, awayLabel: awayEn, title: `${homeEn} vs ${awayEn}` } });
      updated++;
    }
  }

  console.log(`Updated ${updated} matches.`);
  await mongoose.disconnect();
}

main().catch((err)=>{ console.error(err); process.exit(1); });
