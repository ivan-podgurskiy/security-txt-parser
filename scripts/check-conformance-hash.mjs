import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const expected =
  '8e627e34c02ed596d24165a33f6dce498c386b745cee2f23d4084e1212b59e8c';
const fixture = new URL('../test/fixtures/conformance.json', import.meta.url);
const actual = createHash('sha256').update(readFileSync(fixture)).digest('hex');

if (actual !== expected) {
  console.error(
    `Conformance fixture SHA-256 mismatch:\nexpected ${expected}\nactual   ${actual}`,
  );
  process.exitCode = 1;
} else {
  console.log(`Conformance fixture SHA-256: ${actual}`);
}
