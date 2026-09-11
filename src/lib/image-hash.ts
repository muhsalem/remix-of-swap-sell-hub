// بصمات إدراكية للصور تُحسب في المتصفح قبل الرفع:
//  1) phash  — dHash 64-bit (بنية عامة) لكشف التكرار/السرقة.
//  2) csig   — بصمة ألوان (شبكة 4×4 × RGB) لمقارنة الألوان.
//  3) esig   — بصمة أنماط/حواف 64-bit لمقارنة الملمس والتفاصيل.

const SIZE = 9; // 9x8 → 64 bit difference hash
const CGRID = 4; // شبكة الألوان 4×4
const EGRID = 8; // شبكة الحواف 8×8

export type ImageSignature = { phash: string; csig: string; esig: string };

function toCanvasData(bitmap: ImageBitmap, w: number, h: number): ImageData | null {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

function hex2(n: number) {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
}

function bitsToHex(bits: string) {
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

/** يحسب البصمات الثلاث دفعة واحدة. */
export async function computeImageSignature(file: File): Promise<ImageSignature | null> {
  if (typeof document === "undefined") return null;
  try {
    const bitmap = await createImageBitmap(file);

    // ---- phash (dHash) ----
    const d1 = toCanvasData(bitmap, SIZE, SIZE - 1);
    if (!d1) return null;
    const gray: number[] = [];
    for (let i = 0; i < d1.data.length; i += 4) {
      gray.push(0.299 * d1.data[i] + 0.587 * d1.data[i + 1] + 0.114 * d1.data[i + 2]);
    }
    let bits = "";
    for (let y = 0; y < SIZE - 1; y++) {
      for (let x = 0; x < SIZE - 1; x++) {
        bits += gray[y * SIZE + x] > gray[y * SIZE + x + 1] ? "1" : "0";
      }
    }
    const phash = bitsToHex(bits);

    // ---- csig (ألوان) ----
    const d2 = toCanvasData(bitmap, CGRID, CGRID);
    if (!d2) return null;
    let csig = "";
    for (let i = 0; i < d2.data.length; i += 4) {
      csig += hex2(d2.data[i]) + hex2(d2.data[i + 1]) + hex2(d2.data[i + 2]);
    }

    // ---- esig (حواف/أنماط) ----
    const N = EGRID + 1;
    const d3 = toCanvasData(bitmap, N, N);
    if (!d3) return null;
    const g: number[] = [];
    for (let i = 0; i < d3.data.length; i += 4) {
      g.push(0.299 * d3.data[i] + 0.587 * d3.data[i + 1] + 0.114 * d3.data[i + 2]);
    }
    const mags: number[] = [];
    for (let y = 0; y < EGRID; y++) {
      for (let x = 0; x < EGRID; x++) {
        const c = g[y * N + x];
        const gx = Math.abs(g[y * N + x + 1] - c);
        const gy = Math.abs(g[(y + 1) * N + x] - c);
        mags.push(gx + gy);
      }
    }
    const avg = mags.reduce((a, b) => a + b, 0) / (mags.length || 1);
    const esig = bitsToHex(mags.map((m) => (m > avg ? "1" : "0")).join(""));

    bitmap.close?.();
    return { phash, csig, esig };
  } catch {
    return null;
  }
}

/** توافق رجعي: بصمة البنية فقط. */
export async function computeImageHash(file: File): Promise<string | null> {
  return (await computeImageSignature(file))?.phash ?? null;
}

/** مسافة هامينغ بين بصمتين سداسيتين (0 = متطابقتان). */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

/** تشابه الألوان 0..1 اعتماداً على متوسط الفرق بين خلايا الشبكة. */
export function colorSimilarity(a?: string | null, b?: string | null): number | null {
  if (!a || !b || a.length !== b.length || a.length % 2 !== 0) return null;
  let sum = 0;
  const n = a.length / 2;
  for (let i = 0; i < a.length; i += 2) {
    sum += Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16));
  }
  return Math.max(0, 1 - sum / n / 255);
}

/** تشابه الأنماط/الحواف 0..1. */
export function patternSimilarity(a?: string | null, b?: string | null): number | null {
  if (!a || !b || a.length !== b.length) return null;
  return 1 - hammingDistance(a, b) / (a.length * 4);
}

/** درجة تشابه مركّبة: بنية 50% + ألوان 30% + أنماط 20% (تُعاد التوزيع عند غياب بصمة). */
export function combinedSimilarity(
  q: { phash: string; csig?: string | null; esig?: string | null },
  r: { phash: string; csig?: string | null; esig?: string | null },
): { score: number; structure: number; color: number | null; pattern: number | null } {
  const structure = 1 - hammingDistance(q.phash, r.phash) / 64;
  const color = colorSimilarity(q.csig, r.csig);
  const pattern = patternSimilarity(q.esig, r.esig);

  let total = 0.5;
  let sum = structure * 0.5;
  if (color !== null) { sum += color * 0.3; total += 0.3; }
  if (pattern !== null) { sum += pattern * 0.2; total += 0.2; }
  return { score: sum / total, structure, color, pattern };
}
