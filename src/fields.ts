import { diagnostic } from './diagnostics.js';
import type { PhysicalLine } from './lines.js';
import type { SecurityTxtDiagnostic, SecurityTxtField } from './types.js';

const REGISTERED_NAMES = new Set([
  'contact',
  'expires',
  'acknowledgments',
  'canonical',
  'csaf',
  'encryption',
  'hiring',
  'policy',
  'preferred-languages',
]);

export interface CollectedFields {
  contact: string[];
  expires: string | null;
  acknowledgments: string[];
  canonical: string[];
  csaf: string[];
  encryption: string[];
  hiring: string[];
  policy: string[];
  preferredLanguages: string[];
}

export function parseField(
  line: PhysicalLine,
): SecurityTxtField | SecurityTxtDiagnostic | null {
  if (line.text === '' || line.text.startsWith('#')) {
    return null;
  }

  const colonIndex = line.text.indexOf(':');

  if (colonIndex <= 0) {
    return diagnostic('invalid_line', line.number);
  }

  const name = line.text.slice(0, colonIndex);
  const value = line.text.slice(colonIndex + 1).trim();

  if (!/^[\x21-\x39\x3b-\x7e]+$/.test(name) || value === '') {
    return diagnostic('invalid_line', line.number);
  }

  if (
    REGISTERED_NAMES.has(name.toLowerCase()) &&
    Array.from(line.text).length > 2_048
  ) {
    return diagnostic('field_too_long', line.number);
  }

  return { name, value, line: line.number };
}

export function collectFields(fields: SecurityTxtField[]): CollectedFields {
  const collected: CollectedFields = {
    contact: [],
    expires: null,
    acknowledgments: [],
    canonical: [],
    csaf: [],
    encryption: [],
    hiring: [],
    policy: [],
    preferredLanguages: [],
  };

  for (const field of fields) {
    switch (field.name.toLowerCase()) {
      case 'contact':
        collected.contact.push(field.value);
        break;
      case 'expires':
        collected.expires ??= field.value;
        break;
      case 'acknowledgments':
        collected.acknowledgments.push(field.value);
        break;
      case 'canonical':
        collected.canonical.push(field.value);
        break;
      case 'csaf':
        collected.csaf.push(field.value);
        break;
      case 'encryption':
        collected.encryption.push(field.value);
        break;
      case 'hiring':
        collected.hiring.push(field.value);
        break;
      case 'policy':
        collected.policy.push(field.value);
        break;
      case 'preferred-languages':
        collected.preferredLanguages.push(field.value);
        break;
    }
  }

  return collected;
}
