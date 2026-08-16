import { describe, expect, test } from 'vitest';

import { validateFieldUri } from '../src/uri.js';

describe('validateFieldUri', () => {
  test.each([
    ['Contact', 'https://example.com/report', null],
    ['Contact', 'mailto:security@example.com', null],
    ['Contact', 'mailto:security%2Btriage@example.com', null],
    ['Contact', 'tel:+1-201-555-0123', null],
    ['Encryption', 'https://example.com/key.asc', null],
    ['Encryption', 'dns:0123456789abcdef.example.com', null],
    ['Encryption', 'openpgp4fpr:0123456789ABCDEF', null],
    ['Acknowledgments', 'https://example.com/thanks', null],
    ['Canonical', 'https://example.com/.well-known/security.txt', null],
    ['CSAF', 'https://example.com/provider-metadata.json', null],
    ['Hiring', 'https://example.com/jobs', null],
    ['Policy', 'https://example.com/policy', null],
  ] as const)('accepts %s value %s', (name, value, code) => {
    expect(validateFieldUri(name, value, 4)?.code ?? null).toBe(code);
  });

  test.each([
    ['Contact', 'security@example.com'],
    ['Contact', '../report'],
    ['Contact', 'mailto:security example.com'],
    ['Contact', 'mailto:security\texample.com'],
    ['Contact', 'mailto:security\u0000@example.com'],
    ['Contact', 'mailto:security%example.com'],
    ['Contact', 'mailto:security%2@example.com'],
    ['Contact', 'mailto:security%GG@example.com'],
    ['Contact', 'mailto:'],
    ['Contact', 'tel:'],
    ['Encryption', 'dns:'],
    ['Encryption', 'openpgp4fpr:'],
    ['Contact', 'https:example.com/report'],
    ['Policy', 'https:///policy'],
    ['Policy', 'https:////example.com/policy'],
    ['Policy', 'https://\\example.com/policy'],
    ['CSAF', 'https://:443/provider-metadata.json'],
  ] as const)(
    'rejects malformed %s value %s before scheme checks',
    (name, value) => {
      expect(validateFieldUri(name, value, 9)).toMatchObject({
        code: 'invalid_uri',
        line: 9,
      });
    },
  );

  test.each([
    ['Contact', 'mailto:a\\b@example.com'],
    ['Contact', 'mailto:a<b@example.com'],
    ['Policy', 'ftp://example.com\\policy'],
  ] as const)(
    'rejects RFC-forbidden raw characters in %s value %s before scheme checks',
    (name, value) => {
      expect(validateFieldUri(name, value, 10)).toMatchObject({
        code: 'invalid_uri',
        line: 10,
      });
    },
  );

  test.each([
    ['Contact', 'mailto:#fragment'],
    ['Contact', 'tel:#fragment'],
    ['Encryption', 'dns:#fragment'],
    ['Encryption', 'openpgp4fpr:#fragment'],
  ] as const)(
    'rejects fragment-only scheme-specific content in %s value %s',
    (name, value) => {
      expect(validateFieldUri(name, value, 11)).toMatchObject({
        code: 'invalid_uri',
        line: 11,
      });
    },
  );

  test.each([
    ['Contact', 'http://example.com', 'invalid_contact_scheme'],
    ['Contact', 'ftp://example.com/report', 'invalid_contact_scheme'],
    ['Acknowledgments', 'http://example.com/thanks', 'invalid_https_field'],
    ['Canonical', 'ftp://example.com/security.txt', 'invalid_https_field'],
    [
      'CSAF',
      'http://example.com/provider-metadata.json',
      'invalid_https_field',
    ],
    ['Hiring', 'ftp://example.com/jobs', 'invalid_https_field'],
    ['Policy', 'http://example.com/policy', 'invalid_https_field'],
    ['Encryption', 'ftp://example.com/key.asc', 'invalid_https_field'],
  ] as const)(
    'reports the field-level scheme error for %s value %s',
    (name, value, code) => {
      expect(validateFieldUri(name, value, 12)).toMatchObject({
        code,
        line: 12,
      });
    },
  );

  test('compares field names and schemes ASCII case-insensitively', () => {
    expect(
      validateFieldUri('cOnTaCt', 'MaIlTo:security@example.com', 2),
    ).toBeNull();
    expect(
      validateFieldUri('pOlIcY', 'HTTPS://example.com/policy', 3),
    ).toBeNull();
    expect(validateFieldUri('eNcRyPtIoN', 'DnS:key.example.com', 4)).toBeNull();
  });

  test.each(['Expires', 'Preferred-Languages', 'X-Extension'])(
    'does not validate non-URI field %s',
    (name) => {
      expect(validateFieldUri(name, 'not a URI', 5)).toBeNull();
    },
  );
});
