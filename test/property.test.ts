import { describe, expect, test } from 'vitest';

import { parse, serialize } from '../src/index.js';
import type { SerializeOptions } from '../src/index.js';

function xorshift32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state;
  };
}

const next = xorshift32(0x9116c0de);

function choose<T>(values: readonly T[]): T {
  return values[next() % values.length] as T;
}

function randomArbitraryString(): string {
  const alphabet = [
    '',
    'a',
    'Z',
    '0',
    ':',
    '#',
    ' ',
    '\t',
    '\r',
    '\n',
    '\0',
    '\uFEFF',
    '/',
    '%',
    '-',
    ',',
    'é',
    '😀',
  ] as const;
  const length = next() % 257;
  let value = '';

  for (let index = 0; index < length; index += 1) {
    value += choose(alphabet);
  }

  return value;
}

function randomCase(value: string): string {
  return Array.from(value, (character) =>
    /[A-Za-z]/.test(character) && (next() & 1) === 1
      ? character.toUpperCase()
      : character.toLowerCase(),
  ).join('');
}

function randomOptions(index: number, expires: string): SerializeOptions {
  const contactSets = [
    [`https://example.com/report/${index}`],
    [
      `mailto:security${index}@example.com`,
      `tel:+1-201-555-${String(index).padStart(4, '0')}`,
    ],
    [
      `tel:+44-20-7946-${String(index).padStart(4, '0')}`,
      `https://example.com/report/${index}`,
    ],
  ] as const;
  const contact = [...choose(contactSets)];
  const options: SerializeOptions = { contact, expires };

  if ((next() & 1) === 1) {
    options.comments = [`Generated case ${index}`];
  }

  if ((next() & 1) === 1) {
    options.acknowledgments = `https://example.com/thanks/${index}`;
  }

  if ((next() & 1) === 1) {
    options.canonical = `https://example.com/.well-known/security-${index}.txt`;
  }

  if ((next() & 1) === 1) {
    options.csaf = `https://example.com/csaf/${index}/provider-metadata.json`;
  }

  if (
    contact.some((value) => value.startsWith('mailto:')) ||
    (next() & 1) === 1
  ) {
    options.encryption = choose([
      `https://example.com/key/${index}.asc`,
      `dns:key-${index}.example.com`,
      `openpgp4fpr:${index.toString(16).padStart(16, '0')}`,
    ]);
  }

  if ((next() & 1) === 1) {
    options.hiring = `https://example.com/jobs/${index}`;
  }

  if ((next() & 1) === 1) {
    options.policy = [
      `https://example.com/policy/${index}/first`,
      `https://example.com/policy/${index}/second`,
    ];
  }

  if ((next() & 1) === 1) {
    options.preferredLanguages = choose([
      ['en'],
      ['en-US', 'zh-Hant'],
      ['i-klingon', 'x-acme'],
      ['de-CH-1901', 'sl-rozaj-biske'],
    ]);
  }

  return options;
}

function randomizeRegisteredFieldCase(content: string): string {
  return content.replace(
    /^(Contact|Expires|Acknowledgments|Canonical|CSAF|Encryption|Hiring|Policy|Preferred-Languages):/gm,
    (match) => `${randomCase(match.slice(0, -1))}:`,
  );
}

describe('deterministic properties', () => {
  test('1,000 bounded arbitrary strings never crash the parser', () => {
    for (let iteration = 0; iteration < 1_000; iteration += 1) {
      expect(() => parse(randomArbitraryString())).not.toThrow();
    }
  });

  test('500 valid option objects round trip across casing and line endings', () => {
    const expires = new Date(Date.now() + 30 * 86_400_000).toISOString();

    for (let iteration = 0; iteration < 500; iteration += 1) {
      const options = randomOptions(iteration, expires);
      const contacts =
        typeof options.contact === 'string'
          ? [options.contact]
          : options.contact;
      const output = serialize(options);
      const parsed = parse(output);

      expect(parsed.errors, `iteration ${iteration}`).toEqual([]);
      expect(parsed.valid, `iteration ${iteration}`).toBe(true);
      expect(parsed.contact, `iteration ${iteration}`).toEqual(contacts);

      const caseRandomized = parse(randomizeRegisteredFieldCase(output));
      expect(caseRandomized.contact, `iteration ${iteration}`).toEqual(
        contacts,
      );
      expect(caseRandomized.expires, `iteration ${iteration}`).toBe(expires);
      expect(caseRandomized.errors, `iteration ${iteration}`).toEqual([]);

      const crlf = parse(output.replaceAll('\n', '\r\n'));
      expect(crlf, `iteration ${iteration}`).toEqual(parsed);
    }
  });
});
