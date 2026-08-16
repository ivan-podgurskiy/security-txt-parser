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
const AUTHORITY_PATTERN =
  /^(?:[A-Za-z0-9._~!$&'()*+,;=:@\[\]-]|%[0-9A-Fa-f]{2})*$/;
const PATH_PATTERN = /^(?:[A-Za-z0-9._~!$&'()*+,;=:@\/-]|%[0-9A-Fa-f]{2})*$/;
const QUERY_OR_FRAGMENT_PATTERN =
  /^(?:[A-Za-z0-9._~!$&'()*+,;=:@\/?-]|%[0-9A-Fa-f]{2})*$/;

function asciiLower(value: string): string {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

function hasValidRfc3986Structure(schemeSpecific: string): boolean {
  const fragmentIndex = schemeSpecific.indexOf('#');

  if (
    fragmentIndex !== -1 &&
    schemeSpecific.indexOf('#', fragmentIndex + 1) !== -1
  ) {
    return false;
  }

  const beforeFragment =
    fragmentIndex === -1
      ? schemeSpecific
      : schemeSpecific.slice(0, fragmentIndex);
  const fragment =
    fragmentIndex === -1 ? null : schemeSpecific.slice(fragmentIndex + 1);

  if (
    beforeFragment === '' ||
    (fragment !== null && !QUERY_OR_FRAGMENT_PATTERN.test(fragment))
  ) {
    return false;
  }

  const queryIndex = beforeFragment.indexOf('?');
  const hierarchy =
    queryIndex === -1 ? beforeFragment : beforeFragment.slice(0, queryIndex);
  const query = queryIndex === -1 ? null : beforeFragment.slice(queryIndex + 1);

  if (query !== null && !QUERY_OR_FRAGMENT_PATTERN.test(query)) {
    return false;
  }

  if (!hierarchy.startsWith('//')) {
    return PATH_PATTERN.test(hierarchy);
  }

  const pathIndex = hierarchy.indexOf('/', 2);
  const authority =
    pathIndex === -1 ? hierarchy.slice(2) : hierarchy.slice(2, pathIndex);
  const path = pathIndex === -1 ? '' : hierarchy.slice(pathIndex);

  return AUTHORITY_PATTERN.test(authority) && PATH_PATTERN.test(path);
}

function isSyntacticallyValid(
  value: string,
  scheme: string,
  schemeSpecific: string,
): boolean {
  if (!hasValidRfc3986Structure(schemeSpecific)) {
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

  if (!schemeMatch?.[1] || schemeMatch[2] === undefined) {
    return diagnostic('invalid_uri', line);
  }

  const scheme = asciiLower(schemeMatch[1]);

  if (!isSyntacticallyValid(value, scheme, schemeMatch[2])) {
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
