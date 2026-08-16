import { diagnostic } from './diagnostics.js';
import type { SecurityTxtDiagnostic } from './types.js';

const MAX_FILE_BYTES = 32_768;
const MAX_PHYSICAL_LINES = 1_000;

export interface PhysicalLine {
  number: number;
  text: string;
}

export interface LineScan {
  lines: PhysicalLine[];
  errors: SecurityTxtDiagnostic[];
  rejected: boolean;
}

export function scanLines(content: string): LineScan {
  if (new TextEncoder().encode(content).length > MAX_FILE_BYTES) {
    return {
      lines: [],
      errors: [diagnostic('file_too_large', null)],
      rejected: true,
    };
  }

  const errors: SecurityTxtDiagnostic[] = [];
  let source = content;

  if (source.startsWith('\uFEFF')) {
    errors.push(diagnostic('bom_present', 1));
    source = source.slice(1);
  }

  const segments = source.split('\n');
  const finalSegmentIsTerminated = source.endsWith('\n');
  const lineCount =
    source.length === 0
      ? 0
      : finalSegmentIsTerminated
        ? segments.length - 1
        : segments.length;
  const lines: PhysicalLine[] = [];

  for (let index = 0; index < lineCount; index += 1) {
    const segment = segments[index] ?? '';
    const text =
      index < segments.length - 1 && segment.endsWith('\r')
        ? segment.slice(0, -1)
        : segment;
    const number = index + 1;

    lines.push({ number, text });

    for (const character of text) {
      if (character === '\r') {
        errors.push(diagnostic('invalid_line_ending', number));
      }
    }
  }

  if (!finalSegmentIsTerminated && source.length > 0) {
    errors.push(diagnostic('invalid_line_ending', lineCount));
  }

  if (lines.length > MAX_PHYSICAL_LINES) {
    errors.push(diagnostic('too_many_lines', null));
  }

  return { lines, errors, rejected: false };
}
