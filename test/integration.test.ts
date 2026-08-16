import { describe, expect, test } from 'vitest';

import { parse, serialize } from '../src/index.js';

describe('README examples', () => {
  test('parses the Quick Start security.txt example through the public API', () => {
    const expires = new Date();
    expires.setUTCFullYear(expires.getUTCFullYear() + 2);
    const expiresAt = expires.toISOString().replace('.000Z', 'Z');

    const result = parse(`Contact: https://example.com/report
Expires: ${expiresAt}
Policy: https://example.com/security-policy
Preferred-Languages: en, tr
`);

    expect({
      valid: result.valid,
      contact: result.contact,
      expires: result.expires,
      policy: result.policy,
      preferredLanguages: result.preferredLanguages,
      errors: result.errors,
      recommendations: result.recommendations.map(({ code }) => code),
    }).toEqual({
      valid: true,
      contact: ['https://example.com/report'],
      expires: expiresAt,
      policy: ['https://example.com/security-policy'],
      preferredLanguages: ['en', 'tr'],
      errors: [],
      recommendations: ['long_expiry', 'not_signed'],
    });
  });

  test('serializes the Serialize security.txt example through the public API', () => {
    const expires = new Date();
    expires.setUTCFullYear(expires.getUTCFullYear() + 2);
    const expiresAt = expires.toISOString().replace('.000Z', 'Z');

    const content = serialize({
      comments: ['Security contact for example.com'],
      contact: ['mailto:security@example.com', 'https://example.com/report'],
      expires: expiresAt,
      canonical: 'https://example.com/.well-known/security.txt',
      csaf: 'https://example.com/.well-known/csaf/provider-metadata.json',
      encryption: 'openpgp4fpr:0123456789ABCDEF',
      policy: 'https://example.com/security-policy',
      preferredLanguages: ['en', 'tr'],
    });

    expect(content).toBe(`# Security contact for example.com
Contact: mailto:security@example.com
Contact: https://example.com/report
Expires: ${expiresAt}
Canonical: https://example.com/.well-known/security.txt
CSAF: https://example.com/.well-known/csaf/provider-metadata.json
Encryption: openpgp4fpr:0123456789ABCDEF
Policy: https://example.com/security-policy
Preferred-Languages: en, tr
`);
  });
});
