/**
 * Minimal Code 39 barcode renderer (pure, dependency-free).
 * Used for printable shipping labels.
 */

const CODE39: Record<string, string> = {
  "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn",
  "4": "nnnwwnnnw", "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw",
  "8": "wnnwnnwnn", "9": "nnwwnnwnn",
  A: "wnnnnwnnw", B: "nnwnnwnnw", C: "wnwnnwnnn", D: "nnnnwwnnw",
  E: "wnnnwwnnn", F: "nnwnwwnnn", G: "nnnnnwwnw", H: "wnnnnwwnn",
  I: "nnwnnwwnn", J: "nnnnwwwnn", K: "wnnnnnnww", L: "nnwnnnnww",
  M: "wnwnnnnwn", N: "nnnnwnnww", O: "wnnnwnnwn", P: "nnwnwnnwn",
  Q: "nnnnnnwww", R: "wnnnnnwwn", S: "nnwnnnwwn", T: "nnnnwnwwn",
  U: "wwnnnnnnw", V: "nwwnnnnnw", W: "wwwnnnnnn", X: "nwnnwnnnw",
  Y: "wwnnwnnnn", Z: "nwwnwnnnn",
  "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn", "*": "nwnnwnwnn",
};

export type BarcodeBar = { x: number; w: number };

/** Returns bar rectangles + total width for a Code 39 encoding of `value`. */
export function code39Bars(value: string, narrow = 2, wide = 5, gap = 2) {
  const text = `*${value.toUpperCase().replace(/[^0-9A-Z\-. ]/g, "")}*`;
  const bars: BarcodeBar[] = [];
  let x = 0;
  for (const ch of text) {
    const pattern = CODE39[ch];
    if (!pattern) continue;
    pattern.split("").forEach((p, i) => {
      const w = p === "w" ? wide : narrow;
      if (i % 2 === 0) bars.push({ x, w }); // even index = bar
      x += w;
    });
    x += gap; // inter-character gap
  }
  return { bars, width: Math.max(x - gap, 1) };
}
