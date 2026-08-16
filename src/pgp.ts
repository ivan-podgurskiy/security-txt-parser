import type { PhysicalLine } from './lines.js';

const SIGNED_MESSAGE_BEGIN = '-----BEGIN PGP SIGNED MESSAGE-----';
const SIGNATURE_BEGIN = '-----BEGIN PGP SIGNATURE-----';
const SIGNATURE_END = '-----END PGP SIGNATURE-----';

export interface CleartextExtraction {
  signed: boolean;
  lines: PhysicalLine[];
}

export function extractCleartext(
  lines: readonly PhysicalLine[],
): CleartextExtraction {
  if (lines[0]?.text !== SIGNED_MESSAGE_BEGIN) {
    return { signed: false, lines: lines as PhysicalLine[] };
  }

  let index = 1;

  while (lines[index]?.text.startsWith('Hash: ')) {
    index += 1;
  }

  if (index === 1 || lines[index]?.text !== '') {
    return { signed: false, lines: lines as PhysicalLine[] };
  }

  const cleartextStart = index + 1;
  const signatureStart = lines.findIndex(
    (line, lineIndex) =>
      lineIndex >= cleartextStart && line.text === SIGNATURE_BEGIN,
  );

  if (
    signatureStart === -1 ||
    !lines.slice(signatureStart + 1).some((line) => line.text === SIGNATURE_END)
  ) {
    return { signed: false, lines: lines as PhysicalLine[] };
  }

  return {
    signed: true,
    lines: lines.slice(cleartextStart, signatureStart).map((line) => ({
      number: line.number,
      text: line.text.startsWith('- ') ? line.text.slice(2) : line.text,
    })),
  };
}
