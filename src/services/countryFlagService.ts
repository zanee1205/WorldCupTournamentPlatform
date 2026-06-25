import { COUNTRY_FLAG_CODE } from '../../server/src/mappings/countryFlagCode.ts';

function normalizeName(s: string) {
  return s
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/&/g, ' and ')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const NORMALIZED_MAP: Record<string, string> = {};
Object.keys(COUNTRY_FLAG_CODE).forEach((k) => {
  try {
    NORMALIZED_MAP[normalizeName(k)] = COUNTRY_FLAG_CODE[k];
  } catch {
    // ignore
  }
});

const ENGLISH_NAME_MAP: Record<string, string> = {
  'united states': 'us',
  'united states of america': 'us',
  usa: 'us',
  'south africa': 'za',
  'south korea': 'kr',
  'korea republic': 'kr',
  'czech republic': 'cz',
  czechia: 'cz',
  england: 'gb-eng',
  'ivory coast': 'ci',
  "cote divoire": 'ci',
  "cote d'ivoire": 'ci',
  "côte d'ivoire": 'ci',
  'dr congo': 'cd',
  'democratic republic of the congo': 'cd',
  'cape verde': 'cv',
  austria: 'at',
  norway: 'no',
  scotland: 'gb-sct',
  'bosnia herzegovina': 'ba',
  switzerland: 'ch',
  portugal: 'pt',
  egypt: 'eg',
  belgium: 'be',
  spain: 'es',
  france: 'fr',
  turkey: 'tr',
  netherlands: 'nl',
  sweden: 'se',
  japan: 'jp',
  germany: 'de',
};

function findCodeForName(name?: string | null) {
  if (!name) return null;

  const direct = COUNTRY_FLAG_CODE[name];
  if (direct) return direct;

  const normalized = normalizeName(name);
  if (NORMALIZED_MAP[normalized]) return NORMALIZED_MAP[normalized];
  if (ENGLISH_NAME_MAP[normalized]) return ENGLISH_NAME_MAP[normalized];

  const parts = name.split(/vs|VS|[-–—]/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const n = normalizeName(part);
    const code = COUNTRY_FLAG_CODE[part] || NORMALIZED_MAP[n] || ENGLISH_NAME_MAP[n];
    if (code) return code;
  }

  const first = name.split(' ')[0];
  const firstNormalized = normalizeName(first);
  return COUNTRY_FLAG_CODE[first] || NORMALIZED_MAP[firstNormalized] || ENGLISH_NAME_MAP[firstNormalized] || null;
}

function buildEmojiFromCode(code?: string | null) {
  if (!code) return null;
  const iso = code.split('-')[0];
  if (!iso || iso.length < 2) return null;

  const up = iso.slice(0, 2).toUpperCase();
  try {
    return Array.from(up).map((c) => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');
  } catch {
    return null;
  }
}

const FLAG_ASSET_URLS = import.meta.glob('../assets/flags/*.svg', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

function getLocalFlagUrl(code: string) {
  const assetPath = Object.keys(FLAG_ASSET_URLS).find((path) => path.endsWith(`/${code}.svg`));
  return assetPath ? FLAG_ASSET_URLS[assetPath] : null;
}

export type FlagAssetPlan = {
  code: string | null;
  emoji: string | null;
  sources: string[];
};

export function createFlagAssetPlan(name?: string | null, size = 24): FlagAssetPlan {
  const code = findCodeForName(name);
  const emoji = buildEmojiFromCode(code);

  if (!code) {
    return { code: null, emoji, sources: [] };
  }

  const sources = [
    getLocalFlagUrl(code),
    `/api/flag/${code}?size=${size}`,
    `https://flagcdn.com/w${size}/${code}.png`,
  ].filter((source): source is string => Boolean(source));

  return { code, emoji, sources };
}
