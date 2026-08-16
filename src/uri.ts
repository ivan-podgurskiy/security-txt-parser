import { diagnostic } from './diagnostics.js';
import type { SecurityTxtDiagnostic } from './types.js';

const HTTPS_FIELDS = new Set([
  'acknowledgments',
  'canonical',
  'csaf',
  'hiring',
  'policy',
]);

const URI_FIELDS = new Set(['contact', 'encryption', ...HTTPS_FIELDS]);
const CONTACT_SCHEMES = new Set(['https', 'mailto', 'tel']);
const ENCRYPTION_SCHEMES = new Set(['https', 'dns', 'openpgp4fpr']);

function asciiLower(value: string): string {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

function isSyntacticallyValid(value: string, scheme: string): boolean {
  if (/[%](?![0-9A-Fa-f]{2})/.test(value)) {
    return false;
  }

  if (/[\p{White_Space}\p{Cc}]/u.test(value)) {
    return false;
  }

  try {
    const parsed = new URL(value);

    if (scheme === 'https') {
      return (
        /^https:\/\/[^/?#\\]+(?:[/?#]|$)/i.test(value) &&
        parsed.protocol === 'https:' &&
        parsed.hostname !== ''
      );
    }

    return true;
  } catch {
    return false;
  }
}

export function validateFieldUri(
  name: string,
  value: string,
  line: number,
): SecurityTxtDiagnostic | null {
  const fieldName = asciiLower(name);

  if (!URI_FIELDS.has(fieldName)) {
    return null;
  }

  const schemeMatch = /^([A-Za-z][A-Za-z0-9+.-]*):(.*)$/.exec(value);

  if (!schemeMatch?.[1] || schemeMatch[2] === '') {
    return diagnostic('invalid_uri', line);
  }

  const scheme = asciiLower(schemeMatch[1]);

  if (!isSyntacticallyValid(value, scheme)) {
    return diagnostic('invalid_uri', line);
  }

  if (fieldName === 'contact') {
    return CONTACT_SCHEMES.has(scheme)
      ? null
      : diagnostic('invalid_contact_scheme', line);
  }

  if (fieldName === 'encryption') {
    return ENCRYPTION_SCHEMES.has(scheme)
      ? null
      : diagnostic('invalid_https_field', line);
  }

  return scheme === 'https' ? null : diagnostic('invalid_https_field', line);
}
