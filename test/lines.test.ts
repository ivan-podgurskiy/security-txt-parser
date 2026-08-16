import { describe, expect, test } from 'vitest';

import { scanLines } from '../src/lines.js';

describe('scanLines', () => {
  test('returns no physical lines for an empty document', () => {
    const scan = scanLines('');

    expect(scan).toMatchObject({ rejected: false, lines: [], errors: [] });
  });

  test('keeps LF-delimited text on one-based physical lines', () => {
    const scan = scanLines(
      'Contact: mailto:a@example.com\nExpires: 2030-01-01T00:00:00Z\n',
    );

    expect(scan).toMatchObject({
      rejected: false,
      errors: [],
      lines: [
        { number: 1, text: 'Contact: mailto:a@example.com' },
        { number: 2, text: 'Expires: 2030-01-01T00:00:00Z' },
      ],
    });
  });

  test('removes the carriage return from CRLF-delimited text', () => {
    const scan = scanLines('Contact: mailto:a@example.com\r\n');

    expect(scan.lines).toEqual([
      { number: 1, text: 'Contact: mailto:a@example.com' },
    ]);
    expect(scan.errors).toEqual([]);
  });

  test('accepts mixed LF and CRLF separators', () => {
    const scan = scanLines(
      'Contact: mailto:a@example.com\nExpires: 2030-01-01T00:00:00Z\r\n',
    );

    expect(scan.errors).toEqual([]);
    expect(scan.lines).toEqual([
      { number: 1, text: 'Contact: mailto:a@example.com' },
      { number: 2, text: 'Expires: 2030-01-01T00:00:00Z' },
    ]);
  });

  test('reports a bare carriage return on its physical line', () => {
    const scan = scanLines(
      'Contact: mailto:a@example.com\rExpires: 2030-01-01T00:00:00Z\n',
    );

    expect(scan.errors).toContainEqual(
      expect.objectContaining({ code: 'invalid_line_ending', line: 1 }),
    );
    expect(scan.lines[0]).toEqual({
      number: 1,
      text: 'Contact: mailto:a@example.com\rExpires: 2030-01-01T00:00:00Z',
    });
  });

  test('reports a non-empty final segment that lacks LF', () => {
    const scan = scanLines('Contact: mailto:a@example.com');

    expect(scan.lines).toEqual([
      { number: 1, text: 'Contact: mailto:a@example.com' },
    ]);
    expect(scan.errors).toContainEqual(
      expect.objectContaining({ code: 'invalid_line_ending', line: 1 }),
    );
  });

  test('preserves a trailing bare carriage return that is not before LF', () => {
    const scan = scanLines('Contact: mailto:a@example.com\r');

    expect(scan.lines).toEqual([
      { number: 1, text: 'Contact: mailto:a@example.com\r' },
    ]);
    expect(scan.errors).toContainEqual(
      expect.objectContaining({ code: 'invalid_line_ending', line: 1 }),
    );
  });

  test('removes one leading BOM after reporting it on line one', () => {
    const scan = scanLines('\uFEFFContact: mailto:a@example.com\n');

    expect(scan.lines).toEqual([
      { number: 1, text: 'Contact: mailto:a@example.com' },
    ]);
    expect(scan.errors).toContainEqual(
      expect.objectContaining({ code: 'bom_present', line: 1 }),
    );
  });

  test('accepts input exactly at the UTF-8 byte limit', () => {
    const scan = scanLines(`${'a'.repeat(32_767)}\n`);

    expect(scan.rejected).toBe(false);
    expect(scan.errors).toEqual([]);
    expect(scan.lines).toHaveLength(1);
    expect(scan.lines[0]?.text).toHaveLength(32_767);
  });

  test('rejects input above the byte limit without parsing lines', () => {
    const scan = scanLines(`${'é'.repeat(16_384)}\n`);
    expect(scan.rejected).toBe(true);
    expect(scan.lines).toEqual([]);
    expect(scan.errors.map(({ code }) => code)).toEqual(['file_too_large']);
  });

  test('accepts exactly one thousand physical lines', () => {
    const scan = scanLines('x\n'.repeat(1_000));

    expect(scan.errors).toEqual([]);
    expect(scan.lines).toHaveLength(1_000);
    expect(scan.lines.at(-1)).toEqual({ number: 1_000, text: 'x' });
  });

  test('reports the document when it exceeds one thousand physical lines', () => {
    const scan = scanLines('x\n'.repeat(1_001));

    expect(scan.rejected).toBe(false);
    expect(scan.lines).toHaveLength(1_001);
    expect(scan.errors).toContainEqual(
      expect.objectContaining({ code: 'too_many_lines', line: null }),
    );
  });
});
