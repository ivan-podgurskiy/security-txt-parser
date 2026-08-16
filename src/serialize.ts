import { classifyExpiry } from './expires.js';
import { isLanguageTag } from './language-tag.js';
import type { SerializeOptions } from './types.js';
import { validateFieldUri } from './uri.js';

const MAX_FILE_BYTES = 32_768;
const MAX_PHYSICAL_LINES = 1_000;
const MAX_FIELD_CODE_POINTS = 2_048;

interface FieldDefinition {
  option: keyof SerializeOptions;
  name: string;
}

const URI_FIELDS: readonly FieldDefinition[] = [
  { option: 'contact', name: 'Contact' },
  { option: 'acknowledgments', name: 'Acknowledgments' },
  { option: 'canonical', name: 'Canonical' },
  { option: 'csaf', name: 'CSAF' },
  { option: 'encryption', name: 'Encryption' },
  { option: 'hiring', name: 'Hiring' },
  { option: 'policy', name: 'Policy' },
];

function invalidOptions(reason: string): never {
  throw new TypeError(`Invalid serialization options: ${reason}`);
}

function assertSingleLine(value: string, name: string): void {
  if (value.includes('\r') || value.includes('\n')) {
    invalidOptions(`${name} must not contain CR or LF`);
  }
}

function normalizeStrings(
  value: unknown,
  name: string,
  required: boolean,
): string[] | null {
  if (value === undefined) {
    return required ? invalidOptions(`${name} is required`) : null;
  }

  const values = typeof value === 'string' ? [value] : value;

  if (!Array.isArray(values) || values.length === 0) {
    return invalidOptions(`${name} must be a string or non-empty array`);
  }

  for (const item of values) {
    if (typeof item !== 'string') {
      invalidOptions(`${name} values must be strings`);
    }

    assertSingleLine(item, name);
  }

  return values;
}

function normalizeComments(value: unknown): string[] | null {
  if (value === undefined) {
    return null;
  }

  if (!Array.isArray(value) || value.length === 0) {
    return invalidOptions('comments must be a non-empty array');
  }

  for (const comment of value) {
    if (typeof comment !== 'string') {
      invalidOptions('comments must contain only strings');
    }

    assertSingleLine(comment, 'comments');
  }

  return value;
}

function normalizeExpiry(value: unknown): string {
  let expiry: string;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return invalidOptions('expires must be a valid Date');
    }

    try {
      expiry = value.toISOString().replace(/\.000Z$/, 'Z');
    } catch {
      return invalidOptions('expires must be representable as RFC 3339');
    }
  } else if (typeof value === 'string') {
    expiry = value;
  } else {
    return invalidOptions('expires must be a Date or string');
  }

  assertSingleLine(expiry, 'expires');

  const classification = classifyExpiry(expiry, new Date());

  if (classification === 'invalid' || classification === 'expired') {
    return invalidOptions('expires must be a current RFC 3339 timestamp');
  }

  return expiry;
}

function validateUriValues(name: string, values: readonly string[]): void {
  for (const value of values) {
    if (validateFieldUri(name, value, 1)) {
      invalidOptions(`${name} contains an invalid URI`);
    }
  }
}

function assertResourceLimits(lines: readonly string[], output: string): void {
  if (lines.length > MAX_PHYSICAL_LINES) {
    invalidOptions('serialized content exceeds the line limit');
  }

  for (const line of lines) {
    if (
      !line.startsWith('#') &&
      Array.from(line).length > MAX_FIELD_CODE_POINTS
    ) {
      invalidOptions('a serialized field exceeds the length limit');
    }
  }

  if (new TextEncoder().encode(output).length > MAX_FILE_BYTES) {
    invalidOptions('serialized content exceeds the file size limit');
  }
}

export function serialize(options: SerializeOptions): string {
  if (options === null || typeof options !== 'object') {
    return invalidOptions('options must be an object');
  }

  const comments = normalizeComments(options.comments);
  const valuesByOption = new Map<keyof SerializeOptions, string[]>();

  for (const field of URI_FIELDS) {
    const values = normalizeStrings(
      options[field.option],
      field.name,
      field.option === 'contact',
    );

    if (values) {
      validateUriValues(field.name, values);
      valuesByOption.set(field.option, values);
    }
  }

  const expiry = normalizeExpiry(options.expires);
  const languages = normalizeStrings(
    options.preferredLanguages,
    'Preferred-Languages',
    false,
  );

  if (languages && languages.some((language) => !isLanguageTag(language))) {
    return invalidOptions('Preferred-Languages contains an invalid tag');
  }

  const lines: string[] = [];

  if (comments) {
    lines.push(...comments.map((comment) => `# ${comment}`));
  }

  for (const value of valuesByOption.get('contact') ?? []) {
    lines.push(`Contact: ${value}`);
  }

  lines.push(`Expires: ${expiry}`);

  for (const field of URI_FIELDS.slice(1)) {
    for (const value of valuesByOption.get(field.option) ?? []) {
      lines.push(`${field.name}: ${value}`);
    }
  }

  if (languages) {
    lines.push(`Preferred-Languages: ${languages.join(', ')}`);
  }

  const output = `${lines.join('\n')}\n`;
  assertResourceLimits(lines, output);

  return output;
}
