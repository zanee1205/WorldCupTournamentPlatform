#!/usr/bin/env node
import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';

const WORLD_CUP_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

function safeString(value) {
  return typeof value === 'string' ? value : '';
}

function toInt(value) {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

function toDateKey(date) {
  if (!date) return '';
  return date.trim();
}

function toVietnamDateKeyAndTime(date, time) {
  const defaultKey = toDateKey(date);
  if (!time) return { dateKey: defaultKey, timeLabel: null };

  const trimmed = time.trim();
  const m = trimmed.match(/^(?<hh>\d{1,2}):(?<mm>\d{2})\s*UTC(?<offset>[+-]\d{1,2})$/i);
  if (!m?.groups) {
    return { dateKey: defaultKey, timeLabel: trimmed };
  }

  const hour = Number(m.groups.hh);
  const minute = Number(m.groups.mm);
  const offsetHours = Number(m.groups.offset);

  const parts = defaultKey.split('-').map((p) => Number(p));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return { dateKey: defaultKey, timeLabel: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
  }

  const [year, month, day] = parts;
  const utcEpoch = Date.UTC(year, month - 1, day, hour - offsetHours, minute);
  const vietnamEpoch = utcEpoch + 7 * 60 * 60 * 1000;
  const d = new Date(vietnamEpoch);
  const vy = d.getUTCFullYear();
  const vm = d.getUTCMonth() + 1;
  const vd = d.getUTCDate();
  const vh = d.getUTCHours();
  const vmin = d.getUTCMinutes();
  const pad = (n) => String(n).padStart(2, '0');
  return { dateKey: `${vy}-${pad(vm)}-${pad(vd)}`, timeLabel: `${pad(vh)}:${pad(vmin)}` };
}

function makeDeterministicId(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) + 1;
}

function mapOpenfootballStageToInternal(stageRaw) {
  const s = (stageRaw ?? '').toLowerCase();
  if (s.includes('group')) return 'group';
  if (s.includes('round of 32') || s.includes('roundof32') || s.includes('r16') || s.includes('32')) return 'round_of_32';
  if (s.includes('round of 16') || s.includes('roundof16') || s.includes('r8') || s.includes('16')) return 'round_of_16';
  if (s.includes('quarter')) return 'quarterfinal';
  if (s.includes('semi')) return 'semifinal';
  if (s.includes('third')) return 'third_place';
  if (s.includes('final')) return 'final';
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
  return map[stage] || 'Vòng bảng';
}

function extractFinal(match) {
  const ft = match.score?.ft;
  if (!ft || ft.length < 2) return { actualHomeScore: null, actualAwayScore: null };
  return { actualHomeScore: toInt(ft[0]), actualAwayScore: toInt(ft[1]) };
}

function extractHalftime(match) {
  const ht = match.score?.ht;
  if (!ht || ht.length < 2) return { halftimeHomeScore: null, halftimeAwayScore: null };
  return { halftimeHomeScore: toInt(ht[0]), halftimeAwayScore: toInt(ht[1]) };
}

function extractGoals(match, homeTeam, awayTeam) {
  const homeGoals = (match.goals1 ?? []).map((g) => ({ team: homeTeam, player: safeString(g.name), minute: g.minute ?? '' }));
  const awayGoals = (match.goals2 ?? []).map((g) => ({ team: awayTeam, player: safeString(g.name), minute: g.minute ?? '' }));
  return [...homeGoals, ...awayGoals].filter((x) => Boolean(x.player));
}

function toTeamNameENFromMaps(input, map) {
  if (!input) return '';
  const raw = input.trim();
  return map[raw] ?? raw;
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tournament';

  // load maps
  const manualPath = path.resolve(process.cwd(), 'server', 'src', 'mappings', 'teamNames.manual.json');
  const autoPath = path.resolve(process.cwd(), 'server', 'src', 'mappings', 'teamNames.auto.json');
  let manual = {};
  let auto = {};
  try { if (fs.existsSync(manualPath)) manual = JSON.parse(fs.readFileSync(manualPath, 'utf8')); } catch (e) {}
  try { if (fs.existsSync(autoPath)) auto = JSON.parse(fs.readFileSync(autoPath, 'utf8')); } catch (e) {}
  const TEAM_MAP = { ...auto, ...manual };

  await mongoose.connect(mongoUri);
  const Match = mongoose.models.TournamentMatch || mongoose.model('TournamentMatch', new mongoose.Schema({}, { strict: false }));

  console.log('Fetching upstream worldcup feed...');
  const res = await fetch(WORLD_CUP_URL, { headers: { 'Cache-Control': 'no-cache' } });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const json = await res.json();

  const stageEntries = [];
  if (json.stages && typeof json.stages === 'object') {
    for (const [stageKey, stageMatches] of Object.entries(json.stages)) {
      stageEntries.push({ stage: mapOpenfootballStageToInternal(stageKey), matches: Array.isArray(stageMatches) ? stageMatches : [] });
    }
  }
  if (stageEntries.length === 0 && Array.isArray(json.matches)) {
    stageEntries.push({ stage: 'group', matches: json.matches });
  }

  let fetched = 0;
  let inserted = 0;
  let updated = 0;

  for (const stageEntry of stageEntries) {
    const stage = stageEntry.stage;
    for (const m of stageEntry.matches) {
      fetched++;
      const homeLabel = toTeamNameENFromMaps(safeString(m.team1), TEAM_MAP);
      const awayLabel = toTeamNameENFromMaps(safeString(m.team2), TEAM_MAP);
      const { dateKey, timeLabel } = toVietnamDateKeyAndTime(m.date, m.time);
      if (!homeLabel || !awayLabel || !dateKey) continue;

      const groupLabel = safeString(m.group) || null;
      const venue = safeString(m.ground) || null;
      // canonical id should not depend on transient stage values
      const id = makeDeterministicId([groupLabel ?? '', dateKey, homeLabel, awayLabel].join('|').toLowerCase());

      const { actualHomeScore, actualAwayScore } = extractFinal(m);
      const halftime = extractHalftime(m);
      const goals = extractGoals(m, homeLabel, awayLabel);

      const result = actualHomeScore !== null && actualAwayScore !== null ? {
        actualHomeScore,
        actualAwayScore,
        halftimeHomeScore: halftime.halftimeHomeScore ?? undefined,
        halftimeAwayScore: halftime.halftimeAwayScore ?? undefined,
        goals,
        updatedAt: new Date().toISOString(),
      } : null;

      const existing = await Match.findOne({ id }).lean();
      const prediction = existing?.prediction ?? null;

      const doc = {
        id,
        stage,
        stageLabel: normalizeStageLabel(stage),
        dateKey,
        timeLabel: timeLabel ?? null,
        venue,
        groupLabel: stage === 'group' ? groupLabel : null,
        homeLabel,
        awayLabel,
        title: `${homeLabel} vs ${awayLabel}`,
        note: venue ? `Venue: ${venue}` : null,
        prediction,
        result,
        score: null,
      };

      if (!existing) {
        await Match.updateOne({ id }, { $set: doc }, { upsert: true });
        inserted++;
      } else {
        await Match.updateOne({ id }, { $set: doc });
        updated++;
      }
    }
  }

  console.log(`Fetched ${fetched} matches. Inserted ${inserted}, updated ${updated}.`);
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
