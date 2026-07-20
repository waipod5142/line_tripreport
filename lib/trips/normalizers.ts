// Deterministic normalization (PRD §10.4). AI proposes raw values; these
// functions produce the canonical forms used for matching and storage while the
// original displayed value is preserved separately.

/** Uppercase, trim, and strip internal whitespace. `TPL 6.5` → `TPL6.5`. */
export function normalizeShipmentCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  return s.length ? s : null;
}

/**
 * Normalize a truck/trailer registration for matching without discarding
 * meaningful province/country words. `aya 71 - 6213` → `AYA 71-6213`.
 */
export function normalizeRegistration(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-");
  return s.length ? s : null;
}

/**
 * Normalize a Thai/international phone to E.164-ish form while the raw display
 * value is kept by the caller. `081-234-5678` → `+66812345678`.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("0")) return "+66" + cleaned.slice(1);
  if (cleaned.startsWith("66")) return "+" + cleaned;
  return cleaned;
}

const ISO6346_VALUES: Record<string, number> = {
  A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20,
  K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31,
  U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38,
};

/**
 * Validate an ISO 6346 container number (4 letters + 6 digits + check digit).
 * Non-standard operational references are permitted elsewhere with a warning;
 * this only reports whether the checksum is valid.
 */
export function isValidContainerNumber(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const s = raw.toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z]{4}\d{7}$/.test(s)) return false;

  const body = s.slice(0, 10);
  const check = Number(s[10]);
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = body[i];
    const value = /[A-Z]/.test(ch) ? ISO6346_VALUES[ch] : Number(ch);
    sum += value * 2 ** i;
  }
  let cd = sum % 11;
  if (cd === 10) cd = 0;
  return cd === check;
}

export function normalizeContainerNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.toUpperCase().replace(/\s+/g, "");
  return s.length ? s : null;
}

const THAI_BE_OFFSET = 543;

/**
 * Parse a flexible numeric date (DD/MM/YYYY, DD-MM-YY, etc.) to an ISO date.
 * Thai Buddhist-Era years (clearly > 2400) are converted to Gregorian. The AI
 * already returns ISO dates; this is the deterministic re-validation path and
 * the utility used for raw fields. Returns null when unparseable.
 */
export function parseFlexibleDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (!m) {
    // Already ISO? Accept YYYY-MM-DD.
    const iso = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return normalizeYmd(+iso[1], +iso[2], +iso[3]);
    return null;
  }
  const day = +m[1];
  const month = +m[2];
  let year = +m[3];
  if (year < 100) year += 2000; // two-digit → 20xx (Gregorian short form)
  if (year > 2400) year -= THAI_BE_OFFSET; // clearly Buddhist Era
  return normalizeYmd(year, month, day);
}

function normalizeYmd(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null; // e.g. 31/02
  }
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}
