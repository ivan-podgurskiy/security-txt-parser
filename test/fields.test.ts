import { describe, expect, test } from 'vitest';

import { collectFields, parseField } from '../src/fields.js';
import type { SecurityTxtField } from '../src/types.js';

describe('parseField', () => {
  test('ignores column-one comments and blank lines', () => {
    expect(parseField({ number: 1, text: '# a comment' })).toBeNull();
    expect(parseField({ number: 2, text: '' })).toBeNull();
  });

  test('treats a leading-space comment as an invalid line', () => {
    expect(parseField({ number: 4, text: ' # not a comment' })).toMatchObject({
      code: 'invalid_line',
      line: 4,
    });
  });

  test('preserves spelling while collecting case-insensitively', () => {
    const field = parseField({
      number: 3,
      text: 'cOnTaCt:  mailto:a@example.com  ',
    });

    expect(field).toEqual({
      name: 'cOnTaCt',
      value: 'mailto:a@example.com',
      line: 3,
    });
    expect(collectFields([field as SecurityTxtField]).contact).toEqual([
      'mailto:a@example.com',
    ]);
  });

  test('collects every registered field in source order', () => {
    const fields = [
      parseField({ number: 1, text: 'Contact: mailto:one@example.com' }),
      parseField({ number: 2, text: 'contact: https://example.com/two' }),
      parseField({ number: 3, text: 'Expires: 2030-01-01T00:00:00Z' }),
      parseField({ number: 4, text: 'Acknowledgments: https://example.com/a' }),
      parseField({ number: 5, text: 'Canonical: https://example.com/c' }),
      parseField({ number: 6, text: 'CSAF: https://example.com/csaf' }),
      parseField({ number: 7, text: 'Encryption: https://example.com/key' }),
      parseField({ number: 8, text: 'Hiring: https://example.com/jobs' }),
      parseField({ number: 9, text: 'Policy: https://example.com/policy' }),
      parseField({ number: 10, text: 'Preferred-Languages: en, fr' }),
    ].filter((field): field is SecurityTxtField =>
      Boolean(field && 'name' in field),
    );

    expect(collectFields(fields)).toEqual({
      contact: ['mailto:one@example.com', 'https://example.com/two'],
      expires: '2030-01-01T00:00:00Z',
      acknowledgments: ['https://example.com/a'],
      canonical: ['https://example.com/c'],
      csaf: ['https://example.com/csaf'],
      encryption: ['https://example.com/key'],
      hiring: ['https://example.com/jobs'],
      policy: ['https://example.com/policy'],
      preferredLanguages: ['en, fr'],
    });
  });

  test('rejects empty values after trimming', () => {
    expect(parseField({ number: 7, text: 'Contact:   ' })).toMatchObject({
      code: 'invalid_line',
      line: 7,
    });
  });

  test('rejects missing colons and invalid field-name characters', () => {
    expect(
      parseField({ number: 8, text: 'Contact mailto:a@example.com' }),
    ).toMatchObject({
      code: 'invalid_line',
      line: 8,
    });
    expect(
      parseField({ number: 9, text: 'Contact Name: mailto:a@example.com' }),
    ).toMatchObject({
      code: 'invalid_line',
      line: 9,
    });
    expect(
      parseField({ number: 10, text: 'Cöntact: mailto:a@example.com' }),
    ).toMatchObject({
      code: 'invalid_line',
      line: 10,
    });
    expect(
      parseField({ number: 11, text: 'Contact\u0001: mailto:a@example.com' }),
    ).toMatchObject({
      code: 'invalid_line',
      line: 11,
    });
  });

  test('leaves inline hashes and unknown valid names as fields', () => {
    expect(
      parseField({ number: 12, text: 'Contact: mailto:a@example.com # note' }),
    ).toEqual({
      name: 'Contact',
      value: 'mailto:a@example.com # note',
      line: 12,
    });
    expect(parseField({ number: 13, text: 'X-Extension: enabled' })).toEqual({
      name: 'X-Extension',
      value: 'enabled',
      line: 13,
    });
  });

  test('accepts a complete registered field at the 2,048-code-point limit', () => {
    const text = `Contact: ${'a'.repeat(2_039)}`;

    expect(Array.from(text)).toHaveLength(2_048);
    expect(parseField({ number: 14, text })).toEqual({
      name: 'Contact',
      value: 'a'.repeat(2_039),
      line: 14,
    });
  });

  test('rejects a recognized field above the 2,048-code-point limit', () => {
    const text = `Contact: ${'😀'.repeat(2_040)}`;

    expect(Array.from(text)).toHaveLength(2_049);
    expect(parseField({ number: 15, text })).toMatchObject({
      code: 'field_too_long',
      line: 15,
    });
  });

  test('ignores comments longer than the field limit', () => {
    expect(
      parseField({ number: 16, text: `#${'😀'.repeat(2_048)}` }),
    ).toBeNull();
  });
});
