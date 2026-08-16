import { describe, expect, test } from 'vitest';

import { parse } from '../src/index.js';

function futureTimestamp(months = 1): string {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString();
}

function signed(body: string): string {
  return [
    '-----BEGIN PGP SIGNED MESSAGE-----',
    'Hash: SHA256',
    '',
    ...body.trimEnd().split('\n'),
    '-----BEGIN PGP SIGNATURE-----',
    'placeholder',
    '-----END PGP SIGNATURE-----',
    '',
  ].join('\n');
}

describe('parse', () => {
  test('parses a fully valid signed document with every convenience accessor', () => {
    const expires = futureTimestamp();
    const result = parse(
      signed(`Contact: mailto:security@example.com
Contact: https://example.com/report
Expires: ${expires}
Acknowledgments: https://example.com/thanks
Canonical: https://example.com/.well-known/security.txt
CSAF: https://example.com/.well-known/csaf/provider-metadata.json
Encryption: openpgp4fpr:0123456789ABCDEF
Hiring: https://example.com/jobs
Policy: https://example.com/policy
Preferred-Languages: en, fr-CA`),
    );

    expect(result).toMatchObject({
      valid: true,
      contact: ['mailto:security@example.com', 'https://example.com/report'],
      expires,
      acknowledgments: ['https://example.com/thanks'],
      canonical: ['https://example.com/.well-known/security.txt'],
      csaf: ['https://example.com/.well-known/csaf/provider-metadata.json'],
      encryption: ['openpgp4fpr:0123456789ABCDEF'],
      hiring: ['https://example.com/jobs'],
      policy: ['https://example.com/policy'],
      preferredLanguages: ['en', 'fr-CA'],
      signed: true,
      errors: [],
      recommendations: [],
      notifications: [],
    });
    expect(result.fields[0]).toEqual({
      name: 'Contact',
      value: 'mailto:security@example.com',
      line: 4,
    });
  });

  test.each(['', '# only a comment\n'])(
    'reports both required fields for empty or comment-only input',
    (content) => {
      const result = parse(content);

      expect(result.valid).toBe(false);
      expect(result.fields).toEqual([]);
      expect(result.errors.map(({ code, line }) => ({ code, line }))).toEqual([
        { code: 'no_contact', line: null },
        { code: 'no_expires', line: null },
      ]);
      expect(result.recommendations.map(({ code }) => code)).toEqual([
        'not_signed',
      ]);
    },
  );

  test('reports missing and duplicate required fields in cardinality order', () => {
    const result = parse(
      `Expires: ${futureTimestamp()}\nExpires: ${futureTimestamp(2)}\n`,
    );

    expect(result.errors.map(({ code, line }) => ({ code, line }))).toEqual([
      { code: 'no_contact', line: null },
      { code: 'multi_expires', line: 2 },
    ]);
  });

  test('validates URI, expiry, and language values in source-line order', () => {
    const result = parse(
      [
        'Preferred-Languages: en_US',
        'Policy: http://example.com/policy',
        'Contact: ftp://example.com/report',
        'Expires: 2027-02-29T00:00:00Z',
        '',
      ].join('\n'),
    );

    expect(result.errors.map(({ code, line }) => ({ code, line }))).toEqual([
      { code: 'invalid_lang', line: 1 },
      { code: 'invalid_https_field', line: 2 },
      { code: 'invalid_contact_scheme', line: 3 },
      { code: 'invalid_expires', line: 4 },
    ]);
  });

  test('reports expired timestamps as value errors', () => {
    const result = parse(
      'Contact: https://example.com/report\nExpires: 2000-01-01T00:00:00Z\n',
    );

    expect(result.errors.map(({ code, line }) => ({ code, line }))).toEqual([
      { code: 'expired', line: 2 },
    ]);
  });

  test('returns recommendations in their specified order', () => {
    const result = parse(
      [
        'Contact: mailto:a@example.com',
        'Expires: 2099-01-01T00:00:00Z',
        'CSAF: https://example.com/one.json',
        'CSAF: https://example.com/two.json',
        '',
      ].join('\n'),
    );

    expect(result.valid).toBe(true);
    expect(
      result.recommendations.map(({ code, line }) => ({ code, line })),
    ).toEqual([
      { code: 'long_expiry', line: 2 },
      { code: 'no_encryption', line: null },
      { code: 'not_signed', line: null },
      { code: 'multi_csaf', line: 4 },
    ]);
  });

  test('recommends Canonical only for signed input', () => {
    const result = parse(
      signed(
        `Contact: https://example.com/report\nExpires: ${futureTimestamp()}`,
      ),
    );

    expect(result.recommendations.map(({ code }) => code)).toEqual([
      'no_canonical',
    ]);
  });

  test('keeps unknown fields and reports notifications by line', () => {
    const result = parse(
      [
        'X-First: one',
        'cOnTaCt: https://example.com/report',
        `eXpIrEs: ${futureTimestamp()}`,
        'X-Second: two',
        '',
      ].join('\n'),
    );

    expect(result.valid).toBe(true);
    expect(result.fields.map(({ name }) => name)).toEqual([
      'X-First',
      'cOnTaCt',
      'eXpIrEs',
      'X-Second',
    ]);
    expect(
      result.notifications.map(({ code, line }) => ({ code, line })),
    ).toEqual([
      { code: 'unknown_field', line: 1 },
      { code: 'unknown_field', line: 4 },
    ]);
  });

  test('preserves physical line numbers through a signed envelope', () => {
    const result = parse(
      signed(
        `# body\nContact: not-a-uri\nExpires: ${futureTimestamp()}\nPolicy: relative`,
      ),
    );

    expect(result.errors.map(({ code, line }) => ({ code, line }))).toEqual([
      { code: 'invalid_uri', line: 5 },
      { code: 'invalid_uri', line: 7 },
    ]);
  });

  test('flattens repeated Preferred-Languages while reporting the duplicate', () => {
    const result = parse(
      [
        'Contact: https://example.com/report',
        `Expires: ${futureTimestamp()}`,
        'Preferred-Languages: en, fr-CA',
        'preferred-languages: i-klingon, x-acme',
        '',
      ].join('\n'),
    );

    expect(result.preferredLanguages).toEqual([
      'en',
      'fr-CA',
      'i-klingon',
      'x-acme',
    ]);
    expect(result.errors.map(({ code, line }) => ({ code, line }))).toEqual([
      { code: 'multi_lang', line: 4 },
    ]);
  });

  test('orders physical, value, then cardinality errors', () => {
    const result = parse(
      '\uFEFFPolicy: relative\nPreferred-Languages: en_US\nExpires: invalid\nExpires: invalid-again\n',
    );

    expect(result.errors.map(({ code, line }) => ({ code, line }))).toEqual([
      { code: 'bom_present', line: 1 },
      { code: 'invalid_uri', line: 1 },
      { code: 'invalid_lang', line: 2 },
      { code: 'invalid_expires', line: 3 },
      { code: 'invalid_expires', line: 4 },
      { code: 'no_contact', line: null },
      { code: 'multi_expires', line: 4 },
    ]);
  });

  test('short-circuits oversized input without parsing fields', () => {
    const result = parse(
      `Contact: https://example.com/report\nExpires: ${futureTimestamp()}\n${'x'.repeat(32_768)}`,
    );

    expect(result).toMatchObject({
      valid: false,
      fields: [],
      contact: [],
      expires: null,
      preferredLanguages: [],
      signed: false,
      errors: [{ code: 'file_too_large', line: null }],
      recommendations: [],
      notifications: [],
    });
  });
});
