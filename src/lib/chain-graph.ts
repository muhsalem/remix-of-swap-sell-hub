import { arNormalize } from "@/lib/ar-normalize";

export type ChainNode = {
  id: string;
  owner_id: string;
  title: string;
  category: string | null;
  wants: string | null;
  market_price: number | null;
  is_ribawi?: boolean | null;
};

export type TradeCycle = {
  /** الإعلانات بالترتيب: كل عنصر يستلمه صاحب العنصر السابق */
  nodes: ChainNode[];
  /** 0..1 — متوسط قوة المطابقة بين الحلقات */
  score: number;
  /** أقصى فارق قيمة بالنسبة المئوية داخل السلسلة */
  maxGapPct: number;
};

const STOP = new Set(["في", "من", "على", "او", "أو", "و", "the", "a", "an", "او", "اي", "أي", "مع"]);

export function tokens(text: string | null | undefined): string[] {
  return arNormalize(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

/** قوة رغبة صاحب `from` في الحصول على `to` (0..1) */
export function wantScore(from: ChainNode, to: ChainNode): number {
  const want = tokens(from.wants);
  if (want.length === 0) return 0;
  const target = new Set([...tokens(to.title), ...tokens(to.category)]);
  if (target.size === 0) return 0;
  const hits = want.filter((w) => {
    for (const t of target) if (t === w || t.includes(w) || w.includes(t)) return true;
    return false;
  }).length;
  return Math.min(1, hits / Math.min(want.length, 4));
}

function gapPct(a: ChainNode, b: ChainNode): number {
  const x = Number(a.market_price ?? 0);
  const y = Number(b.market_price ?? 0);
  if (!x || !y) return 0;
  return Math.round((Math.abs(x - y) / Math.max(x, y)) * 100);
}

/**
 * يبحث عن دورات مقايضة بطول 2..maxLen تبدأ وتنتهي عند `startId`.
 * الحافة A→B تعني: صاحب A يريد B.
 */
export function findCycles(
  listings: ChainNode[],
  startId: string,
  opts: { maxLen?: number; minScore?: number; maxGapPct?: number; limit?: number } = {},
): TradeCycle[] {
  const maxLen = opts.maxLen ?? 4;
  const minScore = opts.minScore ?? 0.34;
  const maxGap = opts.maxGapPct ?? 60;
  const limit = opts.limit ?? 10;

  const byId = new Map(listings.map((l) => [l.id, l]));
  const start = byId.get(startId);
  if (!start) return [];

  const edges = new Map<string, { to: ChainNode; score: number }[]>();
  for (const a of listings) {
    const out: { to: ChainNode; score: number }[] = [];
    for (const b of listings) {
      if (a.id === b.id || a.owner_id === b.owner_id) continue;
      const s = wantScore(a, b);
      if (s >= minScore) out.push({ to: b, score: s });
    }
    out.sort((x, y) => y.score - x.score);
    edges.set(a.id, out.slice(0, 12));
  }

  const results: TradeCycle[] = [];
  const seen = new Set<string>();

  const walk = (path: ChainNode[], scores: number[], owners: Set<string>) => {
    if (results.length >= limit) return;
    const last = path[path.length - 1]!;
    for (const { to, score } of edges.get(last.id) ?? []) {
      if (to.id === startId) {
        if (path.length < 2) continue;
        const all = [...scores, score];
        const gaps = path.map((n, i) => gapPct(n, path[(i + 1) % path.length]!));
        const maxG = Math.max(...gaps, 0);
        if (maxG > maxGap) continue;
        const key = path.map((n) => n.id).join(">");
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({
          nodes: [...path],
          score: all.reduce((a, b) => a + b, 0) / all.length,
          maxGapPct: maxG,
        });
        if (results.length >= limit) return;
        continue;
      }
      if (path.length >= maxLen) continue;
      if (owners.has(to.owner_id)) continue;
      owners.add(to.owner_id);
      walk([...path, to], [...scores, score], owners);
      owners.delete(to.owner_id);
    }
  };

  walk([start], [], new Set([start.owner_id]));
  return results.sort((a, b) => b.score - a.score || a.maxGapPct - b.maxGapPct);
}
