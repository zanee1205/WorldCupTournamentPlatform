#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const WORLD_CUP_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

function safeString(v) {
  return typeof v === 'string' ? v : '';
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  return await res.json();
}

async function main() {
  console.log('Fetching upstream feed...');
  const json = await fetchJson(WORLD_CUP_URL);

  const names = new Set();

  if (json.stages && typeof json.stages === 'object') {
    for (const stageMatches of Object.values(json.stages)) {
      if (!Array.isArray(stageMatches)) continue;
      for (const m of stageMatches) {
        names.add(safeString(m.team1));
        names.add(safeString(m.team2));
      }
    }
  }

  if (Array.isArray(json.matches)) {
    for (const m of json.matches) {
      names.add(safeString(m.team1));
      names.add(safeString(m.team2));
    }
  }

  const list = Array.from(names).filter(Boolean).sort((a,b)=>a.localeCompare(b));
  console.log(`Found ${list.length} unique team names in feed`);

  const outDir = path.resolve(process.cwd(), 'server', 'src', 'mappings');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'teamNames.auto.json');

  // Load existing auto file if present
  let existing = {};
  if (fs.existsSync(outPath)) {
    try { existing = JSON.parse(fs.readFileSync(outPath, 'utf8')); } catch (e) { existing = {}; }
  }

  const updated = { ...existing };
  let added = 0;
  for (const n of list) {
    if (!(n in updated)) {
      updated[n] = n; // identity mapping for upstream names
      added++;
    }
  }

  // Sort keys
  const sorted = {};
  for (const k of Object.keys(updated).sort((a,b)=>a.localeCompare(b))) sorted[k] = updated[k];

  fs.writeFileSync(outPath, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${outPath} (${added} new entries)`);
}

main().catch((err)=>{
  console.error(err);
  process.exit(1);
});
