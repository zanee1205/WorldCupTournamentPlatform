#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';

async function main() {
  const repoRoot = process.cwd();
  const mappingFile = path.join(repoRoot, 'server', 'src', 'mappings', 'countryFlagCode.ts');
  const outDir = path.join(repoRoot, 'public', 'flags');

  try {
    const txt = await fs.readFile(mappingFile, 'utf8');
    const codes = new Set();

    // extract codes like : 'us' , : 'gb-eng' etc.
    const re = /:\s*'([a-z0-9-]+)'/gi;
    let m;
    while ((m = re.exec(txt))) {
      codes.add(m[1]);
    }

    await fs.mkdir(outDir, { recursive: true });

    console.log(`Found ${codes.size} codes. Downloading to ${outDir} ...`);

    for (const code of Array.from(codes).sort()) {
      try {
        const svgUrl = `https://flagcdn.com/${code}.svg`;
        const res = await fetch(svgUrl);
        if (!res.ok) {
          console.warn(`Skipping ${code} (svg fetch failed: ${res.status})`);
          continue;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        const outPath = path.join(outDir, `${code}.svg`);
        await fs.writeFile(outPath, buf);
        console.log(`Saved ${outPath}`);
      } catch (err) {
        console.warn(`Error fetching ${code}:`, err && err.message ? err.message : err);
      }
    }

    console.log('Done.');
  } catch (err) {
    console.error('Failed to download flags:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

void main();
