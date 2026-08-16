import { describe, expect, test } from 'vitest';

import { classifyExpiry, parseRfc3339 } from '../src/expires.js';

describe('parseRfc3339', () => {
  test.each([
    ['2028-02-29T12:34:56Z', '2028-02-29T12:34:56.000Z'],
    ['2028-02-29t12:34:56z', '2028-02-29T12:34:56.000Z'],
    ['2028-02-29t14:34:56+02:00', '2028-02-29T12:34:56.000Z'],
    ['2028-02-29T10:04:56-02:30', '2028-02-29T12:34:56.000Z'],
    ['2028-02-29T12:34:56.123456789Z', '2028-02-29T12:34:56.123Z'],
    ['0000-01-01T00:00:00Z', '0000-01-01T00:00:00.000Z'],
  ])('parses valid RFC 3339 value %s', (value, expected) => {
    expect(parseRfc3339(value)?.toISOString()).toBe(expected);
  });

  test.each([
    '2027-02-29T12:00:00Z',
    '2028-02-30T12:00:00Z',
    '2028-00-01T12:00:00Z',
    '2028-13-01T12:00:00Z',
    '2028-01-01T24:00:00Z',
    '2028-01-01T12:60:00Z',
    '2028-01-01T12:00:60Z',
    '2028-01-01T12:00:00+24:00',
    '2028-01-01T12:00:00+00:60',
    '2028-01-01T12:00:00Z trailing',
    '2028-01-01 12:00:00Z',
    '2028-01-01T12:00:00',
    '2028-01-01T12:00:00.Z',
  ])('rejects malformed or impossible value %s', (value) => {
    expect(parseRfc3339(value)).toBeNull();
  });
});

describe('classifyExpiry', () => {
  const now = new Date('2028-01-15T12:00:00.000Z');

  test('classifies invalid values', () => {
    expect(classifyExpiry('2028-02-30T12:00:00Z', now)).toBe('invalid');
  });

  test('treats the exact current instant as current', () => {
    expect(classifyExpiry('2028-01-15T12:00:00Z', now)).toBe('current');
  });

  test('treats an instant one millisecond in the past as expired', () => {
    expect(classifyExpiry('2028-01-15T11:59:59.999Z', now)).toBe('expired');
  });

  test('uses a calendar year for the recommendation boundary', () => {
    const leapDay = new Date('2028-02-29T12:00:00Z');

    expect(classifyExpiry('2029-02-28T12:00:00Z', leapDay)).toBe('current');
    expect(classifyExpiry('2029-02-28T12:00:00.001Z', leapDay)).toBe('long');
  });

  test('keeps the same UTC date and time for a normal one-year boundary', () => {
    expect(classifyExpiry('2029-01-15T12:00:00Z', now)).toBe('current');
    expect(classifyExpiry('2029-01-15T12:00:00.001Z', now)).toBe('long');
  });

  test('compares offset-equivalent timestamps as the same instant', () => {
    expect(classifyExpiry('2028-01-15T14:00:00+02:00', now)).toBe('current');
    expect(classifyExpiry('2028-01-15T13:59:59.999+02:00', now)).toBe(
      'expired',
    );
  });
});
