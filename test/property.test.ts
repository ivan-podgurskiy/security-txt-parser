import { describe, expect, test } from 'vitest';

import { parse, serialize } from '../src/index.js';
import type {
  SecurityTxtDiagnostic,
  SecurityTxtField,
  SerializeOptions,
} from '../src/index.js';

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
  const options: SerializeOptions = {
    contact:
      contact.length === 1 && (next() & 1) === 1
        ? (contact[0] as string)
        : contact,
    expires: (next() & 1) === 1 ? expires : new Date(expires),
  };

  if ((next() & 1) === 1) {
    options.comments = [
      `Generated case ${index}`,
      `Seeded sequence ${index.toString(16)}`,
    ];
  }

  if ((next() & 1) === 1) {
    options.acknowledgments = choose([
      `https://example.com/thanks/${index}`,
      [
        `https://example.com/thanks/${index}/first`,
        `https://example.com/thanks/${index}/second`,
      ],
    ]);
  }

  if ((next() & 1) === 1) {
    options.canonical = `https://example.com/.well-known/security-${index}.txt`;
  }

  if ((next() & 1) === 1) {
    options.csaf = choose([
      `https://example.com/csaf/${index}/provider-metadata.json`,
      [
        `https://example.com/csaf/${index}/one.json`,
        `https://example.com/csaf/${index}/two.json`,
      ],
    ]);
  }

  if ((next() & 1) === 1) {
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
    const languages = choose([
      ['en'],
      ['en-US', 'zh-Hant'],
      ['i-klingon', 'x-acme'],
      ['de-CH-1901', 'sl-rozaj-biske'],
    ]);
    options.preferredLanguages =
      languages.length === 1 && (next() & 1) === 1
        ? (languages[0] as string)
        : languages;
  }

  return options;
}

function strings(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }

  return typeof value === 'string' ? [value] : value;
}

function serializedExpiry(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString().replace(/\.000Z$/, 'Z')
    : value;
}

function expectedFields(options: SerializeOptions): SecurityTxtField[] {
  const fields: SecurityTxtField[] = [];
  let line = (options.comments?.length ?? 0) + 1;
  const add = (name: string, values: readonly string[]): void => {
    for (const value of values) {
      fields.push({ name, value, line });
      line += 1;
    }
  };

  add('Contact', strings(options.contact));
  add('Expires', [serializedExpiry(options.expires)]);
  add('Acknowledgments', strings(options.acknowledgments));
  add('Canonical', strings(options.canonical));
  add('CSAF', strings(options.csaf));
  add('Encryption', strings(options.encryption));
  add('Hiring', strings(options.hiring));
  add('Policy', strings(options.policy));

  const languages = strings(options.preferredLanguages);
  if (languages.length > 0) {
    add('Preferred-Languages', [languages.join(', ')]);
  }

  return fields;
}

function diagnosticPairs(
  diagnostics: SecurityTxtDiagnostic[],
): Pick<SecurityTxtDiagnostic, 'code' | 'line'>[] {
  return diagnostics.map(({ code, line }) => ({ code, line }));
}

function expectedRecommendations(
  options: SerializeOptions,
  fields: readonly SecurityTxtField[],
): Pick<SecurityTxtDiagnostic, 'code' | 'line'>[] {
  const recommendations: Pick<SecurityTxtDiagnostic, 'code' | 'line'>[] = [];

  if (
    strings(options.contact).some((value) => /^mailto:/i.test(value)) &&
    strings(options.encryption).length === 0
  ) {
    recommendations.push({ code: 'no_encryption', line: null });
  }

  recommendations.push({ code: 'not_signed', line: null });

  if (strings(options.csaf).length > 1) {
    const csafFields = fields.filter((field) => field.name === 'CSAF');
    recommendations.push({
      code: 'multi_csaf',
      line: csafFields[1]?.line ?? null,
    });
  }

  return recommendations;
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
    let dateExpiries = 0;
    let stringExpiries = 0;

    for (let iteration = 0; iteration < 500; iteration += 1) {
      const options = randomOptions(iteration, expires);
      if (options.expires instanceof Date) {
        dateExpiries += 1;
      } else {
        stringExpiries += 1;
      }
      const output = serialize(options);
      const parsed = parse(output);
      const fields = expectedFields(options);
      const expectedState = {
        contact: strings(options.contact),
        expires: serializedExpiry(options.expires),
        acknowledgments: strings(options.acknowledgments),
        canonical: strings(options.canonical),
        csaf: strings(options.csaf),
        encryption: strings(options.encryption),
        hiring: strings(options.hiring),
        policy: strings(options.policy),
        preferredLanguages: strings(options.preferredLanguages),
      };
      const comments = options.comments ?? [];

      expect(parsed.errors, `iteration ${iteration}`).toEqual([]);
      expect(parsed.valid, `iteration ${iteration}`).toBe(true);
      expect(parsed, `iteration ${iteration}`).toMatchObject({
        ...expectedState,
        fields,
        signed: false,
        notifications: [],
      });
      expect(
        diagnosticPairs(parsed.recommendations),
        `iteration ${iteration}`,
      ).toEqual(expectedRecommendations(options, fields));
      expect(
        output.split('\n').slice(0, comments.length),
        `iteration ${iteration}`,
      ).toEqual(comments.map((comment) => `# ${comment}`));

      const caseRandomized = parse(randomizeRegisteredFieldCase(output));
      expect(caseRandomized, `iteration ${iteration}`).toMatchObject({
        ...expectedState,
        valid: true,
        signed: false,
        errors: [],
        notifications: [],
      });
      expect(
        caseRandomized.fields.map(({ name, value, line }) => ({
          name: name.toLowerCase(),
          value,
          line,
        })),
        `iteration ${iteration}`,
      ).toEqual(
        fields.map(({ name, value, line }) => ({
          name: name.toLowerCase(),
          value,
          line,
        })),
      );
      expect(
        diagnosticPairs(caseRandomized.recommendations),
        `iteration ${iteration}`,
      ).toEqual(expectedRecommendations(options, fields));

      const crlf = parse(output.replaceAll('\n', '\r\n'));
      expect(crlf, `iteration ${iteration}`).toEqual(parsed);
    }

    expect(dateExpiries).toBeGreaterThan(0);
    expect(stringExpiries).toBeGreaterThan(0);
  });
});
