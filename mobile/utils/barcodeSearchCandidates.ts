const UPC_EAN_MAIN_LENGTHS = [13, 12, 8];
const UPC_EAN_ADD_ON_LENGTHS = [5, 2];

const addCandidate = (candidates: string[], seen: Set<string>, value?: string) => {
  const candidate = (value || '').trim();
  if (!candidate || seen.has(candidate)) {
    return;
  }
  seen.add(candidate);
  candidates.push(candidate);
};

/**
 * Builds lookup candidates from scanner output. Camera scanners usually return only
 * the encoded value, but some wedge scanners include separators or UPC/EAN add-ons.
 */
export const deriveBarcodeSearchCandidates = (rawData: string): string[] => {
  const raw = (rawData || '').trim();
  if (!raw) {
    return [];
  }

  const candidates: string[] = [];
  const seen = new Set<string>();
  addCandidate(candidates, seen, raw);

  const compactWhitespace = raw.replace(/\s+/g, '');
  addCandidate(candidates, seen, compactWhitespace);

  const compactSeparators = raw.replace(/[\s\-_/|:,;]+/g, '');
  addCandidate(candidates, seen, compactSeparators);

  const digitsOnly = raw.replace(/\D/g, '');
  addCandidate(candidates, seen, digitsOnly);

  if (/^\d+$/.test(digitsOnly)) {
    UPC_EAN_MAIN_LENGTHS.forEach((mainLength) => {
      UPC_EAN_ADD_ON_LENGTHS.forEach((addOnLength) => {
        if (digitsOnly.length === mainLength + addOnLength) {
          addCandidate(candidates, seen, digitsOnly.slice(0, mainLength));
          addCandidate(candidates, seen, digitsOnly.slice(mainLength));
        }
      });
    });

    if (digitsOnly.length === 13 && digitsOnly.startsWith('0')) {
      addCandidate(candidates, seen, digitsOnly.slice(1));
    }
    if (digitsOnly.length === 12) {
      addCandidate(candidates, seen, `0${digitsOnly}`);
    }
  }

  const numericSegments = raw.match(/\d+/g) || [];
  numericSegments
    .filter((segment) => segment.length >= 2)
    .sort((a, b) => b.length - a.length)
    .forEach((segment) => addCandidate(candidates, seen, segment));

  return candidates.slice(0, 12);
};
