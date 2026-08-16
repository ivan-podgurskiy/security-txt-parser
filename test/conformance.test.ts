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
  expectedAfterExpiry?: ExpectedResult;
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
]);

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

      const expected =
        fixtureCase.expiresAt &&
        fixtureCase.expectedAfterExpiry &&
        capturedNow.getTime() > new Date(fixtureCase.expiresAt).getTime()
          ? fixtureCase.expectedAfterExpiry
          : fixtureCase.expected;

      expect(comparable(parse(input))).toMatchObject(materialize(expected));
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
