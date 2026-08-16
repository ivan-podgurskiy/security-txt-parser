export type DiagnosticCode =
  | 'no_contact'
  | 'no_expires'
  | 'multi_expires'
  | 'multi_lang'
  | 'invalid_expires'
  | 'expired'
  | 'invalid_uri'
  | 'invalid_contact_scheme'
  | 'invalid_https_field'
  | 'invalid_lang'
  | 'invalid_line'
  | 'bom_present'
  | 'invalid_line_ending'
  | 'file_too_large'
  | 'too_many_lines'
  | 'field_too_long'
  | 'long_expiry'
  | 'no_encryption'
  | 'not_signed'
  | 'no_canonical'
  | 'multi_csaf'
  | 'unknown_field';

export interface SecurityTxtField {
  name: string;
  value: string;
  line: number;
}

export interface SecurityTxtDiagnostic {
  code: DiagnosticCode;
  message: string;
  line: number | null;
}

export interface SecurityTxtResult {
  valid: boolean;
  fields: SecurityTxtField[];
  contact: string[];
  expires: string | null;
  acknowledgments: string[];
  canonical: string[];
  csaf: string[];
  encryption: string[];
  hiring: string[];
  policy: string[];
  preferredLanguages: string[];
  signed: boolean;
  errors: SecurityTxtDiagnostic[];
  recommendations: SecurityTxtDiagnostic[];
  notifications: SecurityTxtDiagnostic[];
}

export interface SerializeOptions {
  contact: string | string[];
  expires: Date | string;
  acknowledgments?: string | string[];
  canonical?: string | string[];
  csaf?: string | string[];
  encryption?: string | string[];
  hiring?: string | string[];
  policy?: string | string[];
  preferredLanguages?: string | string[];
  comments?: string[];
}
