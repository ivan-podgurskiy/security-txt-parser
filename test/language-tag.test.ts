import { describe, expect, test } from 'vitest';

import { isLanguageTag, parseLanguageList } from '../src/language-tag.js';

describe('isLanguageTag', () => {
  test.each([
    'en',
    'en-US',
    'zh-Hant',
    'de-CH-1901',
    'sl-rozaj-biske',
    'x-private',
    'en-x-acme',
    'i-klingon',
    'sgn-BE-FR',
  ])('accepts the required valid case %s', (value) => {
    expect(isLanguageTag(value)).toBe(true);
  });

  test.each([
    'aa',
    'aaa',
    'abcd',
    'abcde',
    'abcdefgh',
    'zh-cmn',
    'zh-cmn-yue',
    'zh-cmn-yue-gan',
    'zh-cmn-Hans-CN',
    'sr-Latn-RS',
    'es-419',
    'sl-rozaj-biske-1994',
    'en-a-abc',
    'en-0-abc-b-def',
    'en-a-12-b-abcdef12-x-private-tail',
    'x-a',
    'x-private-12345678',
    'en-x-a',
  ])('accepts RFC 5646 production %s', (value) => {
    expect(isLanguageTag(value)).toBe(true);
  });

  test.each([
    'en-GB-oed',
    'i-ami',
    'i-bnn',
    'i-default',
    'i-enochian',
    'i-hak',
    'i-klingon',
    'i-lux',
    'i-mingo',
    'i-navajo',
    'i-pwn',
    'i-tao',
    'i-tay',
    'i-tsu',
    'sgn-BE-FR',
    'sgn-BE-NL',
    'sgn-CH-DE',
    'art-lojban',
    'cel-gaulish',
    'no-bok',
    'no-nyn',
    'zh-guoyu',
    'zh-hakka',
    'zh-min',
    'zh-min-nan',
    'zh-xiang',
  ])('accepts grandfathered tag %s case-insensitively', (value) => {
    expect(isLanguageTag(value)).toBe(true);
    expect(isLanguageTag(value.toUpperCase())).toBe(true);
  });

  test.each([
    '',
    'en_US',
    'en-',
    '-en',
    'en--US',
    'a',
    'abcdefghi',
    'zh-cmn-yue-gan-wuu',
    'en-a',
    'en-a-z',
    'en-a-123456789',
    'en-a-abc-A-def',
    'en-0-abc-0-def',
    'x',
    'x-',
    'x-123456789',
    'en-x',
    'en-x-',
    'en-US-abcd',
    'de-1901-1901',
    'en-a-abc-!',
    'en a',
  ])('rejects malformed or forbidden tag %s', (value) => {
    expect(isLanguageTag(value)).toBe(false);
  });
});

describe('parseLanguageList', () => {
  test('parses a trimmed list without changing case or order', () => {
    expect(parseLanguageList('en, pt-BR, zh-Hant')).toEqual([
      'en',
      'pt-BR',
      'zh-Hant',
    ]);
  });

  test.each(['en, ,fr', '', 'en,fr,', ',en', 'en,en_US'])(
    'rejects an invalid list %s',
    (value) => {
      expect(parseLanguageList(value)).toBeNull();
    },
  );

  test('preserves accepted casing, order, and duplicates', () => {
    expect(parseLanguageList(' EN-us, i-KLINGON, EN-us ')).toEqual([
      'EN-us',
      'i-KLINGON',
      'EN-us',
    ]);
  });
});
