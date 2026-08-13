// تطبيع النص العربي — يطابق دالة public.ar_normalize في قاعدة البيانات.
const DIACRITICS = /[\u064B-\u0652\u0640]/g;
const MAP: Record<string, string> = {
  "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
  "ى": "ي", "ئ": "ي",
  "ؤ": "و",
  "ة": "ه",
  "ڤ": "ف", "گ": "ك", "چ": "ج", "پ": "ب",
};

export function arNormalize(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .replace(DIACRITICS, "")
    .replace(/[أإآٱىئؤةڤگچپ]/g, (c) => MAP[c] ?? c)
    .replace(/\s+/g, " ")
    .trim();
}

export function arTokens(input: string, max = 6): string[] {
  return arNormalize(input)
    .split(/[\s,،.\-_/]+/)
    .filter((t) => t.length >= 2)
    .slice(0, max);
}
