import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const expected =
  '907a0a4735937fe54b37e1b8e27d3901708c11b89fcffc20b04c4d0c7f2fce9d';
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
