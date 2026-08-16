import { collectFields, parseField } from './fields.js';
import { scanLines } from './lines.js';
import { extractCleartext } from './pgp.js';
import type {
  SecurityTxtDiagnostic,
  SecurityTxtField,
  SecurityTxtResult,
} from './types.js';
import { validateFields } from './validate.js';

function emptyResult(errors: SecurityTxtDiagnostic[]): SecurityTxtResult {
  return {
    valid: errors.length === 0,
    fields: [],
    contact: [],
    expires: null,
    acknowledgments: [],
    canonical: [],
    csaf: [],
    encryption: [],
    hiring: [],
    policy: [],
    preferredLanguages: [],
    signed: false,
    errors,
    recommendations: [],
    notifications: [],
  };
}

export function parse(content: string): SecurityTxtResult {
  const scanned = scanLines(content);

  if (scanned.rejected) {
    return emptyResult(scanned.errors);
  }

  const cleartext = extractCleartext(scanned.lines);
  const fields: SecurityTxtField[] = [];
  const physicalErrors = [...scanned.errors];

  for (const line of cleartext.lines) {
    const parsed = parseField(line);

    if (!parsed) {
      continue;
    }

    if ('code' in parsed) {
      physicalErrors.push(parsed);
    } else {
      fields.push(parsed);
    }
  }

  physicalErrors.sort((left, right) => {
    if (left.line === null) {
      return right.line === null ? 0 : 1;
    }

    return right.line === null ? -1 : left.line - right.line;
  });

  const collected = collectFields(fields);
  const validation = validateFields(fields, cleartext.signed, new Date());
  const errors = [...physicalErrors, ...validation.errors];

  return {
    valid: errors.length === 0,
    fields,
    contact: collected.contact,
    expires: collected.expires,
    acknowledgments: collected.acknowledgments,
    canonical: collected.canonical,
    csaf: collected.csaf,
    encryption: collected.encryption,
    hiring: collected.hiring,
    policy: collected.policy,
    preferredLanguages: validation.preferredLanguages,
    signed: cleartext.signed,
    errors,
    recommendations: validation.recommendations,
    notifications: validation.notifications,
  };
}
