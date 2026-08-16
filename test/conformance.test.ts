import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

import { parse, serialize } from '../src/index.js';
import type {
  SecurityTxtDiagnostic,
  SecurityTxtField,
  SecurityTxtResult,
  SerializeOptions,
} from '../src/index.js';

interface ExpectedResult {
  valid?: boolean;
  fields?: SecurityTxtField[];
  contact?: string[];
  expires?: string | null;
  acknowledgments?: string[];
  canonical?: string[];
  csaf?: string[];
  encryption?: string[];
  hiring?: string[];
  policy?: string[];
  preferredLanguages?: string[];
  signed?: boolean;
  errors?: Pick<SecurityTxtDiagnostic, 'code' | 'line'>[];
  recommendations?: Pick<SecurityTxtDiagnostic, 'code' | 'line'>[];
  notifications?: Pick<SecurityTxtDiagnostic, 'code' | 'line'>[];
}

interface TextPart {
  text?: string;
  repeat?: string;
  count?: number;
}

type TextTemplate = string | { parts: TextPart[] };

interface ParseCase {
  name: string;
  input?: TextTemplate;
  inputFile?: string;
  expected: ExpectedResult;
  expiresAt?: string;
  expiryPhases?: {
    beyondOneYear: ExpectedResult;
    withinOneYear: ExpectedResult;
    afterExpiry: ExpectedResult;
  };
}

interface SerializeCase {
  name: string;
  options: unknown;
  expected?: string;
  throws?: boolean;
}

interface ConformanceFixture {
  version: number;
  parse: ParseCase[];
  serialize: SerializeCase[];
}

const fixtureUrl = new URL('./fixtures/conformance.json', import.meta.url);
const fixture = JSON.parse(
  readFileSync(fixtureUrl, 'utf8'),
) as ConformanceFixture;

if (fixture.version !== 1) {
  throw new Error(`Unsupported conformance version: ${fixture.version}`);
}

const capturedNow = new Date();
const symbols = new Map([
  ['{{past}}', new Date(capturedNow.getTime() - 86_400_000).toISOString()],
  [
    '{{within_one_year}}',
    new Date(capturedNow.getTime() + 30 * 86_400_000).toISOString(),
  ],
  [
    '{{beyond_one_year}}',
    new Date(
      Date.UTC(
        capturedNow.getUTCFullYear() + 2,
        capturedNow.getUTCMonth(),
        capturedNow.getUTCDate(),
        capturedNow.getUTCHours(),
        capturedNow.getUTCMinutes(),
        capturedNow.getUTCSeconds(),
        capturedNow.getUTCMilliseconds(),
      ),
    ).toISOString(),
  ],
  [
    '{{beyond_one_year_lower_z}}',
    new Date(
      Date.UTC(
        capturedNow.getUTCFullYear() + 2,
        capturedNow.getUTCMonth(),
        capturedNow.getUTCDate(),
        capturedNow.getUTCHours(),
        capturedNow.getUTCMinutes(),
        capturedNow.getUTCSeconds(),
        capturedNow.getUTCMilliseconds(),
      ),
    )
      .toISOString()
      .replace(/Z$/, 'z'),
  ],
]);

function daysInMonth(year: number, month: number): number {
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

  if (month === 2) {
    return leapYear ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function oneCalendarYearAfter(value: Date): number {
  const year = value.getUTCFullYear() + 1;
  const month = value.getUTCMonth() + 1;
  const day = Math.min(value.getUTCDate(), daysInMonth(year, month));
  const boundary = new Date(value.getTime());

  boundary.setUTCFullYear(year, month - 1, day);
  return boundary.getTime();
}

function expectedForTime(fixtureCase: ParseCase, now: Date): ExpectedResult {
  if (fixtureCase.expiresAt && fixtureCase.expiryPhases) {
    const expiry = new Date(fixtureCase.expiresAt).getTime();

    if (now.getTime() > expiry) {
      return {
        ...fixtureCase.expected,
        ...fixtureCase.expiryPhases.afterExpiry,
      };
    }

    return {
      ...fixtureCase.expected,
      ...(expiry > oneCalendarYearAfter(now)
        ? fixtureCase.expiryPhases.beyondOneYear
        : fixtureCase.expiryPhases.withinOneYear),
    };
  }

  return fixtureCase.expected;
}

function materialize<T>(value: T): T {
  if (typeof value === 'string') {
    let result: string = value;

    for (const [symbol, timestamp] of symbols) {
      result = result.replaceAll(symbol, timestamp);
    }

    return result as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => materialize(item)) as T;
  }

  if (value !== null && typeof value === 'object') {
    if ('parts' in value && Array.isArray(value.parts)) {
      return materializeText(value as { parts: TextPart[] }) as T;
    }

    if (
      'repeatArray' in value &&
      typeof value.repeatArray === 'string' &&
      'count' in value &&
      typeof value.count === 'number'
    ) {
      return Array.from({ length: value.count }, () =>
        materialize(value.repeatArray),
      ) as T;
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, materialize(item)]),
    ) as T;
  }

  return value;
}

function materializeText(template: TextTemplate): string {
  if (typeof template === 'string') {
    return materialize(template);
  }

  return template.parts
    .map((part) => {
      if (part.text !== undefined) {
        return materialize(part.text);
      }

      if (part.repeat !== undefined && part.count !== undefined) {
        return materialize(part.repeat).repeat(part.count);
      }

      throw new Error('Invalid conformance text part');
    })
    .join('');
}

function diagnosticPairs(
  diagnostics: SecurityTxtDiagnostic[],
): Pick<SecurityTxtDiagnostic, 'code' | 'line'>[] {
  return diagnostics.map(({ code, line }) => ({ code, line }));
}

function comparable(result: SecurityTxtResult): ExpectedResult {
  return {
    ...result,
    errors: diagnosticPairs(result.errors),
    recommendations: diagnosticPairs(result.recommendations),
    notifications: diagnosticPairs(result.notifications),
  };
}

describe('shared conformance fixture', () => {
  for (const fixtureCase of fixture.parse) {
    test(`parse: ${fixtureCase.name}`, () => {
      const input =
        fixtureCase.input !== undefined
          ? materializeText(fixtureCase.input)
          : readFileSync(
              new URL(`./fixtures/${fixtureCase.inputFile}`, import.meta.url),
              'utf8',
            );

      expect(comparable(parse(input))).toMatchObject(
        materialize(expectedForTime(fixtureCase, capturedNow)),
      );
    });
  }

  for (const fixtureCase of fixture.serialize) {
    test(`serialize: ${fixtureCase.name}`, () => {
      const options = materialize(fixtureCase.options) as SerializeOptions;

      if (fixtureCase.throws) {
        expect(() => serialize(options)).toThrow(TypeError);
      } else {
        expect(serialize(options)).toBe(materialize(fixtureCase.expected));
      }
    });
  }
});

describe('conformance fixture self-audit', () => {
  test('fixed valid expiry cases define beyond, within, and expired phases', () => {
    const phasedCases = [
      'RFC 9116 section 2.6 unsigned example',
      'RFC 9116 section 2.7 signed example',
      'Google snapshot 2026-08-16',
      'GitHub snapshot 2026-08-16',
      'Microsoft snapshot 2026-08-16',
    ];

    for (const name of phasedCases) {
      const fixtureCase = fixture.parse.find((item) => item.name === name) as
        | (ParseCase & {
            expiryPhases?: Record<string, ExpectedResult>;
          })
        | undefined;

      expect(fixtureCase, name).toBeDefined();
      expect(Object.keys(fixtureCase?.expiryPhases ?? {}), name).toEqual([
        'beyondOneYear',
        'withinOneYear',
        'afterExpiry',
      ]);
    }
  });

  test('lowercase-z compatibility uses a symbolic long expiry', () => {
    const fixtureCase = fixture.parse.find(
      (item) =>
        item.name ===
        'RFC erratum 7264 lowercase z remains accepted for compatibility',
    );

    expect(fixtureCase?.input).toContain('{{beyond_one_year_lower_z}}');
  });

  test('calendar-aware runner selects every explicit expiry phase', () => {
    for (const fixtureCase of fixture.parse.filter(
      (item) => item.expiresAt && item.expiryPhases,
    )) {
      const expiry = new Date(fixtureCase.expiresAt as string);
      const beyondNow = new Date(expiry);
      beyondNow.setUTCFullYear(beyondNow.getUTCFullYear() - 2);
      const withinNow = new Date(expiry.getTime() - 30 * 86_400_000);
      const afterNow = new Date(expiry.getTime() + 86_400_000);

      expect(expectedForTime(fixtureCase, beyondNow), fixtureCase.name).toEqual(
        {
          ...fixtureCase.expected,
          ...fixtureCase.expiryPhases?.beyondOneYear,
        },
      );
      expect(expectedForTime(fixtureCase, withinNow), fixtureCase.name).toEqual(
        {
          ...fixtureCase.expected,
          ...fixtureCase.expiryPhases?.withinOneYear,
        },
      );
      expect(expectedForTime(fixtureCase, afterNow), fixtureCase.name).toEqual({
        ...fixtureCase.expected,
        ...fixtureCase.expiryPhases?.afterExpiry,
      });
    }
  });

  test.each([
    ['all nine registered fields populate accessors', ['fields', 'signed']],
    [
      'unknown extension fields remain and notify in source order',
      ['fields', 'notifications'],
    ],
    ['valid URI schemes for contact and encryption', ['contact', 'encryption']],
    [
      'OpenPGP dash escaping is reversed before field parsing',
      ['fields', 'signed', 'contact', 'expires', 'canonical'],
    ],
    ['recommendations have stable order', ['csaf']],
    [
      'RFC 9116 section 2.7 signed example',
      ['fields', 'signed', 'contact', 'expires', 'canonical'],
    ],
  ])('%s explicitly asserts retained state', (name, expectedKeys) => {
    const fixtureCase = fixture.parse.find((item) => item.name === name);

    expect(fixtureCase, name).toBeDefined();
    for (const key of expectedKeys) {
      expect(fixtureCase?.expected, `${name}: ${key}`).toHaveProperty(key);
    }
  });
});
