import { diagnostic } from './diagnostics.js';
import { classifyExpiry } from './expires.js';
import { parseLanguageList } from './language-tag.js';
import type { SecurityTxtDiagnostic, SecurityTxtField } from './types.js';
import { validateFieldUri } from './uri.js';

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

export interface ValidationResult {
  errors: SecurityTxtDiagnostic[];
  recommendations: SecurityTxtDiagnostic[];
  notifications: SecurityTxtDiagnostic[];
  preferredLanguages: string[];
}

function fieldsNamed(
  fields: readonly SecurityTxtField[],
  name: string,
): SecurityTxtField[] {
  return fields.filter((field) => field.name.toLowerCase() === name);
}

export function validateFields(
  fields: readonly SecurityTxtField[],
  signed: boolean,
  now: Date,
): ValidationResult {
  const contactFields = fieldsNamed(fields, 'contact');
  const expiresFields = fieldsNamed(fields, 'expires');
  const languageFields = fieldsNamed(fields, 'preferred-languages');
  const encryptionFields = fieldsNamed(fields, 'encryption');
  const canonicalFields = fieldsNamed(fields, 'canonical');
  const csafFields = fieldsNamed(fields, 'csaf');
  const valueErrors: SecurityTxtDiagnostic[] = [];
  const preferredLanguages: string[] = [];
  const longExpiryRecommendations: SecurityTxtDiagnostic[] = [];

  for (const field of fields) {
    const uriError = validateFieldUri(field.name, field.value, field.line);

    if (uriError) {
      valueErrors.push(uriError);
    }

    const name = field.name.toLowerCase();

    if (name === 'expires') {
      const classification = classifyExpiry(field.value, now);

      if (classification === 'invalid') {
        valueErrors.push(diagnostic('invalid_expires', field.line));
      } else if (classification === 'expired') {
        valueErrors.push(diagnostic('expired', field.line));
      } else if (classification === 'long') {
        longExpiryRecommendations.push(diagnostic('long_expiry', field.line));
      }
    }

    if (name === 'preferred-languages') {
      const languages = parseLanguageList(field.value);

      if (languages) {
        preferredLanguages.push(...languages);
      } else {
        valueErrors.push(diagnostic('invalid_lang', field.line));
      }
    }
  }

  valueErrors.sort((left, right) => (left.line ?? 0) - (right.line ?? 0));

  const cardinalityErrors: SecurityTxtDiagnostic[] = [];

  if (contactFields.length === 0) {
    cardinalityErrors.push(diagnostic('no_contact', null));
  }

  if (expiresFields.length === 0) {
    cardinalityErrors.push(diagnostic('no_expires', null));
  }

  if (expiresFields.length > 1) {
    cardinalityErrors.push(
      diagnostic('multi_expires', expiresFields[1]?.line ?? null),
    );
  }

  if (languageFields.length > 1) {
    cardinalityErrors.push(
      diagnostic('multi_lang', languageFields[1]?.line ?? null),
    );
  }

  const recommendations = [...longExpiryRecommendations];

  if (
    contactFields.some((field) => /^mailto:/i.test(field.value)) &&
    encryptionFields.length === 0
  ) {
    recommendations.push(diagnostic('no_encryption', null));
  }

  if (!signed) {
    recommendations.push(diagnostic('not_signed', null));
  }

  if (signed && canonicalFields.length === 0) {
    recommendations.push(diagnostic('no_canonical', null));
  }

  if (csafFields.length > 1) {
    recommendations.push(diagnostic('multi_csaf', csafFields[1]?.line ?? null));
  }

  const notifications = fields
    .filter((field) => !REGISTERED_NAMES.has(field.name.toLowerCase()))
    .map((field) => diagnostic('unknown_field', field.line));

  return {
    errors: [...valueErrors, ...cardinalityErrors],
    recommendations,
    notifications,
    preferredLanguages,
  };
}
