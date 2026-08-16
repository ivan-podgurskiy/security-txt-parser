import { describe, expect, test } from 'vitest';

import { extractCleartext } from '../src/pgp.js';

describe('extractCleartext', () => {
  test('extracts and dash-unescapes cleartext with original line numbers', () => {
    const result = extractCleartext([
      { number: 1, text: '-----BEGIN PGP SIGNED MESSAGE-----' },
      { number: 2, text: 'Hash: SHA256' },
      { number: 3, text: '' },
      { number: 4, text: '- - Contact: mailto:a@example.com' },
      { number: 5, text: '-----BEGIN PGP SIGNATURE-----' },
      { number: 6, text: 'abc' },
      { number: 7, text: '-----END PGP SIGNATURE-----' },
    ]);

    expect(result).toEqual({
      signed: true,
      lines: [{ number: 4, text: '- Contact: mailto:a@example.com' }],
    });
  });

  test('accepts multiple Hash headers and preserves From cleartext', () => {
    const result = extractCleartext([
      { number: 10, text: '-----BEGIN PGP SIGNED MESSAGE-----' },
      { number: 11, text: 'Hash: SHA256' },
      { number: 12, text: 'Hash: SHA512' },
      { number: 13, text: '' },
      { number: 14, text: '- From sender@example.com' },
      { number: 15, text: 'Policy: https://example.com/security' },
      { number: 16, text: '-----BEGIN PGP SIGNATURE-----' },
      { number: 17, text: 'ignored signature bytes' },
      { number: 18, text: '-----END PGP SIGNATURE-----' },
    ]);

    expect(result).toEqual({
      signed: true,
      lines: [
        { number: 14, text: 'From sender@example.com' },
        { number: 15, text: 'Policy: https://example.com/security' },
      ],
    });
  });

  test.each([
    {
      name: 'has no blank separator after Hash headers',
      lines: [
        { number: 1, text: '-----BEGIN PGP SIGNED MESSAGE-----' },
        { number: 2, text: 'Hash: SHA256' },
        { number: 3, text: 'Contact: mailto:a@example.com' },
        { number: 4, text: '-----BEGIN PGP SIGNATURE-----' },
        { number: 5, text: '-----END PGP SIGNATURE-----' },
      ],
    },
    {
      name: 'has no signature begin marker',
      lines: [
        { number: 1, text: '-----BEGIN PGP SIGNED MESSAGE-----' },
        { number: 2, text: 'Hash: SHA256' },
        { number: 3, text: '' },
        { number: 4, text: 'Contact: mailto:a@example.com' },
      ],
    },
    {
      name: 'has no signature end marker',
      lines: [
        { number: 1, text: '-----BEGIN PGP SIGNED MESSAGE-----' },
        { number: 2, text: 'Hash: SHA256' },
        { number: 3, text: '' },
        { number: 4, text: 'Contact: mailto:a@example.com' },
        { number: 5, text: '-----BEGIN PGP SIGNATURE-----' },
      ],
    },
  ])('returns unsigned input unchanged when $name', ({ lines }) => {
    const result = extractCleartext(lines);

    expect(result).toEqual({ signed: false, lines });
    expect(result.lines).toBe(lines);
  });

  test('leaves a marker-like unsigned document untouched', () => {
    const lines = [
      { number: 1, text: 'Contact: mailto:a@example.com' },
      { number: 2, text: '-----BEGIN PGP SIGNED MESSAGE-----' },
      { number: 3, text: 'Hash: SHA256' },
      { number: 4, text: '' },
      { number: 5, text: '-----BEGIN PGP SIGNATURE-----' },
      { number: 6, text: 'signature' },
      { number: 7, text: '-----END PGP SIGNATURE-----' },
    ];

    const result = extractCleartext(lines);

    expect(result).toEqual({ signed: false, lines });
    expect(result.lines).toBe(lines);
  });
});
