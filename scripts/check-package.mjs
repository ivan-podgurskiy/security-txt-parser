import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cache = mkdtempSync(join(tmpdir(), 'security-txt-parser-pack-'));
let output;

try {
  output = execFileSync(
    'npm',
    ['pack', '--dry-run', '--json', '--ignore-scripts', '--cache', cache],
    { encoding: 'utf8' },
  );
} finally {
  rmSync(cache, { recursive: true, force: true });
}

const [manifest] = JSON.parse(output);
const actual = manifest.files.map(({ path }) => path).sort();
const expected = [
  'CHANGELOG.md',
  'LICENSE',
  'README.md',
  'THIRD_PARTY_NOTICES.md',
  'dist/index.cjs',
  'dist/index.d.cts',
  'dist/index.d.ts',
  'dist/index.js',
  'package.json',
].sort();

if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(
    `Unexpected package contents.\nExpected: ${expected.join(', ')}\nActual: ${actual.join(', ')}`,
  );
}

if (manifest.unpackedSize > 50_000) {
  throw new Error(
    `Package unpacked size exceeds 50,000 bytes: ${manifest.unpackedSize} bytes.`,
  );
}

console.log(
  `Package contents verified (${actual.length} files, ${manifest.unpackedSize} bytes).`,
);
