// Static check that every named import across the JS modules resolves to a real
// export — catches typos that node --check (per-file) and the headless logic
// test (browser-only modules excluded) would miss.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const jsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'js');
const files = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'));

const exportsByFile = {};
const importsByFile = {};

for (const f of files) {
  const src = fs.readFileSync(path.join(jsDir, f), 'utf8');
  const exp = new Set();
  // export const/class/function NAME
  for (const m of src.matchAll(/export\s+(?:const|class|function|let)\s+([A-Za-z0-9_$]+)/g)) exp.add(m[1]);
  exportsByFile[f] = exp;

  const imps = [];
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*'\.\/([^']+)'/g)) {
    const names = m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
    imps.push({ from: m[2], names });
  }
  importsByFile[f] = imps;
}

let failures = 0;
for (const f of files) {
  for (const imp of importsByFile[f]) {
    const target = exportsByFile[imp.from];
    if (!target) {
      console.error(`  FAIL- ${f} imports from missing module ./${imp.from}`);
      failures++;
      continue;
    }
    for (const name of imp.names) {
      if (!target.has(name)) {
        console.error(`  FAIL- ${f}: '${name}' is not exported by ${imp.from}`);
        failures++;
      }
    }
  }
}

if (failures === 0) console.log('  ok  - all imports resolve to exports across ' + files.length + ' modules');
console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILURE(S)');
process.exit(failures === 0 ? 0 : 1);
