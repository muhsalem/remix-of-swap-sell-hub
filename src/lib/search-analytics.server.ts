type Row = { meta: Record<string, unknown> | null; created_at: string };

export type SearchSummary = ReturnType<typeof summarizeSearchEvents>;

export function summarizeSearchEvents(rows: Row[], days: number) {
  const total = rows.length;
  let zero = 0;
  let errors = 0;
  let msSum = 0;
  let resSum = 0;
  const byQuery = new Map<string, { raw: string; count: number; zero: number; results: number }>();
  const bySource = new Map<string, { count: number; zero: number }>();
  const byDay = new Map<string, { count: number; zero: number }>();
  const errorSamples: Array<{ q: string; error: string; at: string }> = [];
  const zeroQueries = new Map<string, { raw: string; count: number }>();

  for (const r of rows) {
    const m = (r.meta ?? {}) as Record<string, unknown>;
    const norm = String(m["normalized"] ?? m["q"] ?? "").trim();
    const raw = String(m["q"] ?? norm);
    const results = Number(m["results"] ?? 0);
    const err = m["error"] ? String(m["error"]) : null;
    const source = String(m["source"] ?? "unknown");
    const day = r.created_at.slice(0, 10);

    resSum += Number.isFinite(results) ? results : 0;
    msSum += Number(m["ms"] ?? 0);
    if (err) {
      errors++;
      if (errorSamples.length < 20) errorSamples.push({ q: raw, error: err, at: r.created_at });
    }
    const isZero = !err && results === 0;
    if (isZero) {
      zero++;
      const z = zeroQueries.get(norm) ?? { raw, count: 0 };
      z.count++;
      zeroQueries.set(norm, z);
    }

    const q = byQuery.get(norm) ?? { raw, count: 0, zero: 0, results: 0 };
    q.count++;
    q.results += Number.isFinite(results) ? results : 0;
    if (isZero) q.zero++;
    byQuery.set(norm, q);

    const s = bySource.get(source) ?? { count: 0, zero: 0 };
    s.count++;
    if (isZero) s.zero++;
    bySource.set(source, s);

    const d = byDay.get(day) ?? { count: 0, zero: 0 };
    d.count++;
    if (isZero) d.zero++;
    byDay.set(day, d);
  }

  const pct = (n: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);

  return {
    days,
    kpis: {
      total,
      zero,
      zeroRate: pct(zero),
      hitRate: total ? Math.round(((total - zero - errors) / total) * 1000) / 10 : 0,
      errors,
      errorRate: pct(errors),
      avgResults: total ? Math.round((resSum / total) * 10) / 10 : 0,
      avgMs: total ? Math.round(msSum / total) : 0,
    },
    topQueries: [...byQuery.entries()]
      .map(([normalized, v]) => ({
        normalized,
        raw: v.raw,
        count: v.count,
        zero: v.zero,
        avgResults: Math.round((v.results / v.count) * 10) / 10,
        zeroRate: Math.round((v.zero / v.count) * 1000) / 10,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 25),
    zeroQueries: [...zeroQueries.entries()]
      .map(([normalized, v]) => ({ normalized, raw: v.raw, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
    bySource: [...bySource.entries()]
      .map(([source, v]) => ({
        source,
        count: v.count,
        zeroRate: Math.round((v.zero / v.count) * 1000) / 10,
      }))
      .sort((a, b) => b.count - a.count),
    daily: [...byDay.entries()]
      .map(([day, v]) => ({ day, count: v.count, zeroRate: Math.round((v.zero / v.count) * 1000) / 10 }))
      .sort((a, b) => (a.day < b.day ? -1 : 1)),
    errorSamples,
  };
}
