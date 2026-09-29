// A dispatcher recording a stage by hand types a Bangkok wall-clock time into
// <input type="datetime-local">, which carries no zone. Thailand has no DST,
// so the offset is a constant +07:00. Pure — shared by the form and the action.

const OFFSET_MS = 7 * 3_600_000;

/** "2026-09-30T14:05" (Bangkok) → UTC ISO string, or null if not a real time. */
export function bangkokLocalToIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const utc = Date.UTC(y, mo - 1, d, h, mi);
  const back = new Date(utc);
  if (
    back.getUTCFullYear() !== y ||
    back.getUTCMonth() !== mo - 1 ||
    back.getUTCDate() !== d ||
    back.getUTCHours() !== h ||
    back.getUTCMinutes() !== mi
  ) {
    return null;
  }
  return new Date(utc - OFFSET_MS).toISOString();
}

/** UTC instant → "YYYY-MM-DDTHH:mm" in Bangkok, for a datetime-local default. */
export function isoToBangkokLocal(iso: string | number | Date): string {
  return new Date(new Date(iso).getTime() + OFFSET_MS).toISOString().slice(0, 16);
}
