// بصمة إدراكية (dHash 64-bit) تُحسب في المتصفح قبل رفع الصورة.
// تُستخدم لكشف الصور المكرّرة/المسروقة بين الإعلانات والحسابات.

const SIZE = 9; // 9x8 → 64 bit difference hash

export async function computeImageHash(file: File): Promise<string | null> {
  if (typeof document === "undefined") return null;
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE - 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, SIZE, SIZE - 1);
    bitmap.close?.();
    const { data } = ctx.getImageData(0, 0, SIZE, SIZE - 1);

    const gray: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }

    let bits = "";
    for (let y = 0; y < SIZE - 1; y++) {
      for (let x = 0; x < SIZE - 1; x++) {
        bits += gray[y * SIZE + x] > gray[y * SIZE + x + 1] ? "1" : "0";
      }
    }

    let hex = "";
    for (let i = 0; i < 64; i += 4) {
      hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    }
    return hex; // 16 hex chars
  } catch {
    return null;
  }
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
