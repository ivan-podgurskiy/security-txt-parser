# security-txt-parser — RFC 9116 security.txt parser for TypeScript

Parse, validate, and serialize RFC 9116 `security.txt` files in TypeScript with structured diagnostics, OpenPGP cleartext handling, CSAF support, zero runtime dependencies, and ESM/CommonJS/browser compatibility.

[![CI](https://github.com/ivan-podgurskiy/security-txt-parser/actions/workflows/ci.yml/badge.svg)](https://github.com/ivan-podgurskiy/security-txt-parser/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/security-txt-parser.svg)](https://www.npmjs.com/package/security-txt-parser)
[![npm downloads](https://img.shields.io/npm/dw/security-txt-parser.svg)](https://www.npmjs.com/package/security-txt-parser)
[![Bundle size](https://img.shields.io/bundlephobia/minzip/security-txt-parser)](https://bundlephobia.com/package/security-txt-parser)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Use `security-txt-parser` when a TypeScript or JavaScript application needs to inspect, validate, or generate a vulnerability-disclosure file for `/.well-known/security.txt`. The parser implements RFC 9116 fields and rules without performing network requests, and works in Node.js 18 or newer and browser bundles.

## Install

```sh
npm install security-txt-parser
```

## Quick Start

`parse` returns the fields in source order, convenient registered-field accessors, and diagnostics separated by severity:

```ts
import { parse } from 'security-txt-parser';

const expires = new Date();
expires.setUTCFullYear(expires.getUTCFullYear() + 2);
const expiresAt = expires.toISOString().replace('.000Z', 'Z');

const result = parse(`Contact: https://example.com/report
Expires: ${expiresAt}
Policy: https://example.com/security-policy
Preferred-Languages: en, tr
`);

result.valid; // true
result.contact; // ['https://example.com/report']
result.policy; // ['https://example.com/security-policy']
result.preferredLanguages; // ['en', 'tr']
result.errors; // []
result.recommendations.map(({ code }) => code); // ['long_expiry', 'not_signed']
```

Validation is part of parsing. Errors make `valid` false; recommendations and notifications remain available without invalidating the document.

## Serialize

`serialize` accepts typed options, validates them, and emits fields in canonical order with LF line endings and one trailing newline:

```ts
import { serialize } from 'security-txt-parser';

const expires = new Date();
expires.setUTCFullYear(expires.getUTCFullYear() + 2);
const expiresAt = expires.toISOString().replace('.000Z', 'Z');

const content = serialize({
  comments: ['Security contact for example.com'],
  contact: ['mailto:security@example.com', 'https://example.com/report'],
  expires: expiresAt,
  canonical: 'https://example.com/.well-known/security.txt',
  csaf: 'https://example.com/.well-known/csaf/provider-metadata.json',
  encryption: 'openpgp4fpr:0123456789ABCDEF',
  policy: 'https://example.com/security-policy',
  preferredLanguages: ['en', 'tr'],
});

content ===
  `# Security contact for example.com
Contact: mailto:security@example.com
Contact: https://example.com/report
Expires: ${expiresAt}
Canonical: https://example.com/.well-known/security.txt
CSAF: https://example.com/.well-known/csaf/provider-metadata.json
Encryption: openpgp4fpr:0123456789ABCDEF
Policy: https://example.com/security-policy
Preferred-Languages: en, tr
`; // true
```

Invalid serialization options throw `TypeError`; malformed parsed input is instead returned with structured diagnostics.

## Features

- Parse all eight RFC 9116 fields plus CSAF while preserving field spelling, values, order, and physical line numbers.
- Validate required fields, cardinality, RFC 3339 expiry, absolute URI schemes, RFC 5646 language tags, line endings, and bounded resource limits.
- Serialize typed values for Contact, Expires, Acknowledgments, Canonical, CSAF, Encryption, Hiring, Policy, and Preferred-Languages.
- Extract dash-unescaped fields from syntactically complete OpenPGP cleartext envelopes without requiring a cryptography dependency.
- Return errors, recommendations, and notifications as stable diagnostic codes with messages and source lines.
- Ship ESM, CommonJS, and TypeScript declarations for Node.js and browser bundlers with zero runtime dependencies.

## API

### `parse(content: string): SecurityTxtResult`

Parses and validates a complete `security.txt` string. Parsing malformed strings does not throw. Input over 32,768 UTF-8 bytes is rejected before fields are parsed; input is otherwise bounded to 1,000 physical lines and 2,048 Unicode code points per registered field line. LF and CRLF are accepted, and the final physical line must be terminated.

```ts
interface SecurityTxtResult {
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

interface SecurityTxtField {
  name: string;
  value: string;
  line: number;
}
```

### `serialize(options: SerializeOptions): string`

Builds a validated unsigned document. `contact` and `expires` are required. URI and language fields accept a string or non-empty string array; `comments` accepts a non-empty string array. An `expires` value may be a current RFC 3339 string or a valid `Date`.

```ts
interface SerializeOptions {
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
```

### `diagnostic(code: DiagnosticCode, line: number | null): SecurityTxtDiagnostic`

Creates a diagnostic with the package's stable message for `code` and the supplied one-based source line, or `null` when the diagnostic applies to the whole document.

```ts
interface SecurityTxtDiagnostic {
  code: DiagnosticCode;
  message: string;
  line: number | null;
}
```

All interfaces and the `DiagnosticCode` union are exported as TypeScript types.

## Diagnostics

Errors make `result.valid` false.

| Error code               | Meaning                                                         |
| ------------------------ | --------------------------------------------------------------- |
| `no_contact`             | At least one Contact field is required.                         |
| `no_expires`             | At least one Expires field is required.                         |
| `multi_expires`          | Only one Expires field is allowed.                              |
| `multi_lang`             | Only one Preferred-Languages field is allowed.                  |
| `invalid_expires`        | The Expires field must contain a valid RFC 3339 timestamp.      |
| `expired`                | The Expires field is in the past.                               |
| `invalid_uri`            | The field value must be a valid absolute URI.                   |
| `invalid_contact_scheme` | The Contact field must use an allowed URI scheme.               |
| `invalid_https_field`    | This field requires an HTTPS URI.                               |
| `invalid_lang`           | The Preferred-Languages field contains an invalid language tag. |
| `invalid_line`           | The line is not a valid security.txt field.                     |
| `bom_present`            | A UTF-8 byte order mark is not allowed.                         |
| `invalid_line_ending`    | Only CRLF or LF line endings are allowed.                       |
| `file_too_large`         | The file exceeds the maximum allowed size.                      |
| `too_many_lines`         | The file exceeds the maximum allowed number of lines.           |
| `field_too_long`         | The field value exceeds the maximum allowed length.             |

Recommendations describe useful RFC 9116 or package-policy improvements but do not make the result invalid.

| Recommendation code | Meaning                                                |
| ------------------- | ------------------------------------------------------ |
| `long_expiry`       | The Expires value is more than one year in the future. |
| `no_encryption`     | An Encryption field is recommended.                    |
| `not_signed`        | The security.txt file is not signed.                   |
| `no_canonical`      | A Canonical field is recommended.                      |
| `multi_csaf`        | Only one CSAF field is allowed.                        |

Notifications report recognized syntax that is outside the registered field set.

| Notification code | Meaning                           |
| ----------------- | --------------------------------- |
| `unknown_field`   | The field name is not recognized. |

`line` is one-based when a specific source line caused the diagnostic and `null` for a document-level condition.

## Signed Files

The parser recognizes a syntactically complete OpenPGP cleartext envelope, extracts its cleartext body, reverses cleartext dash escaping, preserves physical source line numbers, and sets `result.signed` to `true`. It does **not** verify the cryptographic signature or establish signer identity; applications that need authenticity must verify the original content with an OpenPGP implementation.

An unsigned or malformed envelope is handled as ordinary input and receives the normal `not_signed` recommendation.

## CSAF

The CSAF field can point security researchers to Common Security Advisory Framework provider metadata. The parser requires an absolute HTTPS URI, exposes values in `result.csaf`, and recommends `multi_csaf` when more than one CSAF field appears. The serializer accepts `csaf` as a string or string array and emits `CSAF` in canonical field order.

This package validates the field URI only. It does not download or validate CSAF documents.

## Compatibility

- Node.js 18, 20, 22, and 24 are exercised in CI; the declared runtime floor is Node.js 18.
- ESM consumers import from `security-txt-parser`; CommonJS consumers require the same package name.
- TypeScript declarations ship beside both compiled entry formats.
- Browser bundlers can use the side-effect-free package; the implementation relies on standard `URL` and `TextEncoder` APIs.
- There are zero runtime dependencies and no filesystem, process, or network access.

## Scope

`security-txt-parser` handles in-memory RFC 9116 parsing, validation, diagnostics, OpenPGP cleartext extraction, and serialization. Contact allows `https`, `mailto`, and `tel`; Encryption allows `https`, `dns`, and `openpgp4fpr`; Acknowledgments, Canonical, CSAF, Hiring, and Policy require HTTPS.

The package deliberately does not fetch `/.well-known/security.txt`, follow redirects, inspect TLS certificates, validate MIME types or HTTP headers, discover domains, verify OpenPGP signatures, or provide a command-line interface. Callers own transport, cryptographic verification, persistence, and policy decisions.

## Alternatives

Generator-only packages can be a smaller fit when an application only emits a known static file and does not need to inspect third-party input. Older or pre-RFC implementations may target the earlier security.txt drafts rather than RFC 9116. Choose this package when parsing and serialization must share typed field models, bounded validation, signed cleartext handling, CSAF support, and machine-readable diagnostics across Node.js and browsers.

## Provenance

Behavior is tested against adapted RFC 9116 examples and errata, shared language-neutral conformance fixtures, and timestamped snapshots from Google, GitHub, Microsoft, and Dropbox. Upstream test ideas from the Python and Rust `sectxt` projects were independently re-expressed. Attribution details are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), and CI never fetches live fixture content.

## License

MIT. See [LICENSE](LICENSE).
