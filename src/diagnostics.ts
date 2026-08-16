import type { DiagnosticCode, SecurityTxtDiagnostic } from './types.js';

const messages: Record<DiagnosticCode, string> = {
  no_contact: 'At least one Contact field is required.',
  no_expires: 'At least one Expires field is required.',
  multi_expires: 'Only one Expires field is allowed.',
  multi_lang: 'Only one Preferred-Languages field is allowed.',
  invalid_expires: 'The Expires field must contain a valid RFC 3339 timestamp.',
  expired: 'The Expires field is in the past.',
  invalid_uri: 'The field value must be a valid absolute URI.',
  invalid_contact_scheme: 'The Contact field must use an allowed URI scheme.',
  invalid_https_field: 'This field requires an HTTPS URI.',
  invalid_lang:
    'The Preferred-Languages field contains an invalid language tag.',
  invalid_line: 'The line is not a valid security.txt field.',
  bom_present: 'A UTF-8 byte order mark is not allowed.',
  invalid_line_ending: 'Only CRLF or LF line endings are allowed.',
  file_too_large: 'The file exceeds the maximum allowed size.',
  too_many_lines: 'The file exceeds the maximum allowed number of lines.',
  field_too_long: 'The field value exceeds the maximum allowed length.',
  long_expiry: 'The Expires value is more than one year in the future.',
  no_encryption: 'An Encryption field is recommended.',
  not_signed: 'The security.txt file is not signed.',
  no_canonical: 'A Canonical field is recommended.',
  multi_csaf: 'Only one CSAF field is allowed.',
  unknown_field: 'The field name is not recognized.',
};

export function diagnostic(
  code: DiagnosticCode,
  line: number | null,
): SecurityTxtDiagnostic {
  return { code, message: messages[code], line };
}
