const fs = require('fs');
const html = fs.readFileSync('tmp_wiki.html', 'utf8');
const h3Regex = /<h3[^>]*>.*?<\/h3>/gs;
const allH3s = [...html.matchAll(h3Regex)];
const idx = allH3s.findIndex(h => /Mexico/i.test(h[0]));
console.log('h3 count', allH3s.length, 'mex idx', idx);
if (idx < 0) { console.log('Mexico h3 not found'); process.exit(0); }
const startIdx = allH3s[idx].index + allH3s[idx][0].length;
const endIdx = idx + 1 < allH3s.length ? allH3s[idx+1].index : html.length;
const block = html.slice(startIdx, endIdx);
const tableMatch = block.match(/<table[^>]*class=\"[^\"]*wikitable[^\"]*\"[^>]*>([\s\S]*?)<\/table>/i);
console.log('tableMatch?', !!tableMatch);
if (tableMatch) {
  const tableHtml = tableMatch[1];
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  console.log('rows count', rows.length);
  if (rows.length > 0) {
    console.log(rows.slice(0,3).map(r => r[1].replace(/[\r\n]/g,' ').slice(0,200)).join('\n---\n'));
  }
}
