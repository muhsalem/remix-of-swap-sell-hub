// Arabic pluralization helpers for countdown labels.
// Ensures grammatically-correct forms near zero and around dual/plural
// boundaries. Digits are always kept so numeric parsers (tests, analytics)
// keep working: e.g. "5 ثوانٍ" still matches /\d+\s*ث/.

const READY = "الآن…";

type Forms = {
  one: string;
  two: string;
  few: string; // 3-10
  many: string; // 11+
};

const SEC: Forms = {
  one: "ثانية",
  two: "ثانيتان",
  few: "ثوانٍ",
  many: "ثانية",
};

const MIN: Forms = {
  one: "دقيقة",
  two: "دقيقتان",
  few: "دقائق",
  many: "دقيقة",
};

function pluralForm(n: number, f: Forms): string {
  if (n === 1) return `1 ${f.one}`;
  if (n === 2) return `2 ${f.two}`;
  if (n >= 3 && n <= 10) return `${n} ${f.few}`;
  return `${n} ${f.many}`;
}

/**
 * Formats a remaining time in seconds using Arabic pluralization.
 * Returns `الآن…` when the deadline has passed (seconds <= 0).
 */
export function formatArabicCountdown(totalSeconds: number | null): string | null {
  if (totalSeconds === null || Number.isNaN(totalSeconds)) return null;
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s === 0) return READY;
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  if (mm === 0) return pluralForm(ss, SEC);
  if (ss === 0) return pluralForm(mm, MIN);
  return `${pluralForm(mm, MIN)} و ${pluralForm(ss, SEC)}`;
}

export const READY_LABEL = READY;
