import { describe, expect, test } from 'vitest';

import { parse, serialize } from '../src/index.js';
import type { SerializeOptions } from '../src/index.js';

const FUTURE = '2099-01-01T00:00:00Z';

function required(overrides: Partial<SerializeOptions> = {}): SerializeOptions {
  return {
    contact: 'https://example.com/report',
    expires: FUTURE,
    ...overrides,
  };
}

describe('serialize', () => {
  test('serializes every field in canonical order with exactly one trailing LF', () => {
    const output = serialize({
      comments: ['Security contact', 'Managed by the security team'],
      contact: ['mailto:a@example.com', 'https://example.com/security'],
      expires: new Date('2099-01-01T00:00:00Z'),
      acknowledgments: [
        'https://example.com/thanks/first',
        'https://example.com/thanks/second',
      ],
      canonical: 'https://example.com/.well-known/security.txt',
      csaf: 'https://example.com/.well-known/csaf/provider-metadata.json',
      encryption: 'openpgp4fpr:0123456789ABCDEF',
      hiring: 'https://example.com/jobs',
      policy: 'https://example.com/policy',
      preferredLanguages: ['en', 'tr'],
    });

    expect(output).toBe(
      '# Security contact\n' +
        '# Managed by the security team\n' +
        'Contact: mailto:a@example.com\n' +
        'Contact: https://example.com/security\n' +
        'Expires: 2099-01-01T00:00:00Z\n' +
        'Acknowledgments: https://example.com/thanks/first\n' +
        'Acknowledgments: https://example.com/thanks/second\n' +
        'Canonical: https://example.com/.well-known/security.txt\n' +
        'CSAF: https://example.com/.well-known/csaf/provider-metadata.json\n' +
        'Encryption: openpgp4fpr:0123456789ABCDEF\n' +
        'Hiring: https://example.com/jobs\n' +
        'Policy: https://example.com/policy\n' +
        'Preferred-Languages: en, tr\n',
    );
    expect(output.endsWith('\n')).toBe(true);
    expect(output.endsWith('\n\n')).toBe(false);
  });

  test('normalizes scalar and array fields without reordering values', () => {
    expect(
      serialize({
        contact: ['tel:+1-201-555-0123', 'mailto:security@example.com'],
        expires: FUTURE,
        policy: ['https://example.com/first', 'https://example.com/second'],
        preferredLanguages: 'en-US',
      }),
    ).toBe(
      'Contact: tel:+1-201-555-0123\n' +
        'Contact: mailto:security@example.com\n' +
        `Expires: ${FUTURE}\n` +
        'Policy: https://example.com/first\n' +
        'Policy: https://example.com/second\n' +
        'Preferred-Languages: en-US\n',
    );
  });

  test('formats Date values in UTC, removing only zero milliseconds', () => {
    expect(
      serialize(
        required({ expires: new Date('2099-01-01T02:30:00.000+02:30') }),
      ),
    ).toContain('Expires: 2099-01-01T00:00:00Z\n');
    expect(
      serialize(required({ expires: new Date('2099-01-01T00:00:00.123Z') })),
    ).toContain('Expires: 2099-01-01T00:00:00.123Z\n');
  });

  test('preserves a valid string expiry representation', () => {
    expect(
      serialize(required({ expires: '2099-01-01t02:30:00.125+02:30' })),
    ).toContain('Expires: 2099-01-01t02:30:00.125+02:30\n');
  });

  test.each([
    ['contact', { contact: [] }],
    ['acknowledgments', { acknowledgments: [] }],
    ['canonical', { canonical: [] }],
    ['csaf', { csaf: [] }],
    ['encryption', { encryption: [] }],
    ['hiring', { hiring: [] }],
    ['policy', { policy: [] }],
    ['preferredLanguages', { preferredLanguages: [] }],
    ['comments', { comments: [] }],
  ])('rejects an empty %s array', (_name, overrides) => {
    expect(() =>
      serialize(required(overrides as Partial<SerializeOptions>)),
    ).toThrow(TypeError);
  });

  test('rejects missing required Contact or Expires', () => {
    expect(() => serialize({ expires: FUTURE } as SerializeOptions)).toThrow(
      TypeError,
    );
    expect(() =>
      serialize({ contact: 'https://example.com/report' } as SerializeOptions),
    ).toThrow(TypeError);
  });

  test.each([
    ['comments', { comments: ['safe\nContact: tel:injected'] }],
    ['contact', { contact: 'mailto:a@example.com\rExpires: injected' }],
    ['expires', { expires: `${FUTURE}\nPolicy: injected` }],
    ['acknowledgments', { acknowledgments: 'https://example.com/a\r' }],
    ['canonical', { canonical: 'https://example.com/a\n' }],
    ['csaf', { csaf: 'https://example.com/a\r' }],
    ['encryption', { encryption: 'dns:key.example.com\n' }],
    ['hiring', { hiring: 'https://example.com/jobs\r' }],
    ['policy', { policy: 'https://example.com/policy\n' }],
    ['preferredLanguages', { preferredLanguages: 'en\r' }],
  ])('rejects CR or LF injection in %s', (_name, overrides) => {
    expect(() =>
      serialize(required(overrides as Partial<SerializeOptions>)),
    ).toThrow(TypeError);
  });

  test.each([
    ['contact URI', { contact: 'ftp://example.com/report' }],
    ['contact syntax', { contact: 'mailto:a\\b@example.com' }],
    ['acknowledgments URI', { acknowledgments: 'http://example.com/thanks' }],
    ['canonical URI', { canonical: 'ftp://example.com/security.txt' }],
    ['CSAF URI', { csaf: 'http://example.com/provider.json' }],
    ['encryption URI', { encryption: 'ftp://example.com/key' }],
    ['hiring URI', { hiring: '../jobs' }],
    ['policy URI', { policy: 'http://example.com/policy' }],
    ['language tag', { preferredLanguages: 'en_US' }],
    ['language list as one tag', { preferredLanguages: 'en, fr' }],
    ['timestamp syntax', { expires: '2099-02-30T00:00:00Z' }],
    ['expired timestamp', { expires: '2000-01-01T00:00:00Z' }],
    ['invalid Date', { expires: new Date(Number.NaN) }],
  ] as const)('rejects invalid %s with TypeError', (_name, overrides) => {
    expect(() => serialize(required(overrides))).toThrow(TypeError);
  });

  test('rejects runtime option types that cannot serialize valid fields', () => {
    expect(() =>
      serialize(required({ expires: [FUTURE] as unknown as string })),
    ).toThrow(TypeError);
    expect(() =>
      serialize(required({ contact: [42] as unknown as string[] })),
    ).toThrow(TypeError);
    expect(() =>
      serialize(required({ comments: 'note' as unknown as string[] })),
    ).toThrow(TypeError);
  });

  test('rejects output that exceeds parser resource limits', () => {
    expect(() =>
      serialize(
        required({ policy: `https://example.com/${'x'.repeat(2_100)}` }),
      ),
    ).toThrow(TypeError);
    expect(() =>
      serialize(required({ comments: ['x'.repeat(32_768)] })),
    ).toThrow(TypeError);
    expect(() =>
      serialize(required({ comments: Array.from({ length: 999 }, () => 'x') })),
    ).toThrow(TypeError);
  });

  test('always produces a document accepted by parse for valid options', () => {
    const output = serialize({
      contact: ['mailto:security@example.com', 'https://example.com/report'],
      expires: new Date('2099-01-01T00:00:00.456Z'),
      canonical: 'https://example.com/.well-known/security.txt',
      csaf: 'https://example.com/.well-known/csaf/provider-metadata.json',
      encryption: 'dns:key.example.com',
      preferredLanguages: ['en', 'i-klingon', 'x-acme'],
    });
    const result = parse(output);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.contact).toEqual([
      'mailto:security@example.com',
      'https://example.com/report',
    ]);
    expect(result.preferredLanguages).toEqual(['en', 'i-klingon', 'x-acme']);
  });
});
