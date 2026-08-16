const ALPHA = '[A-Za-z]';
const DIGIT = '[0-9]';
const ALPHANUM = '[A-Za-z0-9]';

const LANGUAGE = `(?:${ALPHA}{2,3}(?:-${ALPHA}{3}){0,3}|${ALPHA}{4}|${ALPHA}{5,8})`;
const SCRIPT = `${ALPHA}{4}`;
const REGION = `(?:${ALPHA}{2}|${DIGIT}{3})`;
const VARIANT = `(?:${ALPHANUM}{5,8}|${DIGIT}${ALPHANUM}{3})`;
const SINGLETON = '[0-9A-WY-Za-wy-z]';
const EXTENSION = `${SINGLETON}(?:-${ALPHANUM}{2,8})+`;
const PRIVATE_USE = `x(?:-${ALPHANUM}{1,8})+`;

const LANGTAG_PATTERN = new RegExp(
  `^${LANGUAGE}(?:-${SCRIPT})?(?:-${REGION})?(?:-${VARIANT})*(?:-${EXTENSION})*(?:-${PRIVATE_USE})?$`,
  'i',
);
const PRIVATE_USE_PATTERN = new RegExp(`^${PRIVATE_USE}$`, 'i');
const ALPHA_PATTERN = /^[A-Za-z]+$/;
const SCRIPT_PATTERN = /^[A-Za-z]{4}$/;
const REGION_PATTERN = /^(?:[A-Za-z]{2}|[0-9]{3})$/;
const VARIANT_PATTERN = /^(?:[A-Za-z0-9]{5,8}|[0-9][A-Za-z0-9]{3})$/;
const SINGLETON_PATTERN = /^[0-9A-WY-Za-wy-z]$/;

const IRREGULAR_GRANDFATHERED = new Set([
  'en-gb-oed',
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
  'sgn-be-fr',
  'sgn-be-nl',
  'sgn-ch-de',
]);

const REGULAR_GRANDFATHERED = new Set([
  'art-lojban',
  'cel-gaulish',
  'no-bok',
  'no-nyn',
  'zh-guoyu',
  'zh-hakka',
  'zh-min',
  'zh-min-nan',
  'zh-xiang',
]);

function asciiLower(value: string): string {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

function isGrandfathered(value: string): boolean {
  const normalized = asciiLower(value);

  return (
    IRREGULAR_GRANDFATHERED.has(normalized) ||
    REGULAR_GRANDFATHERED.has(normalized)
  );
}

function languageSubtagEnd(subtags: string[]): number {
  const primary = subtags[0];

  if (primary === undefined || primary.length < 2 || primary.length > 3) {
    return 1;
  }

  let index = 1;
  let extlangCount = 0;

  while (
    extlangCount < 3 &&
    subtags[index]?.length === 3 &&
    ALPHA_PATTERN.test(subtags[index] ?? '')
  ) {
    index += 1;
    extlangCount += 1;
  }

  return index;
}

function hasUniqueVariantsAndExtensions(value: string): boolean {
  const subtags = value.split('-');
  let index = languageSubtagEnd(subtags);

  if (SCRIPT_PATTERN.test(subtags[index] ?? '')) {
    index += 1;
  }

  if (REGION_PATTERN.test(subtags[index] ?? '')) {
    index += 1;
  }

  const variants = new Set<string>();

  while (VARIANT_PATTERN.test(subtags[index] ?? '')) {
    const variant = asciiLower(subtags[index] ?? '');

    if (variants.has(variant)) {
      return false;
    }

    variants.add(variant);
    index += 1;
  }

  const singletons = new Set<string>();

  while (SINGLETON_PATTERN.test(subtags[index] ?? '')) {
    const singleton = asciiLower(subtags[index] ?? '');

    if (singletons.has(singleton)) {
      return false;
    }

    singletons.add(singleton);
    index += 1;

    while (
      index < subtags.length &&
      subtags[index]?.length !== 1 &&
      asciiLower(subtags[index] ?? '') !== 'x'
    ) {
      index += 1;
    }
  }

  return true;
}

export function isLanguageTag(value: string): boolean {
  if (isGrandfathered(value) || PRIVATE_USE_PATTERN.test(value)) {
    return true;
  }

  return LANGTAG_PATTERN.test(value) && hasUniqueVariantsAndExtensions(value);
}

export function parseLanguageList(value: string): string[] | null {
  const tags = value.split(',').map((tag) => tag.trim());

  return tags.every((tag) => tag !== '' && isLanguageTag(tag)) ? tags : null;
}
